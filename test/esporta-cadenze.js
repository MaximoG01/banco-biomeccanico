// Previsione del modello per l'intervento "cadenza": quota di lavoro positivo delle fibre per gruppo muscolare a 60–120 rpm,
// a potenza fissa, e pendenza per +10 rpm (stesso intervento delle simulazioni Moco). Uso: node test/esporta-cadenze.js [watt] > prev.json
const M = require('./load-model.js')();
const watt = +process.argv[2] || 150;
const B = {h: 178, ins: 84, mass: 72, ratio: 1.15, crank: 172.5, saddle: 0.883, trunk: 45, sta: 73, stack: 22, cleat: 0, ankl: 21, thigh: 17.5, mito: 6, slow: 50, age: 35, vo2: 50, cad: 90, cc: 5, lev: 1, ten: 1, act: 1};
M.run(B);
const ids = M.MUSCLES.map(m => m.id), cads = [60, 70, 80, 90, 100, 110, 120], share = {};
for (const c of cads) {
  const p = {...B, cad: c}; let lo = 0.01, hi = 1, s = null;
  for (let i = 0; i < 10; i++) { const a = (lo + hi) / 2; s = M.run(p, {alpha: a, fast: true}); if (s.Pavg > watt) hi = a; else lo = a; }
  const pos = s.mpow.map(v => Math.max(0, v)), tot = pos.reduce((a, b) => a + b, 0);
  share[c] = Object.fromEntries(ids.map((id, j) => [id, 100 * pos[j] / tot]));
}
const per10 = Object.fromEntries(ids.map(id => { const x = cads, y = cads.map(c => share[c][id]), mx = x.reduce((a, b) => a + b) / x.length, my = y.reduce((a, b) => a + b) / y.length;
  return [id, 10 * x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / x.reduce((s, v) => s + (v - mx) ** 2, 0)]; }));
console.log(JSON.stringify({watt, share, per10}));
