// Profili tipo simulati e confrontati con valori pubblicati (FTP W/kg, sprint W/kg, efficienza lorda).
// Uso: node test/profili-pro.js [file.html]
const M = require('./load-model.js')(process.argv[2]);
const B = {h: 178, ins: 84, mass: 72, ratio: 1.15, crank: 172.5, saddle: 0.883, trunk: 45, sta: 73, stack: 22, cleat: 0, ankl: 12,
  thigh: 17.5, mito: 6, slow: 50, age: 35, vo2: 50, cad: 90, cc: 5, lev: 1, ten: 1, act: 1};
M.run(B);
// atteso: [FTP min, FTP max] W/kg; sprint [min, max] W/kg; fonte
const PRO = [
  ['Amatore ricreativo', {mass: 76, vo2: 44, mito: 4.5, slow: 48, age: 40, thigh: 17}, [2.3, 2.9], [11, 14], '20 min ≈ 2,6 W/kg (Cycling Weekly)'],
  ['Amatore allenato', {mass: 72, vo2: 55, mito: 6.5, slow: 55, age: 35}, [3.2, 3.9], [12, 15], 'tipico agonista amatore'],
  ['ProTeam', {h: 179, ins: 85, mass: 68, vo2: 72, mito: 8.5, slow: 63, age: 27, thigh: 17.5}, [5.1, 5.7], [14, 18], 'FTP media 5,4 W/kg (Vuelta 2020)'],
  ['WorldTour scalatore', {h: 175, ins: 82, mass: 62, vo2: 80, mito: 9.5, slow: 70, age: 27, thigh: 16.5, cad: 92}, [5.8, 6.4], [13, 17], 'FTP media WT 5,8 W/kg; VO2max 72–80 (Lucía)'],
  ['Velocista pro', {h: 180, ins: 84, mass: 75, vo2: 72, mito: 8.5, slow: 40, age: 27, thigh: 20.5, trunk: 38}, [4.8, 5.5], [15.7, 19.1], 'sprint 17,4 ± 1,7 W/kg (velocisti pro)'],
];
const ok = (v, r) => v >= r[0] && v <= r[1] ? 'ok' : v < r[0] ? 'BASSO' : 'ALTO';
console.log('profilo                 FTP W/kg  atteso     | sprint W/kg atteso      | GE    lim   frazione');
for (const [n, o, ef, es, src] of PRO) {
  const p = {...B, ...o}, r = M.run(p), sp = M.sprint(p), f = r.Pthr / p.mass, s = sp[1] / p.mass;
  console.log(`${n.padEnd(22)} ${f.toFixed(2).padStart(5)} ${ok(f, ef).padEnd(5)} ${ef.join('–').padEnd(9)} | ${s.toFixed(1).padStart(5)} ${ok(s, es).padEnd(5)} ${es.join('–').padEnd(9)} | ${(r.GE * 100).toFixed(1)}% ${r.lim.slice(0, 4)} ${(r.fthr ?? 0.82).toFixed(2)}  · ${src}`);
}
