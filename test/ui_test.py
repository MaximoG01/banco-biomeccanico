"""Prova automatica della pagina (Playwright): carica index.html servito da un server locale e controlla
interfaccia, direzione degli effetti, misure della bici in mm, A/B, assetto più efficiente, calibrazione, atleti e migrazione.
Uso: python -m http.server 8765 --bind 127.0.0.1   (nella cartella del progetto, in un altro terminale)
     python test/ui_test.py [url] [percorso di chrome]
"""
import sys, re
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding="utf-8")
URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/index.html"
CHROME = sys.argv[2] if len(sys.argv) > 2 else "C:/Program Files/Google/Chrome/Application/chrome.exe"
res = []
def ok(name, cond, info=""): res.append(("OK " if cond else "KO ") + name + (" — " + str(info) if info != "" else ""))
num = lambda s: float(re.sub(r"[^\d,.\-−]", "", s).replace("−", "-").replace(",", "."))

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    for vw, label in [((1280, 900), "desktop"), ((390, 844), "telefono")]:
        pg = b.new_page(viewport={"width": vw[0], "height": vw[1]})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(4000)
        ftp = lambda: num(pg.inner_text("#pw"))                    # soglia in W/kg
        ftpw = lambda: num(pg.inner_text("#wkg"))                  # soglia in W
        spr = lambda: num(pg.inner_text("#ftp").split("W")[0])     # sprint in W
        ok(f"[{label}] caricamento senza errori", not errs, errs)
        ok(f"[{label}] nessuno scorrimento orizzontale", pg.evaluate("document.documentElement.scrollWidth") <= vw[0], pg.evaluate("document.documentElement.scrollWidth"))
        ok(f"[{label}] soglia e sprint plausibili", 2.5 < ftp() < 4.5 and 800 < spr() < 1400, f"{ftp()} W/kg, {spr()} W")
        if label == "telefono": pg.close(); continue
        ok("3D attivo", pg.evaluate("document.querySelector('#bike').classList.contains('has3d')"))
        pg.evaluate("document.querySelectorAll('details.adv').forEach(d => d.open = true)")
        def setv(k, v):  # scrive il valore e conferma (calcolo immediato)
            pg.fill("#s-" + k, str(v)); pg.dispatch_event("#s-" + k, "change"); pg.wait_for_timeout(50)
        def row(label):  # cella della colonna attuale nella tabella del bike fit
            return pg.evaluate("l => { for (const tr of document.querySelectorAll('#tfit tbody tr')) if (tr.cells[0].textContent.startsWith(l)) return tr.cells[2].textContent; return ''; }", label)
        reset = lambda: (pg.click("#reset"), pg.wait_for_timeout(300))
        s0 = spr(); setv("thigh", 66); s1 = spr(); setv("thigh", 55); ok("coscia più grande → più sprint", s1 > s0, f"{s0} → {s1}")
        setv("age", 65); s2 = spr(); setv("age", 35); ok("età 65 → meno sprint", s2 < s0, f"{s0} → {s2}")
        f0 = ftpw(); setv("vo2", 35); f1 = ftpw(); ok("VO₂max basso → soglia più bassa", f1 < f0, f"{f0} → {f1}")
        setv("vo2", 40); a = ftpw(); setv("vo2", 80); c = ftpw(); setv("vo2", 50); ok("VO₂max ×2 → soglia ×1,7–2,0", 1.7 < c / a < 2.0, f"×{c / a:.2f}")
        k0 = num(pg.inner_text("#kbdc")); setv("sh", 772); k1 = num(pg.inner_text("#kbdc")); w = pg.inner_text("#warn")
        ok("sella +30 mm → ginocchio più teso e avviso", k1 < k0 - 8 and ("teso" in w or "alta" in w), f"{k0}° → {k1}° | {w}"); setv("sh", 742)
        setv("sh", 700); pg.click("#lemond"); pg.wait_for_timeout(300); ok("sella LeMond = 742 mm per cavallo 84", pg.input_value("#s-sh") == "742", pg.input_value("#s-sh"))
        t0 = num(row("Inclinazione busto")); setv("stem", 140); setv("freach", 440); t1 = num(row("Inclinazione busto")); setv("stem", 100); setv("freach", 393)
        ok("manubrio più lontano → busto più basso", t1 < t0, f"{t0}° → {t1}°")
        pg.select_option("#s-hand", "1"); pg.dispatch_event("#s-hand", "change"); tb = num(row("Inclinazione busto"))
        setv("bard", 150); tb2 = num(row("Inclinazione busto")); setv("bard", 125)
        pg.select_option("#s-hand", "2"); pg.dispatch_event("#s-hand", "change"); tt = num(row("Inclinazione busto"))
        pg.select_option("#s-hand", "0"); pg.dispatch_event("#s-hand", "change")
        ok("presa bassa → busto più basso, parte alta → più alto", tb < t0 < tt, f"bassa {tb}°, leve {t0}°, alta {tt}°")
        ok("drop del manubrio maggiore → busto più basso in presa bassa", tb2 < tb, f"{tb}° → {tb2}°")
        # tutti i campi agli estremi: niente NaN
        bad = []
        for k in pg.evaluate("[...document.querySelectorAll('#ctrls input[type=number]')].map(i => i.id.slice(2))"):
            if pg.is_disabled("#s-" + k): continue
            for v in [pg.get_attribute("#s-" + k, "min"), pg.get_attribute("#s-" + k, "max")]:
                setv(k, v); t = pg.inner_text("#pw") + pg.inner_text("#ftp") + pg.inner_text("#tfit tbody")
                if "NaN" in t or "Infinity" in t: bad.append(f"{k}={v}")
            reset()
        ok("tutti i campi agli estremi senza NaN", not bad and not errs, bad or errs)
        setv("sh", 9999); ok("valore fuori range riportato al massimo", pg.input_value("#s-sh") == "950", pg.input_value("#s-sh")); reset()
        # confronto A/B
        pg.click("#fitA"); pg.wait_for_timeout(200); setv("sh", 752)
        d = pg.evaluate("() => { for (const tr of document.querySelectorAll('#tfit tbody tr')) if (tr.cells[0].textContent.startsWith('Altezza sella')) return tr.cells[3].textContent; }")
        ok("A fissato, sella +10 mm → differenza mostrata", "+10" in d, d); pg.click("#fitOff"); reset()
        # assetto più efficiente
        pg.click("#optbtn"); pg.wait_for_function("() => !document.querySelector('#optres').hidden", timeout=120000)
        o = pg.inner_text("#optres"); ok("assetto più efficiente: misure in mm e busto mantenuto", "Altezza sella" in o and "mm" in o and "mantenuta" in o, o[:160].replace("\n", " | "))
        pg.click("#optapply"); pg.wait_for_timeout(300); ok("applica e confronta → A/B in tabella", "A = assetto di partenza" in pg.inner_text("#fitn")); pg.click("#fitOff"); reset()
        pg.click("#frames [data-f*='Endurace']"); pg.wait_for_timeout(300); ok("telaio di esempio Endurace", pg.input_value("#s-fstack") == "584", pg.input_value("#s-fstack")); reset()
        # calibrazione
        pg.click("#calib"); pg.wait_for_timeout(300); ok("calibrazione senza dati → messaggio", "almeno" in pg.inner_text("#cres"))
        pg.fill("#m-ftp", "273"); pg.fill("#m-pmax", "1356"); pg.check("#m-stand"); pg.click("#calib")
        pg.wait_for_function("() => /Cosa si ricava|nessun/.test(document.querySelector('#cres').textContent)", timeout=180000)
        cr = pg.inner_text("#cres"); ok("calibrazione con i dati di Jean: intervalli dichiarati", "Fibre lente" in cr and ("VO₂max compatibile" in cr or "non raggiunta" in cr), cr[:260].replace("\n", " | "))
        sl0 = pg.input_value("#s-slow"); pg.click("#capply"); pg.wait_for_timeout(300)
        ok("applica la calibrazione → fibre lente aggiornate", pg.input_value("#s-slow") != sl0 and "Applicati" in pg.inner_text("#cres"), f"{sl0} → {pg.input_value('#s-slow')}")
        pg.fill("#m-vo2", "62"); pg.click("#calib"); pg.wait_for_function("() => /Mitocondri/.test(document.querySelector('#cres').textContent)", timeout=180000)
        ok("calibrazione con VO₂max misurato → mitocondri", "Mitocondri" in pg.inner_text("#cres"), pg.inner_text("#cres")[:200].replace("\n", " | "))
        reset()
        # viste, rotazione, curva di potenza
        pg.click("#dopen"); pg.wait_for_timeout(300)
        for v in ["muscoli", "atleta", "entrambi"]: pg.click(f"#views [data-v={v}]"); pg.wait_for_timeout(100)
        pg.click("#dclose"); pg.wait_for_timeout(200)
        for r in [0, 90, 180, 270, 359]: pg.eval_on_selector("#rot", f"e => {{ e.value = '{r}'; e.dispatchEvent(new Event('input', {{bubbles: true}})); }}"); pg.wait_for_timeout(60)
        ok("viste e rotazione senza errori", not errs, errs)
        ok("curva di potenza: tabella compilata", pg.evaluate("document.querySelectorAll('#pdtab tbody tr').length") >= 5)
        # atleti salvati sul dispositivo
        setv("mass", 85); setv("stem", 120); pg.fill("#aname", "Prova"); pg.click("#savebtn"); pg.wait_for_timeout(400)
        ok("salva atleta sul dispositivo", "Prova" in pg.inner_text("#llist"))
        pg.reload(); pg.wait_for_timeout(4000); ok("atleta e stato dopo ricarica", "Prova" in pg.inner_text("#llist") and pg.input_value("#s-mass") == "85")
        reset(); pg.click("[data-lload]"); pg.wait_for_timeout(500); ok("riapre atleta con massa e attacco", pg.input_value("#s-mass") == "85" and pg.input_value("#s-stem") == "120", pg.input_value("#s-mass") + " " + pg.input_value("#s-stem"))
        pg.on("dialog", lambda d: d.accept()); pg.click("[data-ldel]"); pg.wait_for_timeout(400); ok("elimina atleta", "Prova" not in pg.inner_text("#llist"))
        # codice condivisibile con le misure in mm
        setv("sh", 760); setv("setback", 40); code = pg.input_value("#ccode"); reset(); pg.fill("#cin", code); pg.click("#cimp button"); pg.wait_for_timeout(500)
        ok("codice atleta: riapre sella e arretramento in mm", pg.input_value("#s-sh") == "760" and pg.input_value("#s-setback") == "40", pg.input_value("#s-sh") + " " + pg.input_value("#s-setback"))
        # migrazione da salvataggi con la sella in × cavallo
        pg.evaluate("localStorage.clear(); localStorage.setItem('bio-cicl3', JSON.stringify({h:178,ins:84,mass:70,ratio:1.15,crank:170,saddle:0.89,trunk:45,sta:74,thigh:19,mito:6,slow:50,age:35,vo2:50,cad:95}))")
        pg.goto(URL); pg.wait_for_timeout(4000)
        ok("migrazione: sella 0,89 × 84 a 74° → circa 750 mm e 56 mm", abs(float(pg.input_value("#s-sh")) - 750) <= 2 and abs(float(pg.input_value("#s-setback")) - 56) <= 2, pg.input_value("#s-sh") + " " + pg.input_value("#s-setback"))
        ok("nessun errore JavaScript in tutta la prova", not errs, errs)
        pg.close()
    b.close()
print("\n".join(res)); print(f"\n{sum(r.startswith('OK') for r in res)} su {len(res)} controlli superati")
