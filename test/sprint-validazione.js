// Validazione dello sprint (potenza massima) contro studi pubblicati con ergometro a carico inerziale o isocinetico.
// Non tara niente: confronta forma della curva potenza-cadenza, cadenza ottimale, relazione coppia-cadenza,
// effetto della lunghezza della pedivella, età e livello assoluto. Uso: node test/sprint-validazione.js [file.html]
const M = require('./load-model.js')(process.argv[2]);
const B = {h: 178, ins: 84, mass: 72, ratio: 1.15, crank: 172.5, saddle: 0.883, trunk: 45, sta: 73, stack: 22, cleat: 0, ankl: 21,
  thigh: 17.5, mito: 6, slow: 50, age: 35, vo2: 50, cad: 90, cc: 5, lev: 1, ten: 1, act: 1};
M.run(B);
const P = (p, c) => M.run({...p, cad: c}, {fast: true, max: true}).Pavg;
function prof(p) { // curva fine, picco, coppia-cadenza lineare (regressione sui punti 60–160 rpm)
  const cs = []; for (let c = 50; c <= 200; c += 5) cs.push(c);
  const pw = cs.map(c => P(p, c)); let k = pw.indexOf(Math.max(...pw));
  // raffina il picco con una parabola sui tre punti attorno
  const [a, b, d] = [pw[k - 1], pw[k], pw[k + 1]], off = (a - d) / (2 * (a - 2 * b + d)) || 0;
  const copt = cs[k] + 5 * off, pmax = b - (a - d) * off / 4;
  const sel = cs.map((c, i) => [c, pw[i] / (c * 2 * Math.PI / 60)]).filter(([c]) => c >= 60 && c <= 160);
  const mx = sel.reduce((s, v) => s + v[0], 0) / sel.length, my = sel.reduce((s, v) => s + v[1], 0) / sel.length;
  const sl = sel.reduce((s, v) => s + (v[0] - mx) * (v[1] - my), 0) / sel.reduce((s, v) => s + (v[0] - mx) ** 2, 0), T0 = my - sl * mx;
  const ssr = sel.reduce((s, v) => s + (v[1] - (T0 + sl * v[0])) ** 2, 0), sst = sel.reduce((s, v) => s + (v[1] - my) ** 2, 0);
  return {copt, pmax, sl, T0, cmax: -T0 / sl, r2: 1 - ssr / sst, p100_130: Math.max(...cs.filter(c => c >= 100 && c <= 130).map(c => pw[cs.indexOf(c)]))};
}
const f0 = (v, n = 0) => v.toFixed(n);

console.log('\n1) Livello assoluto e cadenza ottimale (potenza media sul giro)');
const REF = [
  ['Uomini attivi (Martin 1997)', {mass: 78, age: 25, thigh: 17.5, slow: 50}, 1317, 66, 122, '13 uomini attivi, ±SE; massa non nell\'abstract (≈78 kg ipotizzata)'],
  ['Ciclisti allenati (Martin 2001)', {mass: 74, age: 28, thigh: 17.5, slow: 55}, 1180, 84, 120, '16 ciclisti, pedivella 170 mm, ±SE·√n; massa ipotizzata'],
  ['Pistard elite (Dorel 2005)', {h: 180, ins: 85, mass: 85, age: 25, thigh: 20, slow: 40}, 1600, 116, 129.8, '12 velocisti di livello mondiale; massa ipotizzata'],
  ['Pistard elite (Gardner 2007)', {h: 180, ins: 85, mass: 86.2, age: 25, thigh: 20.5, slow: 38}, 1791, 169, 128, '7 velocisti, 180 cm 86,2 kg'],
];
console.log('gruppo                            modello W  (100–130)  misurato W ± DS   z     rpm ott. mod/mis   Tmax N·m  rpm max  r² T-cad');
for (const [n, o, pm, sd, copt] of REF) {
  const p = {...B, ...o}, r = prof(p);
  console.log(`${n.padEnd(32)} ${f0(r.pmax).padStart(6)}  (${f0(r.p100_130).padStart(5)})   ${String(pm).padStart(5)} ± ${String(sd).padEnd(4)}  ${((r.pmax - pm) / sd).toFixed(1).padStart(5)}   ${f0(r.copt).padStart(4)} / ${String(copt).padEnd(6)}   ${f0(r.T0).padStart(5)}   ${f0(r.cmax).padStart(5)}   ${r.r2.toFixed(3)}`);
}
console.log('Gardner 2007 misura: Tmax 266 ± 20 N·m, pendenza −1,04 N·m/rpm (rpm max ≈ 256), relazione coppia-cadenza lineare.');

console.log('\n2) Lunghezza della pedivella (Martin & Spirduso 2001: Pmax 1149 W a 220 mm … 1194 W a 145 mm; cadenza ottimale 136 → 110 rpm)');
const base = {...B, mass: 74, age: 28, slow: 55}, rows = [];
// come nello studio, la sella si regola con la pedivella: distanza sella–pedale in basso costante
for (const cr of [120, 145, 170, 195, 220]) { const r = prof({...base, crank: cr, saddle: base.saddle + (172.5 - cr) / 1000 / (base.ins / 100)}); rows.push([cr, r]); }
const best = Math.max(...rows.map(([, r]) => r.pmax));
for (const [cr, r] of rows) console.log(`  ${cr} mm  Pmax ${f0(r.pmax)} W (${f0(100 * r.pmax / best, 1)}% del massimo)  cadenza ottimale ${f0(r.copt)} rpm  velocità pedale ${(r.copt / 60 * 2 * Math.PI * cr / 1000).toFixed(2)} m/s`);
console.log('  misurato: 145–170 mm massimi, 120 e 220 mm circa −4%; velocità ottimale del pedale 1,71 → 2,53 m/s');

console.log('\n3) Età (Martin et al. 2000: Pmax spiegata da volume coscia × cadenza ottimale, r² 0,83; scalata così cala poco con l\'età)');
for (const age of [25, 45, 65]) { const r = prof({...base, age}); console.log(`  ${age} anni  Pmax ${f0(r.pmax)} W  cadenza ottimale ${f0(r.copt)} rpm  Pmax/cad.ott ${f0(r.pmax / r.copt, 2)}`); }

console.log('\n4) Sensibilità: coscia e fibre (Martin 2000: Pmax ∝ volume coscia × cadenza ottimale)');
for (const [k, vs] of [['thigh', [16, 17.5, 19]], ['slow', [35, 50, 65]]]) {
  for (const v of vs) { const r = prof({...base, [k]: v}); console.log(`  ${k}=${v}  Pmax ${f0(r.pmax)} W  cadenza ottimale ${f0(r.copt)} rpm`); }
}
