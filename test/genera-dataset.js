// Genera atleti virtuali con parametri da distribuzioni di popolazione realistiche e calcola le uscite del modello.
// Uso: node test/genera-dataset.js [N] [file.csv]
const fs = require('fs'), path = require('path');
const M = require('./load-model.js')();
const N = +process.argv[2] || 3000, out = process.argv[3] || path.join(__dirname, 'dataset.csv');
let seed = 12345; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
const U = (a, b) => a + (b - a) * rnd();
const G = (m, s) => { let u = 0; for (let i = 0; i < 12; i++) u += rnd(); return m + s * (u - 6); };
const clip = (x, a, b) => Math.min(b, Math.max(a, x));
const BASE = {ratio: 1.15, lev: 1, ten: 1, act: 1};
M.run({h: 178, ins: 84, mass: 72, ratio: 1.15, crank: 172.5, saddle: 0.883, trunk: 45, sta: 73, stack: 22, cleat: 0, ankl: 21, thigh: 17.5, mito: 6, slow: 50, age: 35, vo2: 50, cad: 90, cc: 5});
const rows = [], t0 = Date.now();
for (let n = 0; n < N; n++) {
  const h = clip(G(178, 7), 160, 198);
  const p = {...BASE, h,
    ins: +(h * clip(G(0.472, 0.012), 0.44, 0.50)).toFixed(1),            // cavallo: dipende dall'altezza
    mass: +(clip(G(22.5, 1.8), 18.5, 28) * (h / 100) ** 2).toFixed(1),   // massa: dipende dall'altezza (BMI)
    ratio: +clip(G(1.15, 0.05), 1.0, 1.3).toFixed(2),
    crank: [165, 167.5, 170, 172.5, 175][Math.floor(rnd() * 5)],
    saddle: +clip(G(0.883, 0.01), 0.855, 0.91).toFixed(3),
    trunk: +U(30, 60).toFixed(0), sta: +clip(G(73.5, 0.8), 71.5, 75.5).toFixed(1),
    stack: +U(16, 30).toFixed(0), cleat: +U(0, 20).toFixed(0), ankl: +U(4, 20).toFixed(0),
    thigh: +clip(G(17.5, 1.3), 14, 22).toFixed(1), mito: +U(3.5, 9.5).toFixed(1), slow: +clip(G(55, 12), 25, 85).toFixed(0),
    age: +U(20, 65).toFixed(0), vo2: +U(40, 82).toFixed(0), cad: +U(75, 105).toFixed(0), cc: +U(0, 12).toFixed(0)};
  const r = M.run(p), sp = M.sprint(p);
  rows.push({...p, ftp_wkg: r.Pthr / p.mass, ftp_w: r.Pthr, ge: r.GE * 100, e_len: r.eLen, e_vel: r.eVel, e_neg: r.eNeg,
    vo2_mus: r.VO2mus, vo2_cen: r.VO2cen, vo2_used: r.VO2, lim_mus: r.lim === 'muscolare' ? 1 : 0, occ: r.occ, al: r.al,
    knee_bdc: r.fit.kneeBDC, sprint_w: sp[1], sprint_cad: sp[0]});
  if (n % 500 === 499) console.error(`${n + 1}/${N} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
const cols = Object.keys(rows[0]).filter(k => !['lev', 'ten', 'act'].includes(k));
fs.writeFileSync(out, cols.join(',') + '\n' + rows.map(r => cols.map(c => +(+r[c]).toFixed(5)).join(',')).join('\n') + '\n');
console.log(`scritto ${out}: ${rows.length} righe in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
