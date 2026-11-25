// Esporta le curve del modello lungo il giro (angoli, attivazioni per gruppo muscolare, potenza per muscolo) in JSON,
// per il confronto con le simulazioni OpenSim (test/confronto_opensim.py).
// Uso: node test/esporta-curve.js [cadenza] [potenza W, 0 = soglia] > curve.json
const M = require('./load-model.js')();
const cad = +process.argv[2] || 90, watt = +process.argv[3] || 0;
const B = {h: 178, ins: 84, mass: 72, ratio: 1.15, crank: 172.5, saddle: 0.883, trunk: 45, sta: 73, stack: 22, cleat: 0, ankl: 12, thigh: 17.5, mito: 6, slow: 50, age: 35, vo2: 50, cad, cc: 5, lev: 1, ten: 1, act: 1};
M.run(B);
let r = M.run(B);
if (watt) { // attivazione che produce la potenza richiesta (bisezione)
  let lo = 0.02, hi = 1; for (let i = 0; i < 18; i++) { const a = (lo + hi) / 2, s = M.run(B, {alpha: a}); if (s.Pavg > watt) hi = a; else lo = a; }
  r = {...r, ...M.run(B, {alpha: (lo + hi) / 2})};
}
const D = 180 / Math.PI, N = r.leg.length;
console.log(JSON.stringify({cad, power: Math.round(r.Pavg), crank: Array.from({length: N}, (_, i) => i * 360 / N),
  hip: r.P.map(x => x.q[0] * D), knee: r.P.map(x => x.q[1] * D), ankle: r.P.map(x => x.q[2] * D),
  act: Object.fromEntries(r.ms.map((m, j) => [m.id, r.leg.map(l => l.mf[j].a)])),
  power_share: Object.fromEntries(r.ms.map((m, j) => [m.id, Math.max(0, r.mpow[j])]))}));
