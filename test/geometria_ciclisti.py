"""Misure individuali dei 16 ciclisti di Clancy et al. 2023 dai marker (gamba destra), in un piano sagittale.
Centro anca: regressione di Harrington dal bacino (ASIS/PSIS); ginocchio e caviglia: punti medi di condili e malleoli;
movimento centrale e pedivella: cerchio dei marker del pedale; suola: calcagno → testa del 1° metatarso.
Uscita: parametri del modello per ogni ciclista + angoli misurati del ginocchio e della suola lungo il giro.
Uso: python test/geometria_ciclisti.py <uscita.json>   (legge P01-08.zip e P09-16.zip nella cartella corrente)
"""
import sys, json, zipfile, io
import numpy as np
sys.stdout.reconfigure(encoding="utf-8")
N, STEP = 72, 3
need = ["ASIS_R", "ASIS_L", "PSIS_R", "PSIS_L", "Knee_R_L_Cond", "Knee_R_M_Cond", "Ankle_R_L_Mal", "Ankle_R_M_Mal",
        "Foot_R_MH_1_Top", "Foot_R_Calc", "Acr_R", "R_pedal_1", "R_pedal_2", "R_pedal_3", "R_pedal_4"]

def markers(raw):
    L = raw.decode("utf-8", "ignore").splitlines(); names = L[3].split(","); idx = {}
    for j, n in enumerate(names):
        if n in need: idx[n] = j
    rows = []
    for l in L[6::STEP]:
        v = l.split(",")
        try: rows.append([[float(v[idx[n] + k]) for k in range(3)] for n in need])
        except (ValueError, IndexError): continue
    return np.array(rows) / 1000.0                                    # metri, forma (frame, marker, xyz)

def circle(x, y):
    A = np.c_[2 * x, 2 * y, np.ones_like(x)]; c = np.linalg.lstsq(A, x * x + y * y, rcond=None)[0]; return c[0], c[1], np.sqrt(c[2] + c[0] ** 2 + c[1] ** 2)

out = []
for zname in ("P01-08.zip", "P09-16.zip"):
    z = zipfile.ZipFile(zname)
    for n in sorted(x for x in z.namelist() if "marker_data" in x and x.endswith(".csv")):
        pid = n.split("marker_data")[1][:3]; D = markers(z.read(n)); g = {k: D[:, i, :] for i, k in enumerate(need)}
        # centro anca (Harrington 2007): sistema del bacino
        aR, aL, pR, pL = g["ASIS_R"], g["ASIS_L"], g["PSIS_R"], g["PSIS_L"]; am, pm = (aR + aL) / 2, (pR + pL) / 2
        zv = aR - aL; PW = np.linalg.norm(zv, axis=1); zv = zv / PW[:, None]
        xv = am - pm; xv = xv - (xv * zv).sum(1)[:, None] * zv; PD = np.linalg.norm(xv, axis=1); xv = xv / PD[:, None]; yv = np.cross(zv, xv)
        hjc = am + ((-0.24 * PD - 0.0099)[:, None] * xv + (-0.30 * PW - 0.0109)[:, None] * yv + (0.33 * PW + 0.0073)[:, None] * zv)
        kjc = (g["Knee_R_L_Cond"] + g["Knee_R_M_Cond"]) / 2; ajc = (g["Ankle_R_L_Mal"] + g["Ankle_R_M_Mal"]) / 2
        ped = (g["R_pedal_1"] + g["R_pedal_2"] + g["R_pedal_3"] + g["R_pedal_4"]) / 4
        up = 1; lat = 0 if ped[:, 0].std() < ped[:, 2].std() else 2; fw = 2 if lat == 0 else 0
        cx, cy, rc = circle(ped[:, fw], ped[:, up])
        rx, ry = ped[:, fw] - cx, ped[:, up] - cy; top = ry > 0.8 * rc
        sgn = np.sign(np.nanmedian(np.gradient(ped[:, fw])[top]))         # avanti = verso del pedale in alto
        P2 = lambda a: np.c_[(a[:, fw] - cx) * sgn, a[:, up] - cy]       # coordinate sagittali rispetto al movimento centrale
        H2, K2, A2, M2, C2, S2 = P2(hjc), P2(kjc), P2(ajc), P2(g["Foot_R_MH_1_Top"]), P2(g["Foot_R_Calc"]), P2(g["Acr_R"])
        th = np.mod(np.arctan2(rx * sgn, ry), 2 * np.pi); b = (th / (2 * np.pi) * N).astype(int) % N
        Lf, Lt = np.nanmedian(np.linalg.norm(H2 - K2, axis=1)), np.nanmedian(np.linalg.norm(K2 - A2, axis=1))
        u1, u2 = H2 - K2, A2 - K2
        knee = 180 - np.degrees(np.arccos((u1 * u2).sum(1) / np.linalg.norm(u1, axis=1) / np.linalg.norm(u2, axis=1)))
        sole = np.degrees(np.arctan2(C2[:, 1] - M2[:, 1], M2[:, 0] - C2[:, 0]))   # punta in giù positiva
        kb = np.array([np.nanmean(knee[b == i]) for i in range(N)]); sb = np.array([np.nanmean(sole[b == i]) for i in range(N)])
        tt = np.arange(N) * 2 * np.pi / N; X = np.c_[np.ones(N), np.sin(tt), np.cos(tt)]; c0, c1, c2 = np.linalg.lstsq(X, sb, rcond=None)[0]
        amp, ph = float(np.hypot(c1, c2)), float(np.degrees(np.arctan2(c2, -c1)))
        # segmento caviglia → asse del pedale (marker del pedale): lunghezza e angolo sotto l'orizzontale lungo il giro
        Pd = np.c_[rx * sgn, ry]; v = Pd - A2; footL = float(np.nanmedian(np.linalg.norm(v, axis=1)))
        phi = np.degrees(np.arctan2(-v[:, 1], v[:, 0])); pb = np.array([np.nanmean(phi[b == i]) for i in range(N)])
        f0, f1, f2 = np.linalg.lstsq(X, pb, rcond=None)[0]; famp, fph = float(np.hypot(f1, f2)), float(np.degrees(np.arctan2(f2, -f1)))
        hip = np.nanmedian(H2, axis=0); trunk = float(np.degrees(np.nanmedian(np.arctan2(S2[:, 1] - H2[:, 1], S2[:, 0] - H2[:, 0]))))
        L = Lf + Lt; H = L / 0.4773; ins = L - 0.011 * H; hO = 0.033 * H
        S = float(np.hypot(hip[0], hip[1] - hO)); sta = float(np.degrees(np.arctan2(hip[1] - hO, -hip[0])))
        out.append({"id": pid, "h": round(H * 100, 1), "ins": round(ins * 100, 1), "ratio": round(Lf / Lt, 3), "crank": round(rc * 1000, 1),
                    "saddle": round(S / ins, 3), "sta": round(sta, 1), "trunk": round(trunk, 1), "sole": round(float(c0), 1), "ankl": round(amp, 1), "sph": round(ph, 1), "footL": round(footL, 3), "phi0": round(float(f0), 1), "phiAmp": round(famp, 1), "phiPh": round(fph, 1),
                    "knee": kb.tolist(), "sole_curve": sb.tolist(), "Lf": round(Lf, 3), "Lt": round(Lt, 3)})
        o = out[-1]; print(f"{pid}: altezza {o['h']} cm · cavallo {o['ins']} · femore/tibia {o['ratio']} · pedivella {o['crank']} mm · sella {o['saddle']} × cavallo · tubo sella {o['sta']}° · busto {o['trunk']}° · caviglia→pedale {o['footL']} m a {o['phi0']}±{o['phiAmp']}° fase {o['phiPh']}° · ginocchio {np.nanmin(kb):.0f}→{np.nanmax(kb):.0f}°")
json.dump(out, open(sys.argv[1], "w", encoding="utf-8"))
