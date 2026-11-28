# Banco biomeccanico ciclista — Specifiche

Versione: 0.4 · 28/11/2026 (pagina v0.5) · Autore: Jean (con Claude)
Stato attuale online: https://maximog01.github.io/banco-biomeccanico/ (versione di riferimento). Versione v0.5 su Claude: https://claude.ai/artifact/HGoXSSpQ7K4zKyUPjvfFyz
Documento di metodo e validazione: https://claude.ai/artifact/JJKHGY3XwoQeyJe2JwgUHi

---

## 1. Scopo

Uno strumento per ciclisti che parte da **ciò che l'atleta conosce davvero** (dati Garmin/Strava, antropometria, misure della bici) e restituisce:

1. un'**ottimizzazione biomeccanica della bici**, con il confronto in watt e angoli;
2. una **stima dei valori mancanti** (es. VO₂max, FTP, potenza massima), con il loro margine d'errore, oppure le istruzioni per misurarli;
3. una **stima del potenziale** in base al volume e al tipo di allenamento attuale (fase successiva, serve un modello su dati di molti ciclisti);
4. **indicazioni generali sul tipo di allenamento** (fase successiva).

I parametri "nascosti" (fibre lente, densità mitocondriale) servono **solo internamente** al modello e si mostrano come **intervalli**, mai come misure.

### Non-obiettivi (per ora)
- Non è un bike fit professionale né uno strumento diagnostico.
- Non stima con precisione la composizione del muscolo di un singolo atleta.
- Non usa dati Strava ottenuti via API per addestrare modelli (vietato dai termini Strava, vedi §8).

---

## 2. Cambio di direzione (decisione del 28/11/2026)

**Prima:** il modello partiva da parametri del muscolo non noti (fibre, mitocondri) e stimava watt e FTP.
**Ora:** il modello si **calibra sull'atleta** partendo dai dati misurati (FTP, potenza massima, VO₂max se nota, antropometria) e ricava i parametri non noti come intervalli compatibili.

Motivo: i parametri del muscolo non sono noti all'atleta e, con i soli watt, non sono identificabili (vedi documento di metodo, sezione identificabilità).

---

## 3. Input

Ogni input ha: definizione, come si misura, unità, se è obbligatorio, e se il modello lo può stimare quando manca.

### 3.1 Prestazione (da Garmin/Strava o test)
| Input | Definizione | Unità | Obbligatorio | Se manca |
|---|---|---|---|---|
| FTP | potenza sostenibile circa 1 h (o 95% dei 20 min, convenzione da dichiarare) | W | consigliato | stimabile da 20 min o da VO₂max, con errore dichiarato |
| Potenza massima | picco 5 s, con indicazione **seduto / in piedi** | W | consigliato | non stimabile in modo affidabile → istruzioni per un test |
| Potenza 5 min | massimo 5 min | W | opzionale | serve per stimare VO₂max |
| VO₂max | da laboratorio o stima del dispositivo (indicare quale) | mL/kg/min | opzionale | stimabile da potenza (equazioni pubblicate, errore dichiarato) |
| Cadenza del picco | cadenza alla potenza massima | rpm | opzionale | — |

Regole dati: si escludono dalle analisi potenza-cadenza i dati senza cadenza; un dato anomalo si segnala e si chiede, non si scarta (vedi skill biomeccanica).

### 3.2 Antropometria
| Input | Come si misura | Unità |
|---|---|---|
| Altezza | in piedi, scalzo | cm |
| Massa | mattino, a digiuno | kg |
| Età | — | anni |
| Cavallo | scalzo, libro tra le gambe spinto verso l'alto, dal bordo del libro al pavimento | cm |
| Circonferenza coscia | in piedi, rilassato, a metà tra piega inguinale e bordo superiore della rotula, metro aderente | cm |
| Lunghezza coscia (opzionale) | dal grande trocantere all'interlinea articolare laterale del ginocchio | cm |
| Sesso | per le equazioni di stima | — |

### 3.3 Bici (misure standard da bike fitting)
| Input | Definizione | Unità |
|---|---|---|
| Altezza sella | dal centro del movimento centrale alla superficie della sella, lungo il tubo sella | mm |
| Arretramento sella | distanza orizzontale tra punta della sella e verticale del movimento centrale | mm |
| Pedivella | lunghezza stampata sulla pedivella | mm |
| Stack, reach | dalla tabella geometrie del telaio | mm |
| Angolo tubo sella | dalla tabella geometrie | ° |
| Attacco manubrio | lunghezza (mm) e angolo (°) | mm, ° |
| Spessori sotto l'attacco | — | mm |
| Reach e drop del manubrio | dalla scheda del manubrio | mm |
| Spessore scarpa + tacchetta + pedale | dal centro del perno pedale alla pianta del piede | mm |

### 3.4 Allenamento (fase 3)
Ore/settimana di ciclismo, ore di altri sport, km/mese, anni di pratica, livello. Inserimento manuale o da file esportati dall'utente (FIT/CSV), elaborati nel browser.

---

## 4. Output

### 4.1 Biomeccanica (fase 1)
- Angolo del ginocchio al punto morto inferiore, angolo minimo dell'anca, inclinazione del busto (calcolata da bici + braccia, non più un cursore), ginocchio rispetto al pedale a ore 3, dislivello e distanza sella–manubrio.
- Watt di sprint (seduto, poi anche in piedi) e di soglia.
- **Confronto Bici A / Bici B** con differenze in angoli e watt.
- **Pulsante "Bike fit suggerito"**: regola altezza e arretramento della sella (e opzionalmente l'attacco) dentro intervalli di bike fitting citati con fonte, scegliendo la configurazione con i watt migliori. Sempre presentato come punto di partenza da provare a piccoli passi.

### 4.2 Valori mancanti (fase 1–2)
- VO₂max stimato da potenza, con equazione e errore dichiarati.
- FTP stimata (se manca) da 20 min o VO₂max, con errore dichiarato.
- Se un valore non è stimabile: istruzioni per il test (es. sprint di 6 s a cadenze diverse, test a rampa).

### 4.3 Parametri interni (fase 1–2)
- Fibre lente e densità mitocondriale come **intervalli compatibili** con i dati, mai come valori puntuali, con una nota su quanto sono incerti.

### 4.4 Potenziale e allenamento (fase 3)
- Potenziale atteso in base a profilo e volume, da un modello addestrato su dati aperti di molti ciclisti.
- Indicazioni generali, senza pretese mediche.

---

## 5. Architettura del modello

| Modulo | Cosa fa | Stato |
|---|---|---|
| Geometria e cinematica | dalle misure di bici e corpo a posizione di anca, ginocchio, caviglia, mani in 72 posizioni della pedivella | esiste (2D), da convertire alle misure standard |
| Muscolare (Hill) | 8 gruppi muscolari, forza-lunghezza e forza-velocità, potenza concentrica | esiste; parametri muscolari da sostituire con Ward 2009 / Arnold 2010 |
| Massa muscolare | da circonferenza e lunghezza della coscia (volume ∝ circonferenza² × lunghezza) | esiste con diametro; da passare a circonferenza + lunghezza |
| Aerobico | VO₂ limitato dal minore tra trasporto (VO₂max × massa) e capacità dei mitocondri; efficienza lorda | esiste; da ricalibrare |
| Sprint in piedi | peso del corpo e trazione delle braccia | da fare |
| **Calibrazione inversa** | dai dati misurati (FTP, potenza massima, VO₂max, coscia) agli intervalli dei parametri non noti | da fare |
| Bike fit | intervalli di riferimento con fonti + ottimizzazione vincolata | da fare |
| Potenziale | modello statistico su GoldenCheetah OpenData; grafo causale e DoWhy qui | fase 3 |

Tutti i calcoli delle fasi 1–2 avvengono **nel browser dell'utente**: nessun dato personale viene inviato a un server.

---

## 6. Validazione e criteri di accettazione

1. **Parametri con fonte**: ogni numero del modello ha una fonte o l'etichetta "stimato" (tabella nel documento di metodo).
2. **Sensibilità**: si ripete dopo ogni modifica del modello.
3. **Test di Jean** (regola fissata prima di guardare il risultato): inserite circonferenza coscia, età e VO₂max, senza ritoccare altro, il banco deve stare entro **±10%** di:
   - sprint seduto stimato da quello in piedi (1356 W del 13/07/2026, meno 3–7% per la posizione in piedi);
   - potenza di 1 ora (273 W, 16/05/2026).
4. **Validazione esterna**: angoli e direzione della forza sul pedale contro lo studio Stanford cycling_sim (16 soggetti); efficienza contro Coyle/Horowitz.
5. **Identificabilità**: si dichiara per ogni parametro interno se è stimabile, e con che intervallo.
6. **Test automatici** dell'interfaccia (oggi 24 controlli) a ogni rilascio.

---

## 7. Stato: sicuro / stimato / mancante (28/11/2026)

| Sicuro e testato | Stimato | Mancante |
|---|---|---|
| Interfaccia (34 controlli automatici, pagina v0.5), geometria della gamba, direzione degli effetti, misure bici standard con confronto A/B, calibrazione inversa (intervalli), migrazione dei dati salvati | Parametri dei singoli muscoli, effetto età, efficienza, soglia, passaggio coscia → massa, posizione dell'anca sulla sella (HIPUP 0,022), busto/braccio (0,30/0,38 × altezza), riferimenti di anca e busto (esperienza dei fitter) | Sprint in piedi meccanicistico (oggi solo ÷1,03–1,07), posizione da crono, parametri Ward/Arnold, validazione esterna, circonferenza coscia reale di Jean |

Scarti noti: con coscia 55 cm (non misurata) e i dati di Jean (FTP 273, sprint 1350 in piedi) la calibrazione trova fibre lente 25–35%, mitocondri ≥ 6,3–7,0%, VO₂max ≥ 56–62 mL/kg/min: da ripetere con altezza, cavallo, massa e coscia reali.

---

## 8. Vincoli esterni

- **Strava API**: dall'11/11/2024 i dati possono essere mostrati solo all'utente stesso ed è vietato usarli per addestrare modelli di IA/ML; a giugno 2026 nuove restrizioni sulle piattaforme intermediarie. → Il modello del potenziale va addestrato su dati aperti (GoldenCheetah OpenData), non su dati Strava.
- **Garmin**: programma sviluppatori con approvazione (da verificare condizioni).
- **Alternativa senza API**: l'utente carica i propri file esportati (FIT/CSV), elaborati nel browser.
- **Dati sanitari (GDPR art. 9)**: VO₂max, frequenza cardiaca e peso sono dati relativi alla salute. Finché tutto resta nel browser non si conservano dati; con account e server servono consenso esplicito, valutazione d'impatto, cifratura.

---

## 9. Roadmap

| Fase | Contenuto | Dove |
|---|---|---|
| 1 | ✅ Misure bici standard, confronto A/B, bike fit suggerito, input inversi (FTP, potenza massima con flag in piedi, VO₂max, circonferenza coscia), calibrazione inversa, test. Restano: sprint in piedi meccanicistico, parametri muscolari Ward/Arnold, esperimento con/senza simulatore | Claude / VS Code |
| 2 | Sito pubblico statico (GitHub Pages), 4 lingue (ES/EN/CA/IT), configurazione nel link, caricamento file FIT/CSV nel browser | VS Code + GitHub |
| 3 | Modello del potenziale su GoldenCheetah OpenData; grafo causale e DoWhy; indicazioni di allenamento | Python, eventualmente come TFM |
| 4 | Account, server, integrazioni ufficiali, conformità GDPR | richiede team |

---

## 10. Registro decisioni

- 25/11/2026: input da diametro coscia (non fibra); VO₂max come limite centrale; niente marchi o livree reali.
- 26/11/2026: metodo in 4 passi (fonti, sensibilità, validazione, identificabilità) prima di DoWhy; regole dati Strava; sprint di riferimento 1356 W in piedi.
- 28/11/2026: inversione della direzione (dati noti → parametri interni come intervalli); bike fit su misure standard; obiettivi a 4 output (vedi OBIETTIVI.md).
- 28/11/2026 (v0.5): geometria da misure di bike fit (geomFit); riferimento muscolare fisso (posizione standard, non più il primo calcolo); bike fit suggerito = griglia sella ±40 mm × arretramento ±40 mm (+ attacco se manubrio fuori portata), vincoli ginocchio 25–35° e manubrio a portata, punteggio 70% soglia + 30% sprint; se la bici A è già valida cambia solo per guadagni > 1%. Calibrazione: fibre lente dal picco potenza-cadenza (±5%), mitocondri/VO₂max dalla soglia a 90 rpm (±5%), si applicano i valori minimi compatibili. Fonte ginocchio dinamico corretta: Swart e Holliday 2019 (Curr Sports Med Rep, doi 10.1249/JSR.0000000000000665), non Bini.
- 28/11/2026 (unione): la versione GitHub, con il modello validato (tendine implicito, sforzo minimo, Clancy, sprint, GoldenCheetah) e il 3D, diventa quella di riferimento. Dalla v0.5 si portano: sella in mm (altezza lungo il tubo sella, arretramento della punta, angolo del tubo sella del telaio, ossa ischiatiche 150 mm dietro la punta), drop del manubrio e posizione delle mani, pulsante LeMond, guida alle misure, calibrazione sui dati dell'atleta. La v0.5 resta in archivio-v05/. Test della pagina: test/ui_test.py (35 controlli).
