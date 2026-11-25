"""Adatta a ogni atleta il modello omni-dominio (Puchowicz et al. 2020):
P(t) = W'/t·(1 − exp(−t·(Pmax − CP)/W')) + CP  per t ≤ 1800 s;  oltre: − A·ln(t/1800).
Uso: python -I test/gc_curva.py <gc-curve.csv> <out.csv>"""
import sys, csv, numpy as np
from scipy.optimize import least_squares
sys.stdout.reconfigure(encoding="utf-8")
DUR = np.array([1, 5, 10, 30, 60, 120, 300, 600, 1200, 1800, 3600.])
def ompd(t, pmax, cp, wp, a):
    p = wp / t * (1 - np.exp(-t * (pmax - cp) / wp)) + cp
    return np.where(t > 1800, p - a * np.log(t / 1800), p)
R = list(csv.DictReader(open(sys.argv[1], encoding="utf-8"))); out = []
for r in R:
    w = float(r["peso"]); y = np.array([float(r[f"p{int(d)}"]) for d in DUR]); ok = y > 0
    if ok.sum() < 9: continue
    def res(x): return (ompd(DUR[ok], *x) - y[ok]) / y[ok]
    x0 = [y[0], 0.95 * y[8], 20000, 0.05 * y[8]]
    f = least_squares(res, x0, bounds=([y[1], 50, 2000, 0], [3000, 600, 80000, 200]))
    pmax, cp, wp, a = f.x; rms = np.sqrt(np.mean(f.fun ** 2))
    out.append({"id": r["id"], "sesso": r["sesso"], "eta": r["eta"], "peso": w, "pmax": pmax, "cp": cp, "wp": wp, "a": a, "rms": rms,
                "p60m": y[10], "p20m": y[8], "p5s": y[1], "p1m": y[4], "p5m": y[6]})
with open(sys.argv[2], "w", encoding="utf-8", newline="") as fo:
    wr = csv.DictWriter(fo, fieldnames=list(out[0])); wr.writeheader(); wr.writerows(out)
O = [o for o in out if o["sesso"] == "M"]; v = lambda k, s=1: np.array([o[k] / (o["peso"] if s else 1) for o in O])
print(f"{len(out)} atleti adattati, errore medio della curva {100*np.median([o['rms'] for o in out]):.1f}% (mediana)")
for k, lab in [("pmax", "Pmax W/kg"), ("cp", "CP W/kg"), ("wp", "W' J/kg"), ("p60m", "60 min W/kg")]:
    x = v(k); print(f"{lab:12s} P10 {np.percentile(x,10):6.1f}  P50 {np.percentile(x,50):6.1f}  P90 {np.percentile(x,90):6.1f}")
print(f"A (calo oltre 30 min) mediana {np.median(v('a',0)):.1f} W; FTP(60 min)/CP mediana {np.median(v('p60m')/v('cp')):.3f}")
# W' in funzione di Pmax e CP (per kg): regressione lineare
X = np.c_[np.ones(len(O)), v("pmax"), v("cp")]; yw = v("wp"); b, *_ = np.linalg.lstsq(X, yw, rcond=None)
pred = X @ b; r2 = 1 - ((yw - pred) ** 2).sum() / ((yw - yw.mean()) ** 2).sum()
print(f"W'/kg = {b[0]:.0f} + {b[1]:.1f}·Pmax/kg + {b[2]:.1f}·CP/kg   R² {r2:.2f}  errore tipico {np.std(yw-pred):.0f} J/kg")
for c in ["pmax", "cp"]: print(f"  r(W'/kg, {c}/kg) = {np.corrcoef(yw, v(c))[0,1]:.2f}")
