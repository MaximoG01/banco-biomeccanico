"""Validazione degli interventi: effetto della cadenza sulla ripartizione del costo metabolico tra i muscoli.
Dati: simulazioni OpenSim Moco di Clancy et al. 2023 (6 ciclisti × 3 livelli di carico × cadenze 60–120 rpm imposte dal protocollo).
DoWhy: trattamento = cadenza (intervento assegnato), esito = quota del costo metabolico di un gruppo muscolare,
ciclista e livello di carico come cause comuni dell'esito (aggiustamento backdoor). Refutazioni: placebo, causa comune casuale, sottoinsieme.
Confronto con l'effetto previsto dal modello per lo stesso intervento (test/esporta-cadenze.js).
Uso: python test/dowhy_interventi.py <cartella SimulationData> <previsioni_modello.json>
"""
import sys, glob, os, re, json, warnings, logging
import numpy as np, pandas as pd
warnings.filterwarnings("ignore"); logging.disable(logging.WARNING); sys.stdout.reconfigure(encoding="utf-8")
from dowhy import CausalModel
root, pred = sys.argv[1], json.load(open(sys.argv[2], encoding="utf-8"))
GROUPS = {"glut": ["glmax1", "glmax2", "glmax3"], "hams": ["bflh140", "semimem", "semiten"], "vast": ["vaslat140", "vasmed", "vasint"],
          "rf": ["recfem"], "ilio": ["iliacus", "psoas"], "gast": ["gasmed", "gaslat140"], "sol": ["soleus"], "ta": ["tibant"]}
LAB = {"glut": "Grande gluteo", "hams": "Ischiocrurali", "vast": "Vasti", "rf": "Retto femorale", "ilio": "Ileopsoas", "gast": "Gastrocnemio", "sol": "Soleo", "ta": "Tibiale ant."}
rows = []
for f in glob.glob(os.path.join(root, "Participant_*", "Metabolic_probes_solution", "qtm_*rpm__ProbeReporter_probes.sto")):
    m = re.search(r"qtm_(\d+)_(\d+)rpm", os.path.basename(f))
    if not m: continue
    L = open(f, encoding="utf-8").read().splitlines(); i = next(k for k, l in enumerate(L) if l.strip() == "endheader")
    cols = L[i + 1].split("\t"); d = np.array([[float(x) for x in l.split("\t")] for l in L[i + 2:] if l.strip()]); c = {k: j for j, k in enumerate(cols)}
    e = {g: float(np.mean(sum(d[:, c[f"metabolics_{x}_r"]] for x in ms))) for g, ms in GROUPS.items()}; tot = sum(e.values())
    rows.append({"ciclista": f.split(os.sep)[-3], "carico": int(m.group(1)), "cadenza": int(m.group(2)), **{g: 100 * e[g] / tot for g in GROUPS}})
df = pd.DataFrame(rows); df = pd.get_dummies(df, columns=["ciclista"], drop_first=True, dtype=float)
conf = ["carico"] + [c for c in df.columns if c.startswith("ciclista_")]
print(f"{len(df)} simulazioni (ciclisti × carichi × cadenze); effetto di +10 rpm sulla quota del costo metabolico (punti %)\n")
print(f"{'gruppo':16s} {'dati (DoWhy)':>13s} {'IC 95%':>17s} {'placebo':>8s} {'causa casuale':>14s} {'sottoins.':>10s}   {'modello':>8s}  accordo")
gml = lambda y: "graph [directed 1 " + " ".join(f'node [id "{n}" label "{n}"]' for n in ["cadenza", y] + conf) + " " + \
      " ".join(f'edge [source "{a}" target "{y}"]' for a in ["cadenza"] + conf) + "]"
agree = 0
for g in GROUPS:
    cm = CausalModel(data=df, treatment="cadenza", outcome=g, graph=gml(g))
    ie = cm.identify_effect(proceed_when_unidentifiable=True)
    est = cm.estimate_effect(ie, method_name="backdoor.linear_regression", confidence_intervals=True)
    ci = np.array(est.get_confidence_intervals()).ravel() * 10
    pl = cm.refute_estimate(ie, est, method_name="placebo_treatment_refuter", placebo_type="permute", num_simulations=30).new_effect * 10
    rc = cm.refute_estimate(ie, est, method_name="random_common_cause", num_simulations=30).new_effect * 10
    ss = cm.refute_estimate(ie, est, method_name="data_subset_refuter", subset_fraction=0.8, num_simulations=30).new_effect * 10
    mod = pred["per10"][g]; eff = est.value * 10
    same = (np.sign(eff) == np.sign(mod)) or (ci[0] <= mod <= ci[1]); agree += same
    print(f"{LAB[g]:16s} {eff:+12.2f}  [{ci[0]:+6.2f}, {ci[1]:+6.2f}] {pl:+8.2f} {rc:+13.2f} {ss:+10.2f}   {mod:+8.2f}  {'sì' if same else 'no'}")
print(f"\nAccordo nel verso o dentro l'intervallo di confidenza: {agree}/{len(GROUPS)} gruppi")
