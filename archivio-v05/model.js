// Modello biomeccanico ciclista v0.5 — nucleo di calcolo (condiviso tra test e pagina)
const MODEL = (() => {
  const D = Math.PI / 180;
  // c = variazione lunghezza muscolo-tendine (m) per rad, a 178 cm: [anca(flessione), ginocchio(flessione), caviglia(dorsiflessione)]
  // g = rapporto fibra/muscolo-tendine (pennazione + tendine), L0 = lunghezza ottimale fibra (m), A = PCSA di riferimento (cm2)
  const MUSCLES = [
    { id: 'glut', n: 'Grande gluteo', c: [0.060, 0, 0], g: 1.0, L0: 0.14, A: 60, col: '#c2185b' },
    { id: 'hams', n: 'Ischiocrurali', c: [0.070, -0.030, 0], g: 0.9, L0: 0.09, A: 50, col: '#7b1fa2' },
    { id: 'vast', n: 'Vasti (quadricipite)', c: [0, 0.045, 0], g: 0.8, L0: 0.09, A: 180, col: '#d32f2f' },
    { id: 'rf', n: 'Retto femorale', c: [-0.040, 0.045, 0], g: 0.8, L0: 0.075, A: 20, col: '#f57c00' },
    { id: 'ilio', n: 'Ileopsoas', c: [-0.025, 0, 0], g: 0.9, L0: 0.10, A: 30, col: '#fbc02d' },
    { id: 'gast', n: 'Gastrocnemio', c: [0, -0.020, 0.050], g: 0.6, L0: 0.055, A: 45, col: '#388e3c' },
    { id: 'sol', n: 'Soleo', c: [0, 0, 0.050], g: 0.4, L0: 0.035, A: 100, col: '#00796b' },
    { id: 'ta', n: 'Tibiale anteriore', c: [0, 0, -0.035], g: 0.8, L0: 0.07, A: 15, col: '#1976d2' },
  ];
  const SIGMA = 30;   // tensione specifica N/cm2
  const CAL = 1.45;   // fattore di calibrazione (vedi test)
  const N = 72;       // punti per giro

  function geom(p) {
    const H = p.h / 100, ins = p.ins / 100, Lc = p.crank / 1000;
    const L = ins + 0.011 * H;                  // anca-caviglia
    const Lf = L * p.ratio / (1 + p.ratio), Lt = L - Lf;
    const S = p.saddle * ins;                   // movimento centrale - sella
    const sta = (p.sta || 73) * D;
    const hip = [-S * Math.cos(sta), S * Math.sin(sta) + 0.0 * H];
    const Lfoot = 0.105 * H;
    const al = p.trunk * D;
    return { H, L, Lf, Lt, Lc, hip, Lfoot, al };
  }

  // ---- Geometria da misure standard di bike fitting (v0.4) ----
  // Convenzioni (origine = centro del movimento centrale, x avanti, y in alto, metri):
  //  sh: altezza sella (mm) lungo il tubo sella fino alla superficie; staF: angolo tubo sella del telaio (gradi)
  //  setback: arretramento punta sella dietro la verticale del movimento centrale (mm)
  //  stack, reach: del telaio (mm); ha: angolo sterzo (gradi); spacer: spessori + calotta (mm)
  //  stem: lunghezza attacco (mm); stemAng: angolo attacco (gradi, + verso l'alto rispetto alla perpendicolare allo sterzo)
  //  barReach, barDrop: del manubrio (mm); hand: 'hoods' | 'drops' | 'tops'; shoe: scarpa+tacchetta+pedale (mm)
  // Stime dichiarate: punta sella -> zona ischiatica 150 mm; anca sopra la sella HIPUP*altezza (0,022: calibrato perché con sella LeMond e 25 mm di scarpa il ginocchio in basso sia ~33°, come nella v0.3); busto 0,30*H; braccio 0,38*H.
  const NOSE_SIT = 0.150, HIPUP = 0.022, TORSO = 0.30, ARM = 0.38;
  function geomFit(p) {
    const H = p.h / 100, ins = p.ins / 100, Lc = p.crank / 1000;
    const L = ins + 0.021 * H;                                   // anca-caviglia (anca ~0,06H sopra il cavallo, caviglia 0,039H da terra)
    const Lf = L * p.ratio / (1 + p.ratio), Lt = L - Lf;
    const staF = (p.staF || 73.5) * D, sh = p.sh / 1000;
    const seatY = sh * Math.sin(staF);                           // altezza della superficie della sella sopra il movimento centrale
    const nose = [-(p.setback || 0) / 1000, seatY];
    const sit = [nose[0] - NOSE_SIT, seatY];
    const hip = [sit[0], sit[1] + (p.hipUp ?? HIPUP) * H];
    // manubrio
    const ha = (p.ha || 73) * D, up = [-Math.cos(ha), Math.sin(ha)], fwd = [Math.sin(ha), Math.cos(ha)];
    const ht = [p.reach / 1000, p.stack / 1000];
    const top = [ht[0] + up[0] * (p.spacer || 0) / 1000, ht[1] + up[1] * (p.spacer || 0) / 1000];
    const sa = (p.stemAng || -6) * D, sd = [fwd[0] * Math.cos(sa) - fwd[1] * Math.sin(sa), fwd[0] * Math.sin(sa) + fwd[1] * Math.cos(sa)];
    const bar = [top[0] + sd[0] * (p.stem || 100) / 1000, top[1] + sd[1] * (p.stem || 100) / 1000];
    const br = (p.barReach || 80) / 1000, bd = (p.barDrop || 125) / 1000;
    const hands = p.hand === 'drops' ? [bar[0] + br - 0.01, bar[1] - bd] : p.hand === 'tops' ? [bar[0], bar[1]] : [bar[0] + br + 0.03, bar[1] + 0.02];
    // busto: spalla all'incrocio tra cerchio (anca, busto) e cerchio (mani, braccio con gomito leggermente flesso)
    const T = TORSO * H, A = ARM * H * 0.93;
    const dx = hands[0] - hip[0], dy = hands[1] - hip[1], d = Math.hypot(dx, dy);
    let reachFlag = 'ok', sh2;
    if (d > T + A) { reachFlag = 'lungo'; sh2 = [hip[0] + dx / d * T, hip[1] + dy / d * T]; }
    else if (d < Math.abs(T - A) + 0.05) { reachFlag = 'corto'; sh2 = [hip[0] + dx / d * T, hip[1] + dy / d * T]; }
    else { const a2 = (T * T - A * A + d * d) / (2 * d), hgt = Math.sqrt(Math.max(T * T - a2 * a2, 0)); const mx = hip[0] + dx / d * a2, my = hip[1] + dy / d * a2; sh2 = [mx - dy / d * hgt, my + dx / d * hgt]; }
    const al = Math.atan2(sh2[1] - hip[1], sh2[0] - hip[0]);
    const Lfoot = 0.105 * H;
    // misure di controllo che il bike fitter userebbe
    const drop = seatY - bar[1];                                 // dislivello sella-manubrio (positivo = manubrio piu' basso)
    const s2b = Math.hypot(bar[0] - nose[0], bar[1] - nose[1]);  // distanza punta sella - centro manubrio
    return { H, L, Lf, Lt, Lc, hip, Lfoot, al, shoe: (p.shoe || 0) / 1000, fit: true, nose, sit, bar, hands, shoulder: sh2, top, ht, reachFlag, drop, s2b, seatY, staEff: Math.atan2(seatY, -sit[0]) / D };
  }

  // cinematica inversa: angoli anatomici e posizioni a un angolo di pedivella th (0 = punto morto superiore)
  function pose(G, th) {
    const ped = [G.Lc * Math.sin(th), G.Lc * Math.cos(th)];
    const phi = (20 - 10 * Math.sin(th)) * D;   // caviglia (ankling)
    const pc = [ped[0], ped[1] + (G.shoe || 0)];          // pianta del piede sopra il perno (scarpa+tacchetta+pedale)
    const ank = [pc[0] - G.Lfoot * Math.cos(phi), pc[1] + G.Lfoot * Math.sin(phi)];
    let dx = ank[0] - G.hip[0], dy = ank[1] - G.hip[1];
    let d = Math.hypot(dx, dy), over = false;
    if (d > G.Lf + G.Lt - 1e-4) { over = true; d = G.Lf + G.Lt - 1e-4; }
    if (d < Math.abs(G.Lf - G.Lt) + 1e-3) d = Math.abs(G.Lf - G.Lt) + 1e-3;
    const ux = dx / Math.hypot(dx, dy), uy = dy / Math.hypot(dx, dy);
    const a = Math.acos((G.Lf ** 2 + d ** 2 - G.Lt ** 2) / (2 * G.Lf * d));
    const kx = ux * Math.cos(a) - uy * Math.sin(a), ky = ux * Math.sin(a) + uy * Math.cos(a);
    const knee = [G.hip[0] + G.Lf * kx, G.hip[1] + G.Lf * ky];
    const A1 = Math.atan2(ky, kx);
    const ankR = over ? [knee[0] + G.Lt * (ux), knee[1] + G.Lt * (uy)] : ank;
    const A2 = Math.atan2(ankR[1] - knee[1], ankR[0] - knee[0]);
    const A3 = Math.atan2(ped[1] - ankR[1], ped[0] - ankR[0]);
    const wrap = x => { while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return x; };
    const hf = wrap(A1 - (Math.PI + G.al));
    const kf = wrap(A1 - A2);
    const df = wrap(A3 - A2 - Math.PI / 2);
    return { ped, ank: ankR, knee, hip: G.hip, q: [hf, kf, df], A: [A1, A2, A3], over };
  }

  // derivata della posizione del pedale rispetto agli angoli anatomici (catena aperta)
  function jac(G, P) {
    const seg = [G.Lf, G.Lt, G.Lfoot];
    const fk = A => {
      let x = G.hip[0], y = G.hip[1];
      for (let i = 0; i < 3; i++) { x += seg[i] * Math.cos(A[i]); y += seg[i] * Math.sin(A[i]); }
      return [x, y];
    };
    // A1 = pi+al+hf, A2 = A1-kf, A3 = A2+pi/2+df
    const toA = q => { const A1 = Math.PI + G.al + q[0], A2 = A1 - q[1]; return [A1, A2, A2 + Math.PI / 2 + q[2]]; };
    const e = 1e-5, J = [];
    for (let j = 0; j < 3; j++) {
      const qp = P.q.slice(); qp[j] += e; const qm = P.q.slice(); qm[j] -= e;
      const a = fk(toA(qp)), b = fk(toA(qm));
      J.push([(a[0] - b[0]) / (2 * e), (a[1] - b[1]) / (2 * e)]);
    }
    return J;
  }

  let REF = null;
  // posizione standard di riferimento per la lunghezza ottimale delle fibre (fissa, indipendente dall'atleta): 178 cm, cavallo 84, sella LeMond, busto 45°
  const STD = { h: 178, ins: 84, ratio: 1.15, crank: 172.5, saddle: 0.883, trunk: 45, sta: 73 };

  function run(p, opts = {}) {
    const G = p.fit ? geomFit(p) : geom(p);
    const sH = G.H / 1.78, sL = G.L / (0.84 + 0.011 * 1.78);
    const age = Math.max(0, p.age - 30);
    const fA = (1 - 0.006 * age), vA = (1 - 0.004 * age);
    const slow = p.slow / 100;
    const vmax = (slow * 3.5 + (1 - slow) * 10) * vA;     // L0/s
    const area = (p.thigh / 17.5) ** 2;                    // sezione muscolare scala col diametro coscia
    const csaT = Math.PI * (p.thigh / 2) ** 2 * 0.70;          // cm2 di muscolo a metà coscia (70% della sezione)
    const volT = csaT * G.Lf * 100 * 0.6;                      // cm3 per coscia (fattore di forma 0,6)
    const volAct = 2 * volT * 1.5;                             // muscoli attivi: cosce + glutei e polpacci
    const volMito = volAct * p.mito / 100;                     // mL di mitocondri
    const w = p.cad * 2 * Math.PI / 60;
    const P = [], qs = [];
    for (let i = 0; i < N; i++) { const th = 2 * Math.PI * i / N; const ps = pose(G, th); P.push(ps); qs.push(ps.q); }
    const ref = REF || (REF = (() => { const G0 = geom(STD); const a = [0, 0, 0]; for (let i = 0; i < N; i++) { const q = pose(G0, 2 * Math.PI * i / N).q; for (let k = 0; k < 3; k++) a[k] += q[k] / N; } return a; })());
    const qd = qs.map((q, i) => { const a = qs[(i + 1) % N], b = qs[(i - 1 + N) % N]; return a.map((v, k) => (v - b[k]) / (2 * 2 * Math.PI / N) * w); });
    const ms = MUSCLES.map(m => ({ ...m, c: m.c.map(c => c * sH), L0: m.L0 * sL, F0: m.A * SIGMA * CAL * area * fA }));
    let sF = 0, sFl = 0, sFv = 0;
    const leg = []; // per istante: potenza, forze muscolari, coppie generalizzate
    let over = false;
    for (let i = 0; i < N; i++) {
      over = over || P[i].over;
      let pw = 0; const Q = [0, 0, 0], mf = [], mp = [];
      for (const m of ms) {
        const lf = m.L0 + m.g * m.c.reduce((s, c, k) => s + c * (qs[i][k] - ref[k]), 0);
        const vsh = -m.c.reduce((s, c, k) => s + c * qd[i][k], 0);     // accorciamento MTU m/s
        const vf = m.g * vsh / m.L0;                                    // L0/s
        let F = 0;
        if (vsh > 0) {
          const fl = Math.exp(-((((lf / m.L0) - 1) / 0.45) ** 2));
          const r = Math.min(vf / vmax, 1);
          const fv = (1 - r) / (1 + r / 0.25);
          F = m.F0 * fl * Math.max(fv, 0);
        }
        if (F > 0) { sF += F; sFl += F * Math.exp(-((((lf / m.L0) - 1) / 0.45) ** 2)); sFv += F * vf; }
        mf.push({ F, lf }); mp.push(F * vsh); pw += F * vsh;
        m.c.forEach((c, k) => Q[k] += -F * c);
      }
      // forza al pedale (minimi quadrati Q = J f)
      const J = jac(G, P[i]);
      let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
      J.forEach((r, k) => { a11 += r[0] * r[0]; a12 += r[0] * r[1]; a22 += r[1] * r[1]; b1 += r[0] * Q[k]; b2 += r[1] * Q[k]; });
      const det = a11 * a22 - a12 * a12;
      const f = [(a22 * b1 - a12 * b2) / det, (a11 * b2 - a12 * b1) / det];
      leg.push({ pw, mf, mp, Q, f });
    }
    // due gambe sfasate di 180°
    const tq = leg.map((l, i) => (l.pw + leg[(i + N / 2) % N].pw) / w);
    const Pavg = tq.reduce((s, t) => s + t, 0) / N * w;
    const mpow = ms.map((m, k) => 2 * leg.reduce((s, l) => s + l.mp[k], 0) / N);
    const short = ms.map((m, k) => { const ls = leg.map(l => l.mf[k].lf); return (Math.max(...ls) - Math.min(...ls)) / m.L0; });
    const rom = [0, 1, 2].map(k => { const v = qs.map(q => q[k] / D); return [Math.min(...v), Math.max(...v)]; });
    // indice di efficacia: forza tangenziale positiva / modulo forza
    let ft = 0, fm = 0;
    leg.forEach((l, i) => { const th = 2 * Math.PI * i / N; const t = [Math.cos(th), -Math.sin(th)]; ft += l.f[0] * t[0] + l.f[1] * t[1]; fm += Math.hypot(l.f[0], l.f[1]); });
    // efficienza: fibre vicine alla lunghezza ottimale (ROM) e fibre lente a ~1/4 della loro velocità massima
    const eLen = sF ? sFl / sF : 0;
    const vSlow = 3.5 * vA, rv = sF ? (sFv / sF) / vSlow : 0;
    const eVel = Math.max(0.3, 1 - ((rv - 0.25) / 0.45) ** 2);
    const GE = 0.25 * eLen * eVel;
    const VO2mus = volMito * 4.5 / 1000;                       // L O2/min che i mitocondri possono usare (4,5 mL/min per mL)
    const VO2cen = (p.vo2 || 99) * p.mass / 1000;              // L O2/min che cuore e sangue possono portare (VO2max)
    const VO2 = Math.min(VO2mus, VO2cen), lim = VO2cen < VO2mus ? 'centrale' : 'muscolare';
    const Paer = VO2 * 20.9 * 1000 / 60 * GE;                  // W al VO2max
    const Pthr = Paer * 0.82;                                  // soglia ~82% della potenza al VO2max
    const i3 = Math.round(N / 4) % N;                              // pedivella a ore 3
    const kops = (P[i3].knee[0] - P[i3].ped[0]) * 1000;           // mm, centro articolare del ginocchio rispetto al perno (+ = avanti)
    const hipMin = 180 - rom[0][1];                                // angolo busto-coscia piu' chiuso (gradi)
    return { kops, hipMin, G, P, leg, tq, Pavg, mpow, short, rom, ms, over, vmax, IE: ft / fm, csaT, volT, volAct, volMito, eLen, eVel, rv, GE, VO2, VO2mus, VO2cen, lim, Paer, Pthr };
  }

  function curve(p) {
    const out = [];
    for (let c = 40; c <= 160; c += 5) out.push([c, run({ ...p, cad: c }).Pavg]);
    return out;
  }
  

  return { MUSCLES, run, curve, pose, geom, geomFit };
})();
if (typeof module !== 'undefined') module.exports = MODEL;
