"""Confronto tra il modello e le simulazioni OpenSim Moco di Clancy et al. 2023 (dataset Dryad 'SimulationData').

I file .sto contengono un giro di pedivella della gamba destra (attivazioni di 40 muscoli, angoli articolari in radianti),
ma non l'angolo della pedivella: le fasi si allineano mettendo il massimo di flessione del ginocchio allo stesso angolo
in cui cade nel nostro modello. I muscoli OpenSim sono raggruppati negli 8 gruppi del modello.
Uso: python test/confronto_opensim.py <cartella SimulationData> <curve.json del modello> [condizione, es. 30_90r]
"""
import sys, json, glob, os
import numpy as np
sys.stdout.reconfigure(encoding="utf-8")

root, model_json = sys.argv[1], sys.argv[2]
cond = sys.argv[3] if len(sys.argv) > 3 else "30_90r"
MOD = json.load(open(model_json, encoding="utf-8"))
GROUPS = {"glut": ["glmax1", "glmax2", "glmax3"], "hams": ["bflh140", "semimem", "semiten"], "vast": ["vaslat140", "vasmed", "vasint"],
          "rf": ["recfem"], "ilio": ["iliacus", "psoas"], "gast": ["gasmed", "gaslat140"], "sol": ["soleus"], "ta": ["tibant"]}
LAB = {"glut": "Grande gluteo", "hams": "Ischiocrurali", "vast": "Vasti", "rf": "Retto femorale", "ilio": "Ileopsoas",
       "gast": "Gastrocnemio", "sol": "Soleo", "ta": "Tibiale anteriore"}
N = 72
grid = np.arange(N) * 360 / N

def read_sto(path):
    L = open(path, encoding="utf-8").read().splitlines()
    i = next(k for k, l in enumerate(L) if l.strip() == "endheader")
    cols = L[i + 1].split("\t")
    data = np.array([[float(x) for x in l.split("\t")] for l in L[i + 2:] if l.strip()])
    return cols, data

def resample(y):  # un giro → 72 punti equispaziati
    t = np.linspace(0, 1, len(y), endpoint=False)
    return np.interp(np.arange(N) / N, t, y, period=1)

def window(a):  # inizio e fine della fase attiva (sopra il 50% del massimo), in gradi
    on = a > 0.5 * a.max(); s = e = None
    for i in range(N):
        if on[i] and not on[i - 1]: s = i * 360 / N
        if not on[i] and on[i - 1]: e = i * 360 / N
    return s, e

def circ_corr(a, b):  # correlazione delle forme
    a = (a - a.mean()) / (a.std() + 1e-9); b = (b - b.mean()) / (b.std() + 1e-9); return float((a * b).mean())

mk = np.array(MOD["knee"]); k0_mod = int(np.argmax(mk))
res = {"rom": [], "act": {g: [] for g in GROUPS}, "corr": {g: [] for g in GROUPS}, "meta": {g: [] for g in GROUPS}}
files = sorted(glob.glob(os.path.join(root, "Participant_*", "Sim_solution", f"qtm_{cond}InverseSolution.sto")))
for fpath in files:
    cols, d = read_sto(fpath)
    col = {c: j for j, c in enumerate(cols)}
    ang = {k: resample(np.degrees(d[:, col[f"/jointset/{p}/value"]])) for k, p in
           [("hip", "hip_r/hip_flexion_r"), ("knee", "walker_knee_r/knee_angle_r"), ("ankle", "ankle_r/ankle_angle_r")]}
    shift = int(np.argmax(ang["knee"])) - k0_mod  # allinea il massimo di flessione del ginocchio
    ang = {k: np.roll(v, -shift) for k, v in ang.items()}
    res["rom"].append({k: (v.min(), v.max()) for k, v in ang.items()})
    for g, ms in GROUPS.items():
        a = np.mean([resample(d[:, col[f"/forceset/{m}_r/activation"]]) for m in ms], axis=0)
        a = np.roll(a, -shift); res["act"][g].append(a); res["corr"][g].append(circ_corr(a, np.array(MOD["act"][g])))
    mp = fpath.replace("Sim_solution", "Metabolic_probes_solution").replace(f"qtm_{cond}InverseSolution.sto", f"qtm_{cond.replace('r', '')}rpm__ProbeReporter_probes.sto")
    if os.path.exists(mp):
        c2, d2 = read_sto(mp); col2 = {c: j for j, c in enumerate(c2)}
        e = {g: float(np.mean(sum(d2[:, col2[f"metabolics_{m}_r"]] for m in ms))) for g, ms in GROUPS.items() if all(f"metabolics_{m}_r" in col2 for m in ms)}
        tot = sum(e.values())
        for g in e: res["meta"][g].append(100 * e[g] / tot)

print(f"Condizione OpenSim '{cond}' · {len(files)} partecipanti · modello a {MOD['cad']} rpm, {MOD['power']} W\n")
print("Escursione articolare (°)          OpenSim media (min→max)        modello")
for k, n in [("hip", "anca"), ("knee", "ginocchio"), ("ankle", "caviglia")]:
    lo = np.mean([r[k][0] for r in res["rom"]]); hi = np.mean([r[k][1] for r in res["rom"]]); sd = np.std([r[k][1] - r[k][0] for r in res["rom"]])
    m = np.array(MOD[k]); print(f"  {n:10s} {lo:6.0f} → {hi:4.0f}  (escursione {hi - lo:3.0f} ± {sd:2.0f})      {m.min():4.0f} → {m.max():4.0f}  (escursione {m.max() - m.min():3.0f})")
print("\nAttivazione (fase sopra il 50% del massimo, gradi allineati)   OpenSim media      modello     forma (r)")
ms_share = {g: MOD["power_share"][g] for g in GROUPS}; tps = sum(ms_share.values())
for g in GROUPS:
    a = np.mean(res["act"][g], axis=0); s, e = window(a); sm, em = window(np.array(MOD["act"][g]))
    r = np.mean(res["corr"][g])
    print(f"  {LAB[g]:18s} {s!s:>5}° → {e!s:>5}°   {sm!s:>5}° → {em!s:>5}°   {r:+.2f}")
print("\nQuota per muscolo: costo metabolico OpenSim (gamba destra)  vs  potenza meccanica nel modello")
for g in GROUPS:
    v = res["meta"][g]; mo = 100 * ms_share[g] / tps
    print(f"  {LAB[g]:18s} {np.mean(v) if v else float('nan'):5.1f}%   vs   {mo:5.1f}%")
