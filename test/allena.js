// Taratura (training) del modello sui dati di Clancy et al. 2023, con test fuori campione.
// Ogni ciclista è simulato con le SUE misure (dai marker: altezza, cavallo, femore/tibia, sella, tubo sella, busto, pedivella,
// ankling) e con la sua massa, cadenza e potenza. Si stimano i pesi di sforzo degli 8 gruppi muscolari e l'anticipo del comando.
// Training: coppia sul pedale di P01–P11 + attivazioni Moco 1–4. Test: P12–P16 e Moco 5–6.
// Uso: node test/allena.js [valutazioni] [--senza-misure] → errori prima/dopo; salva test/parametri-allenati.json
const fs = require('fs'), path = require('path');
const M = require('./load-model.js')();
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'target-opensim.json'), 'utf8'));
const gfile = path.join(__dirname, 'geometria-ciclisti.json'), useGeo = !process.argv.includes('--senza-misure') && fs.existsSync(gfile);
const GEO = useGeo ? Object.fromEntries(JSON.parse(fs.readFileSync(gfile, 'utf8').replace(/\bNaN\b/g, 'null')).map(g => [g.id, g])) : {};
const EVALS = +process.argv[2] || 300, N = 72, D = Math.PI / 180;
const B = {h: 178, ins: 84, mass: 72, ratio: 1.15, crank: 172.5, saddle: 0.883, trunk: 45, sta: 73, stack: 22, cleat: 0, ankl: 21, thigh: 17.5, mito: 6, slow: 50, age: 35, vo2: 50, cad: 90, cc: 5, lev: 1, ten: 1, act: 1};
M.run(B);
const K0 = {SOLE: M.K.SOLE, SPH: M.K.SPH};
const IDS = ['glut', 'hams', 'vast', 'rf', 'ilio', 'gast', 'sol', 'ta'];
const KEYS = ['h', 'ins', 'ratio', 'saddle', 'sta', 'trunk'];
const med = k => { const v = Object.values(GEO).map(g => g[k]).filter(Number.isFinite).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : B[k]; };
const riderSetup = r => { const g = GEO[r.id], p = {...B, cad: r.cad, crank: r.crank, mass: r.mass || 72}, k = {...K0};
  if (g) { for (const key of KEYS) p[key] = Number.isFinite(g[key]) ? g[key] : med(key);
    // sella e tubo misurati con l'offset dell'anca 0,033 × altezza: si ricalcolano con quello del modello (stessa posizione dell'anca)
    { const H = p.h / 100, ins = p.ins / 100, S = p.saddle * ins, st = p.sta * D, hx = -S * Math.cos(st), hy = S * Math.sin(st) + 0.033 * H - (+process.env.BBUP || 0), ho = (+process.env.HOV || 0.033) * H; // BBUP: movimento centrale vero più in alto del centro del cerchio dei marker (m)
      p.saddle = Math.hypot(hx, hy - ho) / ins; p.sta = Math.atan2(hy - ho, -hx) / D; }
    // piede misurato: lunghezza e angolo della retta caviglia→pedale (phi = suola + beta nel modello)
    if (process.env.SUOLA && Number.isFinite(g.sole)) { p.ankl = g.ankl; k.SOLE = g.sole - M.K.SOLC * (r.cad - 90) / 10; k.SPH = g.sph; } // suola vera dai marker del piede (calcagno, 1° metatarso)
    else if (Number.isFinite(g.footL)) { p.footL = g.footL; const beta = M.geom(p).beta / D; p.ankl = g.phiAmp; k.SOLE = g.phi0 - beta - M.K.SOLC * (r.cad - 90) / 10; k.SPH = g.phiPh; } }
  return {p, k, g}; };
const train = T.riders.filter(r => +r.id.slice(1) <= 11), test = T.riders.filter(r => +r.id.slice(1) > 11);
const actTrain = T.acts.slice(0, 4), actTest = T.acts.slice(4);
const LO = [...Array(8).fill(-1.6), 0.01], HI = [...Array(8).fill(1.6), 0.09], theta0 = [...Array(8).fill(0), 0.045];
const apply = th => { M.K.W = th.slice(0, 8).map(Math.exp); M.K.LOPT = th[8]; };
const atPower = (p, watt) => { let lo = 0.01, hi = 1, s = null; for (let i = 0; i < 9; i++) { const a = (lo + hi) / 2; s = M.run(p, {alpha: a, fast: true}); if (s.Pavg > watt) hi = a; else lo = a; } return s; };
const corr = (a, b) => { const ma = a.reduce((x, y) => x + y) / a.length, mb = b.reduce((x, y) => x + y) / b.length; let sab = 0, sa = 0, sb = 0; a.forEach((x, i) => { sab += (x - ma) * (b[i] - mb); sa += (x - ma) ** 2; sb += (b[i] - mb) ** 2; }); return sab / Math.sqrt(sa * sb || 1); };
function riderErr(r) {
  const {p, k, g} = riderSetup(r); Object.assign(M.K, k);
  const s = atPower(p, r.power), w = r.cad * 2 * Math.PI / 60, tq = s.leg.map(l => l.pwg / w), rms = Math.sqrt(r.tq.reduce((x, v) => x + v * v, 0) / N);
  const G = M.geom(p), knee = Array.from({length: N}, (_, i) => M.pose(G, 2 * Math.PI * i / N).q[1] / D);
  const km = g && g.knee.every(Number.isFinite) ? g.knee : null; if (g) for (const key of ['sole', 'sph', 'ankl']) if (!Number.isFinite(g[key])) g[key] = K0.SOLE;
  Object.assign(M.K, K0);
  return {e: Math.sqrt(tq.reduce((x, v, i) => x + (v - r.tq[i]) ** 2, 0) / N) / rms, r: corr(tq, r.tq), min: Math.min(...tq), minM: Math.min(...r.tq), ie: s.IE,
    kErr: km ? Math.sqrt(knee.reduce((x, v, i) => x + (v - km[i]) ** 2, 0) / N) : NaN};
}
function actErr(set) { const s = atPower({...B, cad: 90}, 150);
  return IDS.map((g, j) => { const tgt = Array.from({length: N}, (_, i) => set.reduce((x, a) => x + a.act[g][i], 0) / set.length); return corr(s.leg.map(l => l.mf[j].a), tgt); }); }
function loss(th) { apply(th); const et = train.map(r => riderErr(r).e), ra = actErr(actTrain);
  return et.reduce((x, v) => x + v * v, 0) / et.length + 0.5 * ra.reduce((x, r) => x + (1 - r) / 2, 0) / ra.length; }
function report(th, tag) {
  apply(th);
  const sum = set => { const R = set.map(riderErr), av = k => { const v = R.map(o => o[k]).filter(Number.isFinite); return v.reduce((x, y) => x + y, 0) / v.length; };
    return `errore coppia ${(100 * av('e')).toFixed(0)}% · forma r ${av('r').toFixed(2)} · coppia min ${av('min').toFixed(1)} (misurata ${av('minM').toFixed(1)}) N·m · IE ${(100 * av('ie')).toFixed(0)}% · ginocchio RMS ${av('kErr').toFixed(1)}°`; };
  const ra = actErr(actTrain), rt = actErr(actTest);
  console.log(`${tag}\n  training P01–P11: ${sum(train)}\n  test P12–P16:     ${sum(test)}`);
  console.log(`  attivazioni r (training/test): ${IDS.map((g, j) => `${g} ${ra[j].toFixed(2)}/${rt[j].toFixed(2)}`).join(' · ')}`);
}
console.log(useGeo ? 'Con le misure individuali dei ciclisti' : 'Senza misure individuali (geometria standard)');
report(theta0, 'PRIMA (parametri da letteratura)');
let seed = 42; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) / 0.707; };
let best = theta0.slice(), fb = loss(best), step = 0.25, t0 = Date.now();
for (let k = 0; k < EVALS; k++) {
  const cand = best.map((v, i) => Math.min(HI[i], Math.max(LO[i], v + gauss() * step * (HI[i] - LO[i]) * 0.5)));
  const fc = loss(cand);
  if (fc < fb) { best = cand; fb = fc; step = Math.min(0.5, step * 1.5); } else step = Math.max(0.02, step * 0.92);
  if (k % 50 === 49) console.error(`${k + 1}/${EVALS} perdita ${fb.toFixed(4)} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
report(best, '\nDOPO (parametri allenati)');
const out = {W: best.slice(0, 8).map(Math.exp), LOPT: best[8]};
console.log('\nparametri:', JSON.stringify(out, (k, v) => typeof v === 'number' ? +v.toFixed(3) : v));
fs.writeFileSync(path.join(__dirname, 'parametri-allenati.json'), JSON.stringify(out, null, 1));
