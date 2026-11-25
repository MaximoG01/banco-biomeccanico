// Sensibilità della FTP a VO2max e diametro coscia (e mitocondri), a parità del resto.
const M = require('./load-model.js')();
const B = {h: 178, ins: 84, mass: 72, ratio: 1.15, crank: 172.5, saddle: 0.883, trunk: 45, sta: 73, stack: 22, cleat: 0, ankl: 12, thigh: 17.5, mito: 6, slow: 50, age: 35, vo2: 50, cad: 90, cc: 5, lev: 1, ten: 1, act: 1};
M.run(B);
const f = o => { const p = {...B, ...o}, r = M.run(p); return `${(r.Pthr / p.mass).toFixed(2)} (${r.lim.slice(0, 4)}, GE ${(r.GE * 100).toFixed(1)}, fraz ${r.fthr.toFixed(2)}, wII ${r.wII.toFixed(2)})`; };
console.log('VO2max 40 / 50 / 60 / 80:', [40, 50, 60, 80].map(v => f({vo2: v})).join(' | '));
console.log('coscia 15 / 17.5 / 20 / 22:', [15, 17.5, 20, 22].map(v => f({thigh: v})).join(' | '));
console.log('mitocondri 4 / 6 / 8:', [4, 6, 8].map(v => f({mito: v})).join(' | '));
