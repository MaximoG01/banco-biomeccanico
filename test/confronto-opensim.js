// Grandezze del modello confrontabili con simulazioni OpenSim e dati sperimentali di pedalata:
// escursioni articolari, potenza per articolazione (estensione/flessione), finestre di attivazione dei muscoli, picco di coppia.
const M = require('./load-model.js')();
const B = {h: 178, ins: 84, mass: 72, ratio: 1.15, crank: 172.5, saddle: 0.883, trunk: 45, sta: 73, stack: 22, cleat: 0, ankl: 12, thigh: 17.5, mito: 6, slow: 50, age: 35, vo2: 50, cad: 90, cc: 5, lev: 1, ten: 1, act: 1};
M.run(B);
const p = {...B}, r = M.run(p), N = r.leg.length, w = p.cad * 2 * Math.PI / 60, D = 180 / Math.PI;
console.log(`Amatore 72 kg, ${p.cad} rpm, alla soglia: ${Math.round(r.Pthr)} W\n`);
console.log('Escursione articolare (°):', ['anca', 'ginocchio', 'caviglia'].map((n, k) => `${n} ${r.rom[k][0].toFixed(0)}→${r.rom[k][1].toFixed(0)} (${(r.rom[k][1] - r.rom[k][0]).toFixed(0)})`).join(' · '));
// potenza articolare per gamba: P_k = Q_k · dq_k/dt; estensione se l'angolo di flessione cala (caviglia: flessione plantare se la dorsiflessione cala)
const qd = i => { const a = r.P[(i + 1) % N].q, b = r.P[(i - 1 + N) % N].q; return a.map((v, k) => (v - b[k]) / (2 * 2 * Math.PI / N) * w); };
const acc = {'anca estensione': 0, 'anca flessione': 0, 'ginocchio estensione': 0, 'ginocchio flessione': 0, 'caviglia flessione plantare': 0, 'caviglia dorsiflessione': 0};
const J = ['anca', 'ginocchio', 'caviglia'];
for (let i = 0; i < N; i++) { const Q = r.leg[i].Q, v = qd(i);
  for (let k = 0; k < 3; k++) { const P = Q[k] * v[k]; if (P <= 0) continue;
    const ext = v[k] < 0; acc[k === 2 ? (ext ? 'caviglia flessione plantare' : 'caviglia dorsiflessione') : `${J[k]} ${ext ? 'estensione' : 'flessione'}`] += P; } }
const tot = Object.values(acc).reduce((a, b) => a + b, 0);
console.log('\nPotenza positiva per articolazione (% del totale):');
for (const [k, v] of Object.entries(acc)) console.log(`  ${k.padEnd(28)} ${(100 * v / tot).toFixed(0).padStart(3)}%`);
// finestre di attivazione (gamba destra): sopra il 50% del proprio massimo
console.log('\nAttivazione dei muscoli (gradi pedivella, 0 = punto morto superiore; soglia 50% del massimo):');
r.ms.forEach((m, j) => { const a = r.leg.map(l => l.mf[j].a), mx = Math.max(...a); let on = -1, off = -1;
  for (let i = 0; i < N; i++) { const c = a[i] > 0.5 * mx, pr = a[(i - 1 + N) % N] > 0.5 * mx; if (c && !pr) on = i * 5; if (!c && pr) off = i * 5; }
  console.log(`  ${m.n.padEnd(22)} ${on}° → ${off}°`); });
const tq = r.leg.map(l => l.pw / w), ip = tq.indexOf(Math.max(...tq));
console.log(`\nPicco di coppia (una gamba): ${ip * 5}° · coppia minima ${Math.min(...tq).toFixed(1)} N·m · indice di efficacia ${(r.IE * 100).toFixed(0)}%`);
