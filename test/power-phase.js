// Power Phase del modello, con le definizioni dei pedali Garmin/Favero:
// power phase = arco in cui la gamba produce coppia positiva; peak power phase = arco sopra il 50% del picco (convenzione usata qui)
const M = require('./load-model.js')();
const DEF = {h:178,ins:84,mass:72,ratio:1.15,crank:172.5,saddle:0.883,trunk:45,sta:73,stack:22,cleat:0,ankl:12,thigh:17.5,mito:6,slow:50,age:35,vo2:50,cad:90,cc:5,lev:1,ten:1,act:1};
M.run(DEF);
const arc = (tq, thr) => { const N = tq.length; let s = -1, e = -1;
  for (let i = 0; i < N; i++) { const on = tq[i] > thr, pr = tq[(i - 1 + N) % N] > thr; if (on && !pr) s = i; if (!on && pr) e = i; }
  return [s * 360 / N, e * 360 / N]; };
const pp = p => { const r = M.run(p), w = p.cad * 2 * Math.PI / 60, tq = r.leg.map(l => l.pw / w), mx = Math.max(...tq);
  const a = arc(tq, 0), b = arc(tq, 0.5 * mx), ipk = tq.indexOf(mx) * 5, neg = tq.filter(t => t < 0).reduce((s, t) => s + t, 0) / tq.reduce((s, t) => s + Math.max(t, 0), 0);
  return { thr: Math.round(r.Pthr), pp: a, ppp: b, peak: ipk, negPct: Math.round(-neg * 100) }; };
for (const c of [70, 80, 90, 100, 110]) { const x = pp({...DEF, cad: c});
  console.log(`${c} rpm · soglia ${x.thr} W · Power Phase ${x.pp[0]}°→${x.pp[1]}° (${(x.pp[1] - x.pp[0] + 360) % 360}°) · Peak PP ${x.ppp[0]}°→${x.ppp[1]}° · picco coppia a ${x.peak}° · coppia negativa ${x.negPct}% della positiva`); }
