"""Forze sui pedali misurate (Clancy et al. 2023, 16 ciclisti) → coppia sulla pedivella, potenza, Power Phase, indice di efficacia.
Il centro del movimento centrale si stima come centro del cerchio descritto dal punto di applicazione della forza del pedale destro;
0° = pedale destro in alto (punto morto superiore). Confronto con il modello alla stessa potenza e cadenza medie.
Uso: python test/pedali_opensim.py <cartella con P01-08 e P09-16> <curve.json del modello>
"""
import sys, glob, os, json
import numpy as np
sys.stdout.reconfigure(encoding="utf-8")
root = sys.argv[1]; MOD = json.load(open(sys.argv[2], encoding="utf-8")) if len(sys.argv) > 2 else None
N = 72

def load(f):
    L = open(f, encoding="utf-8").read().splitlines(); i = next(k for k, l in enumerate(L) if l.strip() == "endheader")
    cols = L[i + 1].split(","); d = np.array([[float(x) for x in l.split(",")] for l in L[i + 2:] if l.strip()]); return cols, d

def circle(x, y):  # cerchio ai minimi quadrati
    A = np.c_[2 * x, 2 * y, np.ones_like(x)]; c = np.linalg.lstsq(A, x * x + y * y, rcond=None)[0]; return c[0], c[1], np.sqrt(c[2] + c[0] ** 2 + c[1] ** 2)

def arc(tq, thr):  # arco in cui la coppia supera thr: inizio e fine in gradi
    on = tq > thr; s = e = None
    for i in range(N):
        if on[i] and not on[i - 1]: s = i * 360 / N
        if not on[i] and on[i - 1]: e = i * 360 / N
    return s, e

rows, prof = [], []
for f in sorted(glob.glob(os.path.join(root, "P*", "P*pedal_force_data_filtered.csv"))):
    cols, d = load(f); c = {k: j for j, k in enumerate(cols)}
    P = np.c_[d[:, c["right_force_px"]], d[:, c["right_force_py"]], d[:, c["right_force_pz"]]]
    F = np.c_[d[:, c["right_force_vx"]], d[:, c["right_force_vy"]], d[:, c["right_force_vz"]]]
    ok = np.linalg.norm(F, axis=1) > 5; P, F, t = P[ok], F[ok], d[ok, 0]
    lat = int(np.argmin(P.std(axis=0)))                                       # asse laterale: il pedale vi si muove poco
    up = 1                                                                    # y verso l'alto (OpenSim)
    fw = [k for k in range(3) if k not in (lat, up)][0]
    x, y = P[:, fw], P[:, up]; cx, cy, rc = circle(x, y)
    rx, ry = x - cx, y - cy
    # "avanti" = verso in cui si muove il pedale quando è in alto (la pedivella gira in avanti sopra il movimento centrale)
    top = ry > 0.8 * rc; vx = np.gradient(x, t); fwd = np.sign(np.median(vx[top]))
    rx = rx * fwd; Ffw = F[:, fw] * fwd
    th = np.unwrap(np.arctan2(rx, ry))                                        # 0° in alto, 90° pedale davanti
    tq = rx * F[:, up] - ry * Ffw                                             # momento della forza attorno al movimento centrale
    if np.mean(tq) < 0: tq = -tq                                              # il file riporta la reazione del pedale: coppia motrice positiva
    w = np.polyfit(t, th, 1)[0]; cad = w * 60 / (2 * np.pi)
    ang = np.mod(th, 2 * np.pi); b = (ang / (2 * np.pi) * N).astype(int) % N
    tqb = np.array([tq[b == i].mean() for i in range(N)])
    Ft = np.array([(np.abs(F[b == i, fw]) ** 2 + F[b == i, up] ** 2).mean() ** 0.5 for i in range(N)])
    ie = (tqb / rc).sum() / Ft.sum()
    pw = 2 * tqb.mean() * w                                                   # due gambe (destra × 2)
    s, e = arc(tqb, 0); ps, pe = arc(tqb, 0.5 * tqb.max())
    rows.append(dict(id=os.path.basename(f)[:3], cad=cad, power=pw, crank=rc * 1000, peak=int(np.argmax(tqb)) * 5, tmin=tqb.min(), ie=ie, pp=(s, e), ppp=(ps, pe)))
    prof.append(tqb / max(tqb.max(), 1e-9))

print(f"{'ciclista':8s} {'cadenza':>8s} {'potenza':>8s} {'pedivella':>9s} {'picco':>6s} {'coppia min':>10s} {'IE':>5s}   Power Phase      Peak PP")
for r in rows:
    print(f"{r['id']:8s} {r['cad']:7.0f}  {r['power']:7.0f}W {r['crank']:7.0f}mm {r['peak']:5d}° {r['tmin']:8.1f}Nm {100 * r['ie']:4.0f}%   {r['pp'][0]!s:>5}°→{r['pp'][1]!s:>5}°   {r['ppp'][0]!s:>5}°→{r['ppp'][1]!s:>5}°")
avg = lambda k: np.mean([r[k] for r in rows])
print(f"\nMEDIA    {avg('cad'):7.0f}  {avg('power'):7.0f}W            {avg('peak'):5.0f}° {avg('tmin'):8.1f}Nm {100 * avg('ie'):4.0f}%")
if MOD:
    tq = np.array(MOD["tq_leg"]); s, e = arc(tq, 0); ps, pe = arc(tq, 0.5 * tq.max())
    print(f"MODELLO  {MOD['cad']:7.0f}  {MOD['power']:7.0f}W            {int(np.argmax(tq)) * 5:5d}° {tq.min():8.1f}Nm {100 * MOD['ie']:4.0f}%   {s!s:>5}°→{e!s:>5}°   {ps!s:>5}°→{pe!s:>5}°")
    m = np.mean(prof, axis=0); mm = tq / tq.max()
    print(f"forma della coppia (una gamba) modello vs media misurata: r = {np.corrcoef(m, mm)[0, 1]:.2f}")
json.dump({"rows": rows, "profile_mean": np.mean(prof, axis=0).tolist()}, open(os.path.join(root, "pedali_riassunto.json"), "w"), default=float)
