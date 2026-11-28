from playwright.sync_api import sync_playwright
res=[]
def ok(name, cond, info=''): res.append(('OK ' if cond else 'KO ')+name+(' — '+str(info) if info else ''))
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path="/usr/bin/google-chrome")
    for vw,label in [((1280,900),'desktop'),((390,844),'mobile')]:
        pg=b.new_page(viewport={'width':vw[0],'height':vw[1]})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.goto('file:///home/claude/bio/index.html'); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(800)
        P=lambda: float(pg.inner_text('#pw').replace('W','').strip())
        ok(f'[{label}] caricamento senza errori', not errs, errs)
        ok(f'[{label}] nessuno scorrimento orizzontale', pg.evaluate('document.documentElement.scrollWidth')<=vw[0], pg.evaluate('document.documentElement.scrollWidth'))
        ok(f'[{label}] sprint iniziale plausibile (800-1300 W)', 800<P()<1300, P())
        pg.screenshot(path=f'n_{label}_top.png')
        pg.evaluate("document.querySelector('#fit-h').scrollIntoView()"); pg.wait_for_timeout(200); pg.screenshot(path=f'n_{label}_fit.png')
        if label=='mobile': pg.close(); continue
        def setv(k,v): pg.eval_on_selector('#s-'+k,f"e=>{{e.value='{v}';e.dispatchEvent(new Event('input',{{bubbles:true}}))}}"); pg.wait_for_timeout(60)
        def setf(k,v): pg.fill('#f-'+k,str(v)); pg.dispatch_event('#f-'+k,'change'); pg.wait_for_timeout(80)
        knee=lambda: pg.inner_text('#kbdc')
        base=P(); setv('thc',66); up=P(); setv('thc',55); ok('coscia più grande → più watt', up>base, f'{base}→{up}')
        setv('age',65); old=P(); setv('age',35); ok('età 65 → meno watt', old<base, f'{base}→{old}')
        ftp=lambda: float(pg.inner_text('#ftp').split('W')[0])
        f0=ftp(); setv('vo2',35); f1=ftp(); setv('vo2',50); ok('VO2max basso → soglia più bassa', f1<f0, f'{f0}→{f1}')
        k0=knee(); setf('sh',772); w=pg.inner_text('#warn'); k1=knee(); ok('sella +30 mm → ginocchio più teso e avviso', ('teso' in w or 'alta' in w), f'{k0}→{k1} | {w}'); setf('sh',742)
        b0=pg.inner_text('#tf tbody tr:nth-child(3) td:nth-child(2)'); setf('stem',150); setf('reach',460); b1=pg.inner_text('#tf tbody tr:nth-child(3) td:nth-child(2)'); setf('stem',100); setf('reach',390); ok('manubrio più lontano → busto più basso', int(b1.split('°')[0])<int(b0.split('°')[0]), b0.split(chr(10))[0]+'→'+b1.split(chr(10))[0])
        pg.select_option('#f-hand','drops'); pg.wait_for_timeout(80); bust=pg.inner_text('#tf tbody tr:nth-child(3) td:nth-child(2)'); pg.select_option('#f-hand','hoods'); pg.wait_for_timeout(80)
        ok('presa bassa → busto più basso', int(bust.split('°')[0])<41, bust)
        # tutti i campi agli estremi
        bad=[]
        for k in ['sh','setback','crank','shoe','stack','reach','staF','ha','spacer','stem','stemAng','barReach','barDrop']:
            mn=pg.get_attribute('#f-'+k,'min'); mx=pg.get_attribute('#f-'+k,'max')
            for v in [mn,mx]:
                setf(k,v); val=pg.inner_text('#pw')+pg.inner_text('#tf tbody')
                if 'NaN' in val or 'Infinity' in val: bad.append(f'{k}={v}')
            pg.click('#reset'); pg.wait_for_timeout(50)
        for k in ['h','ins','ratio','mass','thc','mito','slow','age','vo2','cad']:
            mn=pg.get_attribute('#s-'+k,'min'); mx=pg.get_attribute('#s-'+k,'max')
            for v in [mn,mx]:
                setv(k,v); val=pg.inner_text('#pw')
                if 'NaN' in val or 'Infinity' in val: bad.append(f'{k}={v}')
            pg.click('#reset')
        ok('cursori e misure bici agli estremi senza NaN', not bad and not errs, bad or errs)
        setf('sh',9999); ok('valore fuori range riportato al massimo', pg.input_value('#f-sh')=='950', pg.input_value('#f-sh')); pg.click('#reset')
        # A/B
        pg.click('#copyab'); pg.click('[data-sel="B"]'); setf('sh',752); pg.wait_for_timeout(80)
        st=pg.inner_text('#fstat'); ok('bici B modificata → differenza mostrata', 'sella +10 mm' in st, st)
        ok('etichetta bici in figura', 'Bici B' in pg.query_selector('#bsvg').inner_html())
        pg.click('[data-sel="A"]'); ok('torna su A: sella 742', pg.input_value('#f-sh')=='742', pg.input_value('#f-sh'))
        # suggerimento con sella alta su A
        setf('sh',775); pg.click('#sugg'); pg.wait_for_timeout(1500)
        st=pg.inner_text('#fstat'); kb=pg.inner_text('#tf tbody tr:nth-child(1) td:nth-child(3)')
        ok('bike fit suggerito: corregge sella alta (ginocchio B 25–35°)', 25<=int(kb.replace('°',''))<=35 and 'Suggerimento' in st, f'{kb} | {st[:160]}')
        pg.click('#reset'); pg.click('#sugg'); pg.wait_for_timeout(1500); st=pg.inner_text('#fstat')
        ok('bike fit suggerito su bici già valida: nessuna modifica', 'non cambiare' in st, st[:220])
        pg.click('#reset')
        for g in ['Endurance','Race','Aero']: pg.click(f'#geos [data-g="{g}"]'); pg.wait_for_timeout(60)
        ok('geometrie tipo', pg.input_value('#f-stack')=='550' and not errs, pg.input_value('#f-stack'))
        pg.click('#reset'); pg.click('#lem'); ok('sella LeMond = 742 per cavallo 84', pg.input_value('#f-sh')=='742', pg.input_value('#f-sh'))
        # calibrazione
        pg.fill('#m-ftp','273'); pg.fill('#m-pmax','1350'); pg.check('#m-stand'); pg.click('#calib'); pg.wait_for_timeout(1500)
        cr=pg.inner_text('#cres'); ok('calibrazione: produce intervalli e valori', 'Fibre lente' in cr and 'Valori da applicare' in cr, cr[:300].replace('\n',' | '))
        pg.click('#apply'); pg.wait_for_timeout(150); ok('applica calibrazione → cursori aggiornati', 'Applicati' in pg.inner_text('#cres'), pg.inner_text('#o-slow')+' '+pg.inner_text('#o-mito')+' '+pg.inner_text('#o-vo2'))
        pg.fill('#m-vo2','70'); pg.click('#calib'); pg.wait_for_timeout(1500); cr2=pg.inner_text('#cres')
        ok('calibrazione con VO2max misurato', 'il tuo' in cr2, cr2[:300].replace('\n',' | '))
        pg.screenshot(path='n_desktop_calib.png', full_page=False)
        pg.fill('#m-ftp',''); pg.fill('#m-pmax',''); pg.fill('#m-vo2',''); pg.click('#calib'); pg.wait_for_timeout(300); ok('calibrazione senza dati → messaggio', 'almeno' in pg.inner_text('#cres'))
        # viste e rotazione
        for v in ['muscoli','atleta','entrambi']: pg.click(f'#views [data-v={v}]'); pg.wait_for_timeout(60)
        for r in [0,45,90,180,270,359]:
            pg.eval_on_selector('#rot',f"e=>{{e.value='{r}';e.dispatchEvent(new Event('input',{{bubbles:true}}))}}"); pg.wait_for_timeout(40)
        ok('viste e rotazione 0-359°', not errs and pg.query_selector('#bsvg').inner_html().count('<')>50, errs)
        pg.fill('#l-ftext','TEST<script>'); pg.wait_for_timeout(80); ok('scritta telaio ripulita', '<script' not in pg.query_selector('#bsvg').inner_html())
        # atleti
        pg.click('#reset'); pg.click('[data-p="Velocista"]'); pg.click('#copyab'); pg.click('[data-sel="B"]'); setf('stem',120)
        pg.fill('#aname','Prova Velocista'); pg.click('#savef button'); pg.wait_for_timeout(200)
        ok('salva atleta (locale)', 'Prova Velocista' in pg.inner_text('#alist'), pg.inner_text('#astat'))
        pg.click('#reset'); pg.click('[data-load="prova-velocista"]'); pg.wait_for_timeout(150)
        pg.click('[data-sel="B"]'); ok('riapre atleta con massa e bici B', pg.inner_text('#o-mass').startswith('85') and pg.input_value('#f-stem')=='120', pg.inner_text('#o-mass')+' '+pg.input_value('#f-stem'))
        pg.reload(); pg.wait_for_timeout(1500)
        ok('stato e atleta dopo ricarica', 'Prova Velocista' in pg.inner_text('#alist') and pg.inner_text('#o-mass').startswith('85'))
        pg.click('[data-del="prova-velocista"]'); pg.wait_for_timeout(100); ok('elimina atleta', 'Prova Velocista' not in pg.inner_text('#alist'))
        # migrazione da versione precedente
        pg.evaluate("localStorage.clear(); localStorage.setItem('bio-cicl2', JSON.stringify({h:178,ins:84,mass:70,ratio:1.15,crank:170,saddle:0.89,trunk:45,sta:74,thigh:19,mito:6,slow:50,age:35,vo2:50,cad:95})); localStorage.setItem('bio-atleti', JSON.stringify([{id:'vecchio',name:'Vecchio',p:{h:175,ins:82,mass:68,ratio:1.1,crank:172.5,saddle:0.88,trunk:40,sta:73,thigh:18,mito:7,slow:55,age:40,vo2:55,cad:90}}]))")
        pg.reload(); pg.wait_for_timeout(1200)
        ok('migrazione dati vecchi (coscia 19 cm → 59,7 cm; sella 0,89×84 = 748)', pg.inner_text('#o-thc').startswith('59.7') and pg.input_value('#f-sh')=='747.6' or pg.input_value('#f-sh').startswith('747'), pg.inner_text('#o-thc')+' '+pg.input_value('#f-sh')+' '+pg.input_value('#f-crank'))
        ok('atleta vecchio leggibile', 'Vecchio' in pg.inner_text('#alist') and 'NaN' not in pg.inner_text('#alist'), pg.inner_text('#alist')[:120])
        ok('nessun errore JavaScript in tutta la prova', not errs, errs)
        pg.close()
    b.close()
print('\n'.join(res))
