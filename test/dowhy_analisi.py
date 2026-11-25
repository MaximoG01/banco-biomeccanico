"""Analisi causale del modello con DoWhy.

Dati: atleti virtuali con parametri estratti a caso (esperimento randomizzato sui parametri del modello).
Per ogni parametro: effetto totale sulla FTP (W/kg) per +1 deviazione standard di popolazione (DoWhy, aggiustamento
per l'altezza dove serve: l'altezza causa cavallo e massa), quota dell'effetto che passa dall'efficienza lorda
(mediazione), quota di varianza spiegata (indice di Sobol del primo ordine, per binning) e un test placebo.
Uso: python test/dowhy_analisi.py test/dataset-v2.csv
"""
import sys, warnings, logging
import numpy as np, pandas as pd
warnings.filterwarnings("ignore"); logging.disable(logging.WARNING)
from dowhy import CausalModel

path = sys.argv[1] if len(sys.argv) > 1 else "test/dataset-v2.csv"
df = pd.read_csv(path)
Y = "ftp_wkg"
PARAMS = ["vo2", "mito", "slow", "age", "thigh", "h", "ins", "mass", "ratio", "crank", "saddle", "trunk", "sta",
          "stack", "cleat", "ankl", "cad", "cc"]
LAB = {"vo2": "VO2max", "mito": "Densità mitocondriale", "slow": "Fibre lente", "age": "Età", "thigh": "Diametro coscia",
       "h": "Altezza", "ins": "Cavallo", "mass": "Massa", "ratio": "Femore/tibia", "crank": "Pedivella", "saddle": "Altezza sella",
       "trunk": "Inclinazione busto", "sta": "Angolo tubo sella", "stack": "Stack pedale+suola", "cleat": "Tacchetta arretrata",
       "ankl": "Ankling", "cad": "Cadenza", "cc": "Co-contrazione"}
CONF = {"ins": ["h"], "mass": ["h"]}  # l'altezza causa cavallo e massa e (attraverso altre vie) la FTP

def gml(t):
    """Grafo minimo per il trattamento t: t → ge → Y, t → Y, più il confondente altezza se serve."""
    nodes = {t, "ge", Y, *CONF.get(t, [])}
    edges = [(t, "ge"), ("ge", Y), (t, Y)] + [(c, t) for c in CONF.get(t, [])] + [(c, Y) for c in CONF.get(t, [])]
    return "graph [directed 1 " + " ".join(f'node [id "{n}" label "{n}"]' for n in nodes) + " " + \
           " ".join(f'edge [source "{a}" target "{b}"]' for a, b in edges) + "]"

def sobol1(x, y, bins=20):
    q = pd.qcut(x.rank(method="first"), bins, labels=False)
    return y.groupby(q).mean().var(ddof=0) / y.var(ddof=0)

rows = []
for p in PARAMS:
    m = CausalModel(data=df, treatment=p, outcome=Y, graph=gml(p))
    tot = m.estimate_effect(m.identify_effect(proceed_when_unidentifiable=True), method_name="backdoor.linear_regression").value
    try:  # effetto indiretto attraverso l'efficienza lorda
        nie = m.estimate_effect(m.identify_effect(estimand_type="nonparametric-nie", proceed_when_unidentifiable=True),
                                method_name="mediation.two_stage_regression",
                                method_params={"first_stage_model": None, "second_stage_model": None}).value
        via_ge = nie / tot if abs(tot) > 1e-9 else np.nan
    except Exception:
        via_ge = np.nan
    sd = df[p].std()
    rows.append({"parametro": LAB[p], "sd": sd, "effetto_1sd": tot * sd, "effetto_pct": 100 * tot * sd / df[Y].mean(),
                 "sobol": sobol1(df[p], df[Y]), "via_GE": via_ge})

res = pd.DataFrame(rows).sort_values("sobol", ascending=False)
pd.set_option("display.width", 200)
print(f"N = {len(df)} atleti virtuali | FTP media {df[Y].mean():.2f} W/kg (sd {df[Y].std():.2f}) | GE media {df['ge'].mean():.1f}%")
print(f"limite muscolare attivo nel {100 * df['lim_mus'].mean():.0f}% dei casi | somma Sobol 1° ordine {res.sobol.sum():.2f}\n")
print(res.to_string(index=False, formatters={"sd": "{:.3g}".format, "effetto_1sd": "{:+.3f}".format,
      "effetto_pct": "{:+.1f}%".format, "sobol": "{:.3f}".format, "via_GE": lambda v: "-" if np.isnan(v) else f"{100 * v:.0f}%"}))
for p in ["cleat", "vo2"]:  # refutazione: placebo (trattamento permutato) → l'effetto deve sparire
    m = CausalModel(data=df, treatment=p, outcome=Y, graph=gml(p))
    ie = m.identify_effect(proceed_when_unidentifiable=True); est = m.estimate_effect(ie, method_name="backdoor.linear_regression")
    ref = m.refute_estimate(ie, est, method_name="placebo_treatment_refuter", placebo_type="permute", num_simulations=20)
    print(f"Placebo su {LAB[p]}: effetto {est.value:+.4f} -> con trattamento permutato {ref.new_effect:+.4f}")
res.to_csv(path.replace(".csv", "-effetti.csv"), index=False)
