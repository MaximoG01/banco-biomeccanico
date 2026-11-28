# Banco biomeccanico ciclista

Simulatore della pedalata che parte dal corpo, dalla bici e dalla fisiologia e arriva alla **soglia (FTP) in W/kg**. Lo sprint è la potenza massimale alla cadenza migliore.

**Apri la pagina:** https://maximog01.github.io/banco-biomeccanico/ · **Teoria e modello:** https://maximog01.github.io/banco-biomeccanico/teoria.html

È uno strumento didattico e di esplorazione, non un bike fit né una diagnosi.

## Cosa si può fare

- Regolare antropometria, bici (sella, pedivelle, busto, tubo sella), scarpe e pedali (stack, tacchetta, ankling), muscolo e mitocondri, età, VO₂max e cadenza, e vedere subito soglia, efficienza, sprint e angoli articolari.
- Guardare il ciclista animato **in 3D** (busto e testa come superficie continua, pancia e volumi che crescono con la massa grassa, scenario a 360°), con il motore WebGL Three.js caricato dalla rete: si ruota trascinando, in orizzontale e in verticale col mouse. Sono visibili i muscoli attivi e la forza sul pedale, con sfondi (montagna, mare, città, campagna) e colori personalizzabili dal pannello **Personalizza**. Se il browser non supporta WebGL, la pagina torna al disegno 2D.
- Confrontare due assetti (**Bike fit A/B**): la tabella mostra le differenze e i range consigliati, e la figura mostra la gamba di A tratteggiata.
- Seguire nei grafici la coppia lungo il giro, la soglia e lo sprint al variare della cadenza, e la mappa di attivazione dei muscoli.
- **Salvare gli atleti** nel browser e condividerli:
  - **codice atleta** (`cfg1-…`), da incollare nella pagina o da aggiungere al link dopo `#`;
  - **file JSON**, reimportabile, con parametri, aspetto e risultati del modello;
  - **file CSV**, per Excel o Fogli.

## Come funziona il modello

1. **Geometria e piede:** gamba e piede rigido; stack e tacchetta spostano l'asse del pedale, l'ankling muove la suola.
2. **Cinematica inversa:** 72 posizioni della pedivella, angoli anatomici di anca, ginocchio e caviglia.
3. **Muscoli di Hill:** 8 gruppi muscolari con:
   - forza-lunghezza e forza-velocità;
   - bracci di leva che cambiano con l'angolo;
   - tendine elastico in serie;
   - attivazione con ritardo (10 ms in salita, 40 ms in discesa);
   - co-contrazione dei biarticolari.
4. **Soglia:**
   - ossigeno disponibile: VO₂max; i mitocondri possono usarne circa il doppio, quindi il limite è quasi sempre centrale;
   - frazione sostenibile (75–94%): cresce con la densità mitocondriale e le fibre lente, e cala quando la forza per pedalata recluta fibre veloci (principio di Henneman);
   - efficienza lorda: viene da una simulazione della pedalata proprio alla potenza di soglia.
5. **Sprint:** attivazione massimale, massimo tra 100 e 130 rpm (le cadenze tipiche dello sprint).

Cinque costanti globali sono tarate su 13 obiettivi: FTP di profili pubblicati, efficienza e frazione tipiche, cadenza di soglia e due vincoli fisiologici (raddoppiando il VO₂max la soglia quasi raddoppia; il diametro della coscia la sposta appena).

## Validazione

Dettagli completi nella pagina **Teoria e modello** (`teoria.html`).

- **Forze sui pedali di 16 ciclisti misurati** (Clancy et al. 2023): forma della coppia r = 0,96, picco 90° contro 96°, Power Phase 5°→180° contro ≈355°→190° (`test/pedali_opensim.py`).
- **Simulazioni OpenSim Moco** (6 ciclisti): vasti, soleo, gluteo e gastrocnemio con tempi simili (r 0,65–0,86); tibiale anteriore e ischiocrurali ancora diversi (`test/confronto_opensim.py`).
- **Controllo a sforzo minimo** come l'obiettivo J1 di Moco, con il peso delle gambe nell'equilibrio.

| Profilo | FTP modello | Atteso | Fonte |
|---|---|---|---|
| Amatore ricreativo | 2,72 W/kg | 2,3–2,9 | Cycling Weekly |
| Amatore allenato | 3,78 W/kg | 3,2–3,9 | tipico agonista amatore |
| ProTeam | 5,43 W/kg | 5,1–5,7 | studio Vuelta 2020 (media 5,4) |
| WorldTour scalatore | 6,04 W/kg | 5,8–6,4 | studio Vuelta 2020 (media 5,8); Lucía et al. |
| Velocista pro | 4,88 W/kg | 4,8–5,5 | stima |

**Analisi di sensibilità** (DoWhy, 2000 atleti virtuali, `test/`):
- il VO₂max spiega il 73% della variabilità della soglia (+17% per deviazione standard); raddoppiandolo la soglia diventa ×1,87;
- seguono fibre lente (+6%) e densità mitocondriale (+5%); la circonferenza della coscia pesa +3%;
- assetto, pedivelle, tacchette e stack spostano la soglia meno del 2%, in linea con gli studi su pedivelle (Ferrer-Roca) e tacchette.

### Aggiornamento (novembre 2026)

- **Coppia sul pedale, 5 ciclisti di test:** errore 20%, forma r 0,98 (prima 30% e 0,95), dopo il calcolo stabile del tendine, le fibre per muscolo e il piede misurato.
- **Soglia:** 5 profili su 5 nel range (costanti ritarate, errore medio circa 6%).
- **Sprint:** cadenza ottimale entro ±2 rpm da 4 studi di laboratorio (Martin 1997 e 2001, Dorel 2005, Gardner 2007).
- **Curva di potenza** da 1 s a 60 min (modello omni-dominio) con i percentili di 372 ciclisti di GoldenCheetah OpenData (`test/gc_*.py`).
- **Bici reale:** misure di bike fit in mm (altezza sella, arretramento della punta, telaio, attacco, manubrio con reach e drop, posizione delle mani); il busto si calcola dalla bici; il pulsante **Trova l'assetto più efficiente** cerca sella, arretramento, pedivella e tacchetta entro i limiti di bike fit (`test/bikefit-ottimo.js`).
- **I tuoi dati:** dalla soglia e dallo sprint misurati il banco ricava intervalli compatibili di fibre lente, mitocondri e VO₂max.
- **Test della pagina:** `test/ui_test.py` (Playwright, 35 controlli su desktop e telefono).

### Limiti noti

- **Muscoli:** i vasti lavorano troppo; ischiocrurali, retto femorale e tibiale reagiscono alla cadenza nel verso opposto ai dati (DoWhy: 5 muscoli su 8 nel verso giusto).
- **W′** (capacità anaerobica) viene dalla popolazione, non dal modello muscolare.
- **Modello 2D:** niente movimenti laterali del ginocchio né float della tacchetta.

## Analisi riproducibili

```bash
node test/profili-pro.js                  # profili tipo contro valori pubblicati
node test/taratura.js                     # taratura delle costanti globali
node test/power-phase.js                  # power phase del modello
node test/genera-dataset.js 3000 test/dataset.csv
python -m venv .venv && .venv/Scripts/pip install -r test/requirements.txt
.venv/Scripts/python test/dowhy_analisi.py test/dataset.csv
```

## Prossimi passi

- Più gruppi muscolari (capo breve del bicipite femorale, grande adduttore) per correggere ischiocrurali e vasti.
- Importare file .fit/.csv di Garmin e Strava nel browser per la curva di potenza personale; poi un collegamento diretto (richiede un piccolo server per l'autorizzazione).
- Altre geometrie di telai e taglie.

## Fonti principali

- Lucía et al., *Physiology of professional road cycling*, Sports Med 2001; *Inverse relationship between VO₂max and economy/efficiency in world-class cyclists*, MSSE 2002.
- Coyle et al. 1988, 1991, 1992 (soglia, tipo di fibre ed efficienza); Holloszy e Coyle 1984.
- Zajac 1989 (dinamica muscolo-tendine); Barclay 1996, He et al. 2000 (efficienza e velocità).
- Martin e Spirduso 2001; Ferrer-Roca et al. 2017 (lunghezza delle pedivelle).
- Studi sulla posizione della tacchetta (IJSPP 2009; Paton e Jardine 2012).
- OpenSim e progetto cycling_sim di Stanford (Clancy et al. 2023).
