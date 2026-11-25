"""Dai riepiloghi GoldenCheetah: curva migliore per atleta (potenza media massima a varie durate), peso, sesso, età.
Filtri: solo uscite in bici con peso plausibile; picchi impossibili scartati (1 s > 30 W/kg, curva non decrescente).
Uso: python -I test/gc_estrai.py <cartella json> <file csv>"""
import sys, os, json, glob, statistics as st
sys.stdout.reconfigure(encoding="utf-8")
DUR = [1, 5, 10, 30, 60, 120, 300, 600, 1200, 1800, 3600]
KEYS = ["1s", "5s", "10s", "30s", "1m", "2m", "5m", "10m", "20m", "30m", "60m"]; KEYS = [k + "_critical_power" for k in KEYS]
out = open(sys.argv[2], "w", encoding="utf-8"); out.write("id,sesso,eta,peso,uscite," + ",".join(f"p{d}" for d in DUR) + "\n")
n = 0
for f in glob.glob(os.path.join(sys.argv[1], "*.json")):
    try: d = json.load(open(f, encoding="utf-8-sig"))
    except Exception: continue
    a = d.get("ATHLETE", {}); sex = a.get("gender", ""); yob = a.get("yob", "")
    best = [[] for _ in DUR]; ws = []; nr = 0; years = []
    for r in d.get("RIDES", []):
        if (r.get("sport") or "").lower() not in ("bike", ""): continue
        m = r.get("METRICS", {})
        def g(k):
            try: return float(m.get(k, 0) or 0)
            except Exception: return 0.0
        cur = [g(k) for k in KEYS]
        try: w = float(m.get("athlete_weight", 0))
        except Exception: w = 0
        if 40 <= w <= 130: ws.append(w)
        if cur[0] <= 0 or cur[0] > 2500: continue                        # picco del sensore
        if cur[1] > 0 and cur[0] > 1.6 * cur[1]: continue                 # 1 s isolato rispetto ai 5 s: spike, non uno sprint
        if any(cur[k + 1] > cur[k] + 1 for k in range(len(cur) - 1) if cur[k + 1] > 0): continue  # curva non decrescente: dato corrotto
        nr += 1; years.append(r.get("date", "")[:4])
        for k in range(len(DUR)):
            if cur[k] > 0: best[k].append(cur[k])
    # seconda miglior uscita per durata: un solo valore corrotto non basta a fare il record
    best = [sorted(b)[-2] if len(b) >= 2 else 0 for b in best]
    if nr < 20 or not ws or best[8] <= 0: continue                       # almeno 20 uscite e un 20 minuti
    wt = st.median(ws)
    LIM = [28, 25, 22, 14, 12, 9.5, 8, 7.5, 7, 6.8, 6.5]                    # W/kg oltre i record mondiali: dato non credibile
    if any(b / wt > L for b, L in zip(best, LIM)): continue
    if best[2] > 0 and best[4] > 0 and best[2] < 1.1 * best[4]: continue      # 10 s quasi uguale a 1 min: sensore bloccato
    if best[0] < 1.04 * best[2]: continue                                     # 1 s uguale a 10 s: sensore bloccato
    try: age = int(st.median([int(y) for y in years if y.isdigit()])) - int(yob)
    except Exception: age = ""
    if age != "" and not 15 <= age <= 85: age = ""
    out.write(f"{os.path.basename(f)[:8]},{sex},{age},{wt:.1f},{nr}," + ",".join(f"{b:.0f}" for b in best) + "\n"); n += 1
print(n, "atleti validi")
