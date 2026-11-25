"""Prepara gli obiettivi per la taratura del modello sui dati di Clancy et al. 2023.
- 16 ciclisti misurati: cadenza, potenza, lunghezza pedivella, massa (dal modello OpenSim scalato) e coppia della gamba destra (72 punti, 0° = punto morto superiore)
- 6 simulazioni Moco (condizione 30_90r): attivazioni medie per gruppo muscolare (72 punti)
Uso: python test/target_opensim.py <cartella esperimenti (P01-08, P09-16)> <cartella SimulationData> <uscita.json>
"""
import sys, glob, os, json, re, zipfile
import numpy as np
sys.stdout.reconfigure(encoding="utf-8")
exp, sim, out = sys.argv[1], sys.argv[2], sys.argv[3]
N = 72

def load_csv(f):
    L = open(f, encoding="utf-8").read().splitlines(); i = next(k for k, l in enumerate(L) if l.strip() == "endheader")
    cols = L[i + 1].split(","); return cols, np.array([[float(x) for x in l.split(",")] for l in L[i + 2:] if l.strip()])

def circle(x, y):
    A = np.c_[2 * x, 2 * y, np.ones_like(x)]; c = np.linalg.lstsq(A, x * x + y * y, rcond=None)[0]; return c[0], c[1], np.sqrt(c[2] + c[0] ** 2 + c[1] ** 2)

def model_mass(pid):  # somma delle masse dei corpi nel modello OpenSim scalato (dentro gli zip originali)
    for z in ("P01-08.zip", "P09-16.zip"):
        try:
            zz = zipfile.ZipFile(z); n = [x for x in zz.namelist() if x.endswith(f"{pid}_CyclingModel_rra.osim")]
            if n: return sum(float(m) for m in re.findall(r"<mass>\s*([0-9.eE+-]+)\s*</mass>", zz.read(n[0]).decode("utf-8", "ignore")))
        except FileNotFoundError: pass
    return None

riders = []
for f in sorted(glob.glob(os.path.join(exp, "P*", "P*pedal_force_data_filtered.csv"))):
    pid = os.path.basename(f)[:3]; cols, d = load_csv(f); c = {k: j for j, k in enumerate(cols)}
    P = np.c_[d[:, c["right_force_px"]], d[:, c["right_force_py"]], d[:, c["right_force_pz"]]]
    F = np.c_[d[:, c["right_force_vx"]], d[:, c["right_force_vy"]], d[:, c["right_force_vz"]]]
    ok = np.linalg.norm(F, axis=1) > 5; P, F, t = P[ok], F[ok], d[ok, 0]
    lat = int(np.argmin(P.std(axis=0))); up = 1; fw = [k for k in range(3) if k not in (lat, up)][0]
    x, y = P[:, fw], P[:, up]; cx, cy, rc = circle(x, y); rx, ry = x - cx, y - cy
    top = ry > 0.8 * rc; fwd = np.sign(np.median(np.gradient(x, t)[top])); rx = rx * fwd; Ffw = F[:, fw] * fwd
    th = np.unwrap(np.arctan2(rx, ry)); tq = rx * F[:, up] - ry * Ffw
    if np.mean(tq) < 0: tq = -tq
    w = np.polyfit(t, th, 1)[0]; b = (np.mod(th, 2 * np.pi) / (2 * np.pi) * N).astype(int) % N
    tqb = [float(tq[b == i].mean()) for i in range(N)]
    riders.append({"id": pid, "cad": float(w * 60 / (2 * np.pi)), "power": float(2 * np.mean(tqb) * w), "crank": float(rc * 1000), "mass": model_mass(pid), "tq": tqb})

GROUPS = {"glut": ["glmax1", "glmax2", "glmax3"], "hams": ["bflh140", "semimem", "semiten"], "vast": ["vaslat140", "vasmed", "vasint"],
          "rf": ["recfem"], "ilio": ["iliacus", "psoas"], "gast": ["gasmed", "gaslat140"], "sol": ["soleus"], "ta": ["tibant"]}
acts = []
for f in sorted(glob.glob(os.path.join(sim, "Participant_*", "Sim_solution", "qtm_30_90rInverseSolution.sto"))):
    L = open(f, encoding="utf-8").read().splitlines(); i = next(k for k, l in enumerate(L) if l.strip() == "endheader")
    cols = L[i + 1].split("\t"); d = np.array([[float(x) for x in l.split("\t")] for l in L[i + 2:] if l.strip()]); col = {k: j for j, k in enumerate(cols)}
    rs = lambda yv: np.interp(np.arange(N) / N, np.linspace(0, 1, len(yv), endpoint=False), yv, period=1)
    acts.append({"id": f.split(os.sep)[-3], "act": {g: rs(np.mean([d[:, col[f"/forceset/{m}_r/activation"]] for m in ms], axis=0)).tolist() for g, ms in GROUPS.items()}})
json.dump({"riders": riders, "acts": acts}, open(out, "w", encoding="utf-8"))
print(f"{len(riders)} ciclisti, {len(acts)} simulazioni Moco; masse: {[round(r['mass'] or 0) for r in riders]}")
