# Banco biomeccanico ciclista: istruzioni e stato per Claude Code

Questo file sostituisce la memoria della chat di claude.ai, che Claude Code in VS Code non vede.
Aggiornalo alla fine di ogni sessione di lavoro, sezione "Stato", così si può riprendere da qualsiasi parte.

## Chi e come
- Utente: Jean, anestesista (fisiologia nota; i termini di ingegneria e informatica vanno spiegati in parole semplici).
- Lingua: italiano.
- Ogni parte tecnica ha un riassunto per non tecnici.
- Non inserire cose non sicure: dichiarare limiti ed errori, e distinguere ciò che è sicuro e testato da ciò che è stimato.
- Errori: riconoscerli subito, senza troppe spiegazioni.

## Regole sui dati (decise da Jean)
- Strava: escludere SOLO le uscite indoor (VirtualRide/Zwift) di marzo–maggio 2021. Nessun altro dato si esclude senza chiederlo a Jean.
- Un dato che sembra anomalo si segnala e si chiede, non si scarta.
- Nelle analisi potenza-cadenza si escludono i dati senza cadenza. Il 1375 W del 28/05/2021 è vero ma senza cadenza, quindi escluso. Sprint di riferimento: 1356 W del 13/07/2026 (in piedi, partenza quasi da fermo, picco 1412 W a 99–109 rpm).
- I suoi sprint da ~1350 W sono in piedi: non confrontarli con lo sprint da seduto del modello senza dirlo. Negli studi in piedi si fa il 3–7% in più.
- Altri dati di Jean: ora 274 W (16/05/2026), FTP circa 273 W. Circonferenza della coscia, VO2max reale ed età precisa non ancora forniti.
- Licenza Strava API (dall'11/11/2024): i dati si mostrano solo all'utente stesso; vietato usarli per addestrare modelli di IA/ML. I modelli di popolazione si addestrano su GoldenCheetah OpenData.
- Dati sanitari (GDPR art. 9): finché i calcoli restano nel browser non si conserva nulla.
- Niente marchi, livree o loghi reali: solo loghi caricati dall'utente. (Le geometrie pubblicate dei telai, es. Canyon, sono dati tecnici, non loghi.)
- Si pubblica (push su GitHub) solo quando Jean lo dice.

## Metodo (ordine concordato)
1. Parametri con fonte.
2. Sensibilità.
3. Confronto con dati reali.
4. Identificabilità.
5. Solo dopo: grafo causale e DoWhy, su dati di popolazione.

Prima di ogni passo dire in una riga cosa si fa; alla fine dire cosa è sicuro, cosa è stimato e cosa non funziona.

## File (dal 28/11/2026 la versione di riferimento è quella GitHub)
- `index.html`: pagina completa, contiene il nucleo di calcolo `const MODEL = (() => {…})()` (usato anche dai test in Node tramite `test/load-model.js`). Si modifica direttamente: non c'è più un passo di costruzione.
- `bike3d.js`: ciclista e bici in 3D (Three.js 0.160 da jsDelivr).
- `teoria.html`: teoria, metodo, validazione, bibliografia.
- `test/`: test del modello in Node (profili-pro, taratura, sprint-validazione, bikefit-ottimo, allena, …), analisi Python (DoWhy, GoldenCheetah, OpenSim), e `test/ui_test.py`: test Playwright della pagina (35 controlli, desktop e telefono). Per lanciarlo: `python -m http.server 8765 --bind 127.0.0.1` nella cartella del progetto, poi `.venv/Scripts/python test/ui_test.py` (Chrome in `C:/Program Files/Google/Chrome/Application/chrome.exe`, oppure passare il percorso come secondo argomento).
- `archivio-v05/`: la v0.5 costruita nella chat di claude.ai (`template.html`, `model.js`, `fulltest2.py`), conservata solo come riferimento. Il suo modello è più vecchio: le sue funzioni utili sono state portate in `index.html`.
- `SPECS.md`, `OBIETTIVI.md`: specifiche e obiettivi.
- Sito: https://maximog01.github.io/banco-biomeccanico/ (GitHub `MaximoG01/banco-biomeccanico`, Pages da `main`).
- Versione su Claude (privata, v0.5, con archivio atleti condiviso): https://claude.ai/artifact/HGoXSSpQ7K4zKyUPjvfFyz — NON aggiornata con il modello attuale.
- Documento "Metodo e validazione": https://claude.ai/artifact/JJKHGY3XwoQeyJe2JwgUHi (riferito alla v0.5).
- Su GitHub Pages `claude.use('db')` non esiste: gli atleti si salvano in localStorage, nel codice `cfg1-…` e in file JSON/CSV.

## Modello (versione GitHub, novembre 2026)
- **Geometria**: gamba e piede rigido, 72 posizioni della pedivella.
  - Sella dalle misure di bike fit in mm: altezza lungo il tubo sella dal centro del movimento centrale, arretramento della punta, angolo del tubo sella del telaio; ossa ischiatiche 150 mm dietro la punta (stima dichiarata, presa dalla v0.5). Il centro dell'anca è 0,033 × altezza sopra l'appoggio.
  - Piede: suola media 27° punta in giù, ±21° lungo il giro (marker di calcagno e 1° metatarso, 16 ciclisti di Clancy 2023); il tallone sale di 1,3° ogni 10 rpm (Moco).
  - Bici reale: stack, reach, sterzo, spessori, attacco, reach e drop del manubrio, mani (leve, presa bassa, parte alta) → inclinazione del busto (busto 0,288 × H, braccio con gomito a 20°, Winter).
- **Muscoli di Hill**: 8 gruppi; tendine elastico con passo implicito; controllo a sforzo minimo (come Moco J1) con peso e inerzia delle gambe; fibre lente per muscolo (Johnson 1973, come nel modello OpenSim di Clancy); vmax 5/15 lunghezze/s (10 per una fibra mista, come OpenSim). Età: forza −0,15%/anno (la perdita di muscolo è già nella coscia), velocità −0,4%/anno.
- **Soglia** = VO2max × massa × 20,9 × efficienza lorda × frazione sostenibile (mitocondri, fibre lente, reclutamento delle veloci); riserva periferica di O2 ×2. Cinque costanti tarate su 13 obiettivi: 5 profili su 5 nel range.
- **Sprint**: potenza massima sul giro a 100–130 rpm; validato su Martin 1997/2001, Dorel 2005, Gardner 2007 (cadenza ottimale entro pochi rpm, coppia massima 268 contro 266 N·m).
- **Curva di potenza** 1 s – 60 min: modello omni-dominio (Puchowicz 2020), percentili di 372 ciclisti GoldenCheetah; W′ dalla popolazione (poco prevedibile, R² 0,12).
- **Validazione su Clancy 2023**: coppia sul pedale nei 5 ciclisti di test errore 20%, forma r 0,98–0,99, ginocchio 3,2° RMS; DoWhy sulla cadenza: 5 muscoli su 8 nel verso giusto.
- **Bike fit**: "Trova l'assetto più efficiente" cerca altezza sella e arretramento (mm), pedivella e tacchetta entro i limiti (ginocchio in basso 30–40°, in alto ≤122°, anca ≥45°, caviglia 15–35°, ginocchio sul pedale ±2 cm, pedivella 19–21% della gamba) e ricalcola attacco e spessori per mantenere il busto. Più pulsante "Sella da formula LeMond" e guida alle misure.
- **Calibrazione sui dati dell'atleta** ("I tuoi dati"): fibre lente dallo sprint (da seduto del modello entro ±5%; sprint in piedi ÷ 1,03–1,07); con VO2max misurato i mitocondri dalla soglia (±5%); senza, il VO2max necessario per mitocondri 4,5/6/7,5/9% (non separabili); se la soglia non si raggiunge lo dice. Si mostrano sempre intervalli.

## Stato (28/11/2026)
- **Unione fatta** (su richiesta di Jean): le funzioni della v0.5 (misure bici in mm, mani e drop, LeMond, guida alle misure, calibrazione sui dati) sono nella versione GitHub, sul modello validato e con il 3D. Il confronto A/B resta quello della pagina ("Fissa A", poi B = assetto attuale). La v0.5 è in `archivio-v05/`.
- **Test**: `test/ui_test.py` 35/35; test del modello in Node invariati (profili 5/5).
- **Prova con i dati di Jean** sul modello attuale (corpo predefinito: 178 cm, cavallo 84, 72 kg, coscia 55 cm, NON sono le sue misure; FTP 273, sprint 1356 in piedi): fibre lente 10–30%; con così poche fibre lente la soglia si raggiunge solo con VO2max 81–90, e con mitocondri 4,5% non si raggiunge (limite muscolare). Il risultato non è credibile finché mancano le sue misure vere: è la prova che la coscia e la massa contano.
- **Stimato, non misurato**: ossa ischiatiche 150 mm dietro la punta, braccio e busto da Winter, fattore in piedi 1,03–1,07, costanti della soglia, parametri dei singoli muscoli.
- **Non funziona ancora bene**: vasti troppo carichi (55% contro 32% in OpenSim); ischiocrurali, retto femorale e tibiale nel verso sbagliato con la cadenza; sprint in piedi non meccanicistico.

## Prossimi passi
1. Misure vere di Jean (altezza, cavallo, massa, età, circonferenza della coscia) e calibrazione. Test fissato prima: senza ritoccare altro, il banco deve stare entro ±10% dei suoi watt (sprint da seduto stimato dai 1356 W in piedi; ora 273 W).
2. Gruppi muscolari in più (capo breve del bicipite femorale, grande adduttore) per vasti e ischiocrurali.
3. Sprint in piedi calcolato davvero: peso del corpo, trazione delle braccia.
4. Caricamento di file FIT/CSV nel browser per la curva di potenza personale.
5. Lingue ES/EN/CA/IT.
6. Fase 3: potenziale in base al volume di allenamento, grafo causale e DoWhy su GoldenCheetah.

Domanda aperta per Jean: un preset "Pro da grandi giri" (fibre lente 70–80%, mitocondri 9–10%)?
