// Ricerca dell'assetto più efficiente (stessa logica del pulsante nella pagina) per alcuni atleti tipo.
// Uso: node test/bikefit-ottimo.js
const M = require('./load-model.js')();
const B = {h: 178, ins: 84, mass: 72, ratio: 1.15, crank: 172.5, saddle: 0.883, trunk: 45, sta: 72, stack: 22, cleat: 0, ankl: 21, thigh: 17.5, mito: 6, slow: 50, age: 35, vo2: 50, cad: 90, cc: 5, lev: 1, ten: 1, act: 1};
M.run(B);
const C = [[r => r.fit.kneeBDC, 30, 40], [r => r.fit.kneeTDC, null, 122], [r => r.fit.hipMin, 45, null], [r => r.fit.ankle, 15, 35], [r => r.fit.kops, -2, 2], [r => r.fit.crankPct, 19, 21]];
const score = r => { let pen = 0; for (const [f, lo, hi] of C) { const v = f(r); if (lo != null && v < lo) pen += lo - v; if (hi != null && v > hi) pen += v - hi; } if (r.over) pen += 20; return {s: r.Pthr - 50 * pen, pen}; };
const V = [['crank', () => [160, 165, 167.5, 170, 172.5, 175, 177.5]],
  ['saddle', c => { const o = []; for (let d = -0.03; d <= 0.0301; d += 0.005) o.push(+(c + d).toFixed(3)); return o.filter(v => v >= 0.84 && v <= 0.92); }],
  ['sta', c => { const o = []; for (let d = -2.5; d <= 2.51; d += 0.5) o.push(+(c + d).toFixed(1)); return o.filter(v => v >= 70 && v <= 80); }],
  ['cleat', () => [0, 5, 10, 15, 20]],
  ['saddle', c => [-0.01, -0.005, 0, 0.005, 0.01].map(d => +(c + d).toFixed(3))], ['sta', c => [-1, -0.5, 0, 0.5, 1].map(d => +(c + d).toFixed(1))]];
for (const [n, o] of [['Amatore 178 cm', {}], ['Basso 165 cm', {h: 165, ins: 76, mass: 60}], ['Alto 192 cm', {h: 192, ins: 92, mass: 84}], ['Sella bassa 0.85', {saddle: 0.85}]]) {
  const q0 = {...B, ...o}; let best = {...q0}, r0 = M.run(q0), bE = {r: r0, ...score(r0)}, n0 = 0; const t = Date.now();
  for (const [k, g] of V) for (const v of g(best[k])) { const q = {...best, [k]: v}, r = M.run(q), e = {r, ...score(r)}; n0++; if (e.s > bE.s + 1e-6) { best = q; bE = e; } }
  const f = bE.r.fit;
  console.log(`${n} (${n0} prove, ${((Date.now() - t) / 1000).toFixed(1)} s): sella ${q0.saddle}→${best.saddle} (${f.saddleH.toFixed(1)} cm), tubo ${q0.sta}→${best.sta} (arretr. ${f.setback.toFixed(1)} cm), pedivella ${q0.crank}→${best.crank}, tacchetta ${q0.cleat}→${best.cleat} · ginocchio PMI ${f.kneeBDC.toFixed(0)}° KOPS ${f.kops.toFixed(1)} · soglia ${r0.Pthr.toFixed(0)}→${bE.r.Pthr.toFixed(0)} W (${((bE.r.Pthr / r0.Pthr - 1) * 100).toFixed(1)}%) violazioni ${bE.pen.toFixed(1)}`);
}
