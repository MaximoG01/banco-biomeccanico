# Memo degli obiettivi — Banco biomeccanico ciclista

28/11/2026 · Jean

Questo memo raccoglie **tutti** gli obiettivi dichiarati, anche quelli non ancora fattibili, con lo stato di fattibilità e cosa servirebbe. Le specifiche tecniche sono in SPECS.md.

Legenda: ✅ fattibile ora · 🟡 fattibile con dati o lavoro in più · 🟠 richiede team o competenze esterne · 🔴 bloccato da vincoli esterni

---

## Visione

Uno strumento che, partendo da ciò che un ciclista conosce (dati Garmin/Strava, antropometria, misure della bici), gli restituisca una bici ottimizzata, una stima dei valori che non conosce, il proprio potenziale e indicazioni di allenamento — con limiti e incertezze sempre dichiarati. Interessante sia per studio sia, eventualmente, a scopo commerciale.

---

## Obiettivi per l'atleta

| # | Obiettivo | Stato | Note |
|---|---|---|---|
| A1 | Inserire FTP, potenza massima, VO₂max (anche stimato) | ✅ | input manuale |
| A2 | Inserire antropometria e misure bici standard con riferimenti chiari | ✅ | vedi SPECS §3 |
| A3 | Ottimizzazione biomeccanica con confronto in watt | ✅ | il guadagno in watt dipende da un modello ancora da validare |
| A4 | Stima dei valori mancanti (VO₂max, FTP) | 🟡 | equazioni pubblicate con errore noto; la potenza massima non è stimabile in modo affidabile |
| A5 | Fibre lente e mitocondri del singolo atleta | 🟡 | solo come intervalli; con FTP, VO₂max, potenza massima e coscia si restringono ma non si determinano |
| A6 | Potenziale in base al volume di allenamento | 🟡 | serve un modello su dati di molti ciclisti (GoldenCheetah OpenData) |
| A7 | Indicazioni sul tipo di allenamento | 🟡 | generali e basate su evidenza; non personalizzate in senso medico |
| A8 | Import automatico da Strava/Garmin | 🔴/🟠 | Strava vieta l'uso dei dati API per modelli IA/ML; Garmin richiede approvazione. Alternativa: caricamento dei propri file FIT/CSV nel browser ✅ |

## Obiettivi di metodo

| # | Obiettivo | Stato |
|---|---|---|
| M1 | Modello muscolare e fisiologico corretto e testato | 🟡 in corso |
| M2 | Ogni parametro con fonte o etichetta "stimato" | ✅ fatto per la versione attuale |
| M3 | Calibrazione inversa (dai dati agli intervalli dei parametri) | 🟡 |
| M4 | Grafo causale e DoWhy sul modello del potenziale | 🟡 fase 3 |
| M5 | Metodo riutilizzabile come skill generica per altri studi biomeccanici | 🟡 dopo M1–M3 |

## Obiettivi di prodotto

| # | Obiettivo | Stato | Costo indicativo (stima grezza) |
|---|---|---|---|
| P1 | Pagina pubblica statica (GitHub Pages), calcoli nel browser | ✅ | dominio ~10–20 €/anno |
| P2 | 4 lingue (ES/EN/CA/IT) | ✅ | — |
| P3 | Account privato, server, cifratura | 🟠 | sviluppo: migliaia–decine di migliaia di €; hosting 20–200 €/mese |
| P4 | Uso di dati sanitari per previsioni | 🟠 | consulenza privacy/legale (GDPR art. 9) |
| P5 | Elaborazione ML lato server | 🟠 | come P3 |
| P6 | Valutazione commerciale | aperto | prima validare interesse e accuratezza |

I costi sono ordini di grandezza, non preventivi.

---

## Domande aperte

1. Che accuratezza minima serve perché A4–A6 siano utili? (proposta: dichiarare l'errore e non mostrare valori sotto una soglia di affidabilità)
2. Il progetto può diventare il TFM di un master in data science a Barcellona?
3. Chi fa da cofondatore tecnico se si arriva a P3?
4. Commerciale o open source/ricerca?

## Risorse a Barcellona da valutare
- Master in data science (UB) come contesto per la fase 3.
- INEFC (scienze dello sport) per validazione e dati di laboratorio.
- Barcelona Activa per supporto a progetti d'impresa.
- Cluster dell'industria sportiva catalana (INDESCAT).
(da verificare condizioni e contatti)
