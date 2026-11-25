// Taratura (training) del modello sui dati di Clancy et al. 2023, con test fuori campione.
// Parametri: pesi di sforzo degli 8 gruppi muscolari, anticipo del comando, media/fase/ampiezza dell'ankling.
// Training: coppia sul pedale di P01–P11 + attivazioni Moco dei partecipanti 1–4. Test: P12–P16 e Moco 5–6.
// Uso: node test/allena.js [valutazioni] → stampa errori prima/dopo e i parametri; salva test/parametri-allenati.json
const fs = require('fs'), path = require('path');
const M = require('./load-model.js')();
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'target-opensim.json'), 'utf8'));
const EVALS = +process.argv[2] || 220, N = 72;
const B = {h: 178, ins: 84, mass: 72, ratio: 1.15, crank: 172.5, saddle: 0.883, trunk: 45, sta: 73, stack: 22, cleat: 0, ankl: 12, thigh: 17.5, mito: 6, slow: 50, age: 35, vo2: 50, cad: 90, cc: 5, lev: 1, ten: 1, act: 1};
M.run(B);
const IDS = ['glut', 'hams', 'vast', 'rf', 'ilio', 'gast', 'sol', 'ta'];
const train = T.riders.filter(r => +r.id.slice(1) <= 11), test = T.riders.filter(r => +r.id.slice(1) > 11);
const actTrain = T.acts.slice(0, 4), actTest = T.acts.slice(4);
// θ: 8 log-pesi, LOPT, SOLE, SPH, ANK
const LO = [...Array(8).fill(-1.6), 0.01, 6, -20, 3], HI = [...Array(8).fill(1.6), 0.09, 30, 80, 24];
const theta0 = [...Array(8).fill(0), 0.045, 18, 30, 12];
const apply = th => { M.K.W = th.slice(0, 8).map(Math.exp); M.K.LOPT = th[8]; M.K.SOLE = th[9]; M.K.SPH = th[10]; };
const atPower = (p, watt) => { let lo = 0.01, hi = 1, s = null; for (let i = 0; i < 9; i++) { const a = (lo + hi) / 2; s = M.run(p, {alpha: a, fast: true}); if (s.Pavg > watt) hi = a; else lo = a; } return s; };
const corr = (a, b) => { const ma = a.reduce((x, y) => x + y) / a.length, mb = b.reduce((x, y) => x + y) / b.length; let sab = 0, sa = 0, sb = 0; a.forEach((x, i) => { sab += (x - ma) * (b[i] - mb); sa += (x - ma) ** 2; sb += (b[i] - mb) ** 2; }); return sab / Math.sqrt(sa * sb || 1); };
function riderErr(r, th) {
  const p = {...B, cad: r.cad, crank: r.crank, mass: r.mass || 72, ankl: th[11]}, s = atPower(p, r.power), w = r.cad * 2 * Math.PI / 60;
  const tq = s.leg.map(l => l.pwg / w), rms = Math.sqrt(r.tq.reduce((x, v) => x + v * v, 0) / N);
  const e = Math.sqrt(tq.reduce((x, v, i) => x + (v - r.tq[i]) ** 2, 0) / N) / rms;
  return {e, r: corr(tq, r.tq), min: Math.min(...tq), minM: Math.min(...r.tq), ie: s.IE};
}
function actErr(set, th) {
  const p = {...B, cad: 90, ankl: th[11]}, s = atPower(p, 150);
  return IDS.map((g, j) => { const tgt = Array.from({length: N}, (_, i) => set.reduce((x, a) => x + a.act[g][i], 0) / set.length); return corr(s.leg.map(l => l.mf[j].a), tgt); });
}
function loss(th) { apply(th); const et = train.map(r => riderErr(r, th).e), ra = actErr(actTrain, th);
  return et.reduce((x, v) => x + v * v, 0) / et.length + 0.5 * ra.reduce((x, r) => x + (1 - r) / 2, 0) / ra.length; }
function report(th, tag) {
  apply(th);
  const sum = set => { const R = set.map(r => riderErr(r, th)); const av = k => R.reduce((x, o) => x + o[k], 0) / R.length; return `errore coppia ${(100 * av('e')).toFixed(0)}% · forma r ${av('r').toFixed(2)} · coppia min ${av('min').toFixed(1)} (misurata ${av('minM').toFixed(1)}) N·m · IE ${(100 * av('ie')).toFixed(0)}%`; };
  const ra = actErr(actTrain, th), rt = actErr(actTest, th);
  console.log(`${tag}\n  training P01–P11: ${sum(train)}\n  test P12–P16:     ${sum(test)}`);
  console.log(`  attivazioni r (training/test): ${IDS.map((g, j) => `${g} ${ra[j].toFixed(2)}/${rt[j].toFixed(2)}`).join(' · ')}`);
}
report(theta0, 'PRIMA (parametri attuali)');
let seed = 42; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) / 0.707; };
let best = theta0.slice(), fb = loss(best), step = 0.25, t0 = Date.now();
for (let k = 0; k < EVALS; k++) {
  const cand = best.map((v, i) => Math.min(HI[i], Math.max(LO[i], v + gauss() * step * (HI[i] - LO[i]) * 0.5)));
  const fc = loss(cand);
  if (fc < fb) { best = cand; fb = fc; step = Math.min(0.5, step * 1.5); } else step = Math.max(0.02, step * 0.92);
  if (k % 40 === 39) console.error(`${k + 1}/${EVALS} perdita ${fb.toFixed(4)} passo ${step.toFixed(3)} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
report(best, '\nDOPO (parametri allenati)');
const out = {W: best.slice(0, 8).map(Math.exp), LOPT: best[8], SOLE: best[9], SPH: best[10], ANK: best[11]};
console.log('\nparametri:', JSON.stringify(out, (k, v) => typeof v === 'number' ? +v.toFixed(3) : v));
fs.writeFileSync(path.join(__dirname, 'parametri-allenati.json'), JSON.stringify(out, null, 1));
