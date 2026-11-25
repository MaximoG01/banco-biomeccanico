// Taratura di 4 costanti globali su 11 obiettivi pubblicati:
// FTP di 5 profili tipo, cadenza di soglia ottimale (amatore ~85, pro ~92), efficienza lorda (amatore ~20,5%, pro ~22%),
// frazione di VO2max alla soglia (amatore ~0,82, pro ~0,89).
const M = require('./load-model.js')();
const B = {h: 178, ins: 84, mass: 72, ratio: 1.15, crank: 172.5, saddle: 0.883, trunk: 45, sta: 73, stack: 22, cleat: 0, ankl: 12, thigh: 17.5, mito: 6, slow: 50, age: 35, vo2: 50, cad: 90, cc: 5, lev: 1, ten: 1, act: 1};
M.run(B);
const T = [[{mass: 76, vo2: 44, mito: 4.5, slow: 48, age: 40, thigh: 17, cad: 85}, 2.6],
  [{mass: 72, vo2: 55, mito: 6.5, slow: 55, age: 35, cad: 88}, 3.55],
  [{h: 179, ins: 85, mass: 68, vo2: 72, mito: 8.5, slow: 63, age: 27, cad: 92}, 5.4],
  [{h: 175, ins: 82, mass: 62, vo2: 80, mito: 9.5, slow: 70, age: 27, thigh: 16.5, cad: 92}, 6.1],
  [{h: 180, ins: 84, mass: 75, vo2: 72, mito: 8.5, slow: 40, age: 27, thigh: 20.5, trunk: 38, cad: 92}, 5.15]];
const AM = T[1][0], PR = T[3][0];
const optCad = o => { let b = [0, 0]; for (let c = 60; c <= 115; c += 5) { const v = M.run({...B, ...o, cad: c}).Pthr; if (v > b[1]) b = [c, v]; } return b[0]; };
let best = null; const t0 = Date.now();
for (const TAU of [0.3, 0.4, 0.5]) for (const FII of [0.25, 0.5, 0.75, 1.0]) for (const EB of [0.25, 0.26, 0.27, 0.28]) for (const F0 of [0.72, 0.75, 0.78]) {
  Object.assign(M.K, {EB, F0, FII, TAU});
  const res = T.map(([o, y]) => { const p = {...B, ...o}; return M.run(p).Pthr / p.mass / y; });
  const ra = M.run({...B, ...AM}), rp = M.run({...B, ...PR});
  const e = [...res.map(r => Math.log(r)), (ra.GE * 100 - 20.5) / 20.5, (rp.GE * 100 - 22) / 22, (ra.fthr - 0.82) / 0.82, (rp.fthr - 0.89) / 0.89];
  let err = e.reduce((s, x) => s + x * x, 0);
  if (best && Math.sqrt(err / 11) > best.err) continue;
  const cs = [optCad(AM), optCad(PR)]; err += ((cs[0] - 85) / 100) ** 2 + ((cs[1] - 92) / 100) ** 2;
  err = Math.sqrt(err / 11);
  if (!best || err < best.err) best = {TAU, FII, EB, F0, err, res, cs, ge: [ra.GE, rp.GE], f: [ra.fthr, rp.fthr]};
}
const b = best;
console.log(`migliore: TAU ${b.TAU} FII ${b.FII} EB ${b.EB} F0 ${b.F0} · errore ${(100 * b.err).toFixed(1)}%`);
console.log(`  FTP modello/atteso ${b.res.map(r => r.toFixed(2)).join(' ')} · GE amatore ${(100 * b.ge[0]).toFixed(1)}% pro ${(100 * b.ge[1]).toFixed(1)}% · frazione ${b.f.map(x => x.toFixed(2)).join(' / ')} · cadenza ottima ${b.cs.join(' / ')} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
