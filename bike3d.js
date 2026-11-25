// Rendering 3D del ciclista (Three.js). Legge lo stato del modello da window.BIO e disegna nella figura #bike.
// Busto, bacino, collo e testa sono un'unica superficie continua (campo di distanza → mesh con surface nets);
// gli arti hanno il profilo dei muscoli; la massa grassa (dal BMI) fa crescere pancia, fianchi e arti.
// Lo scenario (montagna, mare, città, campagna) è in 3D attorno alla bici, così si vede da ogni lato.
// Se WebGL non è disponibile non fa nulla e la pagina resta sul disegno 2D.
import * as THREE from 'three';

const host = document.getElementById('bike');
let renderer = null;
try { renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'high-performance'}); } catch (e) { renderer = null; }

if (renderer && window.BIO && host) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const cv = renderer.domElement; cv.className = 'bike3d';
  host.insertBefore(cv, host.querySelector('.figbtn')); host.classList.add('has3d');

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 900);
  const hemi = new THREE.HemisphereLight(0xeef6ff, 0x5c5248, 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff6ea, 2.4);
  sun.position.set(1.2, 3.2, 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -2, right: 2, top: 2.2, bottom: -1.4, near: 0.5, far: 9});
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xc8dcff, 0.7); fill.position.set(-2.2, 1.4, -1.8); scene.add(fill);
  const rimL = new THREE.DirectionalLight(0xffffff, 0.45); rimL.position.set(-1, 2, 2.5); scene.add(rimL);
  const GROUND_Y = 0.07 - 0.335;
  const shadowGround = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({opacity: 0.3}));
  shadowGround.rotation.x = -Math.PI / 2; shadowGround.position.y = GROUND_Y; shadowGround.receiveShadow = true; scene.add(shadowGround);

  const SKINS = {chiara: '#efc4a4', media: '#d9a17f', olivastra: '#b98560', scura: '#7a4e34'};
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const Z = V(0, 0, 1);
  const _m = new THREE.Matrix4();
  let seed = 1; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  // orienta un oggetto (asse locale +y lungo il segmento) da a verso b, con l'asse z il più vicino possibile a z mondo
  const orient = (o, a, b) => {
    const y = b.clone().sub(a), L = y.length() || 1e-6; y.multiplyScalar(1 / L);
    let z = Z.clone().addScaledVector(y, -y.dot(Z)); if (z.lengthSq() < 1e-8) z = V(1, 0, 0); z.normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    o.quaternion.setFromRotationMatrix(_m.makeBasis(x, y, z)); o.position.copy(a); return L;
  };
  const sstep = u => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
  const bump = (t, a, b) => sstep((t - a) / ((b - a) / 2 || 1)) * sstep((b - t) / ((b - a) / 2 || 1));
  // arto: superficie di rotazione con estremità arrotondate e rigonfiamenti muscolari asimmetrici.
  // keys = [[t, raggio]]; bulges = [[da t, a t, quanto, direzione]] con direzione +1 = dietro (polpaccio), −1 = davanti (quadricipite)
  const limbGeo = (L, keys, bulges = [], seg = 40) => {
    const R = t => { for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, r0] = keys[i - 1], [t1, r1] = keys[i], s = sstep((t - t0) / ((t1 - t0) || 1)); return r0 + (r1 - r0) * s; } return keys[keys.length - 1][1]; };
    const r0 = keys[0][1], r1 = keys[keys.length - 1][1], pts = [];
    for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(1e-4, r0 * Math.sin(a)), -r0 * 0.7 * Math.cos(a))); }
    for (let i = 1; i < 36; i++) { const t = i / 36; pts.push(new THREE.Vector2(R(t), t * L)); }
    for (let i = 0; i <= 8; i++) { const a = (1 - i / 8) * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(1e-4, r1 * Math.sin(a)), L + r1 * 0.7 * Math.cos(a))); }
    const g = new THREE.LatheGeometry(pts, seg);
    if (bulges.length) { const P = g.attributes.position;
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), r = Math.hypot(x, z); if (r < 1e-5) continue;
        const t = y / L; let f = 1; for (const [a, b, q, dir] of bulges) { const c = dir * x / r; f += q * bump(t, a, b) * Math.max(0, c) ** 1.4; }
        P.setX(i, x * f); P.setZ(i, z * f); }
      g.computeVertexNormals(); }
    return g;
  };
  // ---- superficie continua da campo di distanza (surface nets) ----
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  function surfaceNets(f, mn, mx, h, colorOf) {
    const nx = Math.ceil((mx.x - mn.x) / h) + 1, ny = Math.ceil((mx.y - mn.y) / h) + 1, nz = Math.ceil((mx.z - mn.z) / h) + 1;
    const F = new Float32Array(nx * ny * nz), id = (i, j, k) => i + nx * (j + ny * k);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[id(i, j, k)] = f(mn.x + i * h, mn.y + j * h, mn.z + k * h);
    const cx = nx - 1, cy = ny - 1, cz = nz - 1, vid = new Int32Array(cx * cy * cz).fill(-1), cid = (i, j, k) => i + cx * (j + cy * k);
    const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const pos = [], nor = [], col = [], v = new Float32Array(8), e = 1e-3;
    for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
      let neg = 0; for (let c = 0; c < 8; c++) { v[c] = F[id(i + C[c][0], j + C[c][1], k + C[c][2])]; if (v[c] < 0) neg++; }
      if (neg === 0 || neg === 8) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of E) { if ((v[a] < 0) === (v[b] < 0)) continue; const t = v[a] / (v[a] - v[b]);
        sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; n++; }
      const x = mn.x + (i + sx / n) * h, y = mn.y + (j + sy / n) * h, z = mn.z + (k + sz / n) * h;
      vid[cid(i, j, k)] = pos.length / 3; pos.push(x, y, z);
      const gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e), gl = Math.hypot(gx, gy, gz) || 1;
      nor.push(gx / gl, gy / gl, gz / gl); const c = colorOf(x, y, z); col.push(c.r, c.g, c.b);
    }
    const idx = [], tri = (a, b, c) => { // orienta il triangolo secondo il gradiente
      const A = a * 3, B = b * 3, Cc = c * 3, ux = pos[B] - pos[A], uy = pos[B + 1] - pos[A + 1], uz = pos[B + 2] - pos[A + 2], wx = pos[Cc] - pos[A], wy = pos[Cc + 1] - pos[A + 1], wz = pos[Cc + 2] - pos[A + 2];
      const nx2 = uy * wz - uz * wy, ny2 = uz * wx - ux * wz, nz2 = ux * wy - uy * wx; if (nx2 * nor[A] + ny2 * nor[A + 1] + nz2 * nor[A + 2] >= 0) idx.push(a, b, c); else idx.push(a, c, b); };
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const s0 = F[id(i, j, k)] < 0;
      // spigolo lungo x, y, z: le 4 celle attorno formano un quadrilatero
      if (i < cx && j > 0 && k > 0 && j < ny && k < nz && s0 !== (F[id(i + 1, j, k)] < 0) && j <= cy && k <= cz) {
        const q = [vid[cid(i, j - 1, k - 1)], vid[cid(i, j, k - 1)], vid[cid(i, j, k)], vid[cid(i, j - 1, k)]];
        if (j < cy + 1 && k < cz + 1 && j - 1 < cy && k - 1 < cz && j < cy && k < cz && q.every(x => x >= 0)) { tri(q[0], q[1], q[2]); tri(q[0], q[2], q[3]); } }
      if (j < cy && i > 0 && k > 0 && i < cx && k < cz && s0 !== (F[id(i, j + 1, k)] < 0)) {
        const q = [vid[cid(i - 1, j, k - 1)], vid[cid(i, j, k - 1)], vid[cid(i, j, k)], vid[cid(i - 1, j, k)]];
        if (q.every(x => x >= 0)) { tri(q[0], q[1], q[2]); tri(q[0], q[2], q[3]); } }
      if (k < cz && i > 0 && j > 0 && i < cx && j < cy && s0 !== (F[id(i, j, k + 1)] < 0)) {
        const q = [vid[cid(i - 1, j - 1, k)], vid[cid(i, j - 1, k)], vid[cid(i, j, k)], vid[cid(i - 1, j, k)]];
        if (q.every(x => x >= 0)) { tri(q[0], q[1], q[2]); tri(q[0], q[2], q[3]); } }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); return g;
  }
  const disposeAll = o => o.traverse(c => { if (c.geometry && !c.geometry.userData.cached) c.geometry.dispose(); if (c.material) [].concat(c.material).forEach(m => { if (m.map) m.map.dispose(); if (m.emissiveMap) m.emissiveMap.dispose(); m.dispose(); }); });
  function textTexture(text, color) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = color; g.font = '700 44px "Barlow Condensed", Barlow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 34); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const contrast = c => { const n = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); return (n[0] * 0.299 + n[1] * 0.587 + n[2] * 0.114) > 150 ? '#15191f' : '#ffffff'; };

  // =====================================================================================
  // SCENARIO 3D
  // =====================================================================================
  const env = new THREE.Group(); scene.add(env);
  let envName = null, near = null; const PERIOD = 60;
  const SC = {
    montagna: {top: '#5d9fd9', hor: '#dcebf6', fog: '#cddff0', ground: '#6b8a50', light: 1},
    mare: {top: '#4fa5e3', hor: '#e1f1fb', fog: '#d6eaf7', ground: '#93a86c', light: 1},
    citta: {top: '#33497a', hor: '#f0a877', fog: '#c19a8b', ground: '#7d8087', light: 0.8},
    campagna: {top: '#79bdee', hor: '#eef7fd', fog: '#e3eff3', ground: '#87a65a', light: 1},
  };
  const lam = (c, o = {}) => new THREE.MeshStandardMaterial({color: c, roughness: 0.9, ...o});
  function inst(geo, mat, list, parent, shadow = false) { // list: [x, y, z, sx, sy, sz, rotY]
    const m = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
    list.forEach((q, i) => { o.position.set(q[0], q[1], q[2]); o.scale.set(q[3], q[4], q[5]); o.rotation.set(0, q[6] || 0, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  }
  function buildEnv(name) {
    disposeAll(env); env.clear(); near = null; scene.fog = null;
    const pal = SC[name]; shadowGround.visible = !pal;
    hemi.intensity = 1.1; sun.intensity = 2.4; sun.color.set('#fff6ea');
    if (!pal) return;
    seed = 7;
    scene.fog = new THREE.Fog(pal.fog, 80, name === 'montagna' ? 900 : 340);
    hemi.intensity = 1.1 * pal.light; sun.intensity = 2.4 * pal.light; if (name === 'citta') sun.color.set('#ffd2a8');
    // cielo: cupola con sfumatura verticale
    const RS = 800, skyG = new THREE.SphereGeometry(RS, 32, 20), top = new THREE.Color(pal.top), hor = new THREE.Color(pal.hor), cs = [];
    const P = skyG.attributes.position; for (let i = 0; i < P.count; i++) { const t = Math.max(0, P.getY(i) / RS); const c = hor.clone().lerp(top, Math.pow(t, 0.55)); cs.push(c.r, c.g, c.b); }
    skyG.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
    env.add(new THREE.Mesh(skyG, new THREE.MeshBasicMaterial({vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false})));
    // terreno e strada (la bici è nella corsia di destra)
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(700, name === 'mare' ? 360 : 700), lam(pal.ground)); gr.rotation.x = -Math.PI / 2; gr.position.set(0, GROUND_Y - 0.01, name === 'mare' ? 176 : 0); gr.receiveShadow = true; env.add(gr);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(700, 3.8), lam('#45494f', {roughness: 0.95})); road.rotation.x = -Math.PI / 2; road.position.set(0, GROUND_Y, -0.8); road.receiveShadow = true; env.add(road);
    for (const z of [1.0, -2.6]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(700, 0.1), lam('#f2f2f2')); l.rotation.x = -Math.PI / 2; l.position.set(0, GROUND_Y + 0.002, z); env.add(l); }
    near = new THREE.Group(); env.add(near);
    const dash = []; for (let x = -PERIOD * 2; x < PERIOD * 2; x += 6) dash.push([x, GROUND_Y + 0.003, -0.8, 3, 1, 0.1]);
    inst(new THREE.BoxGeometry(1, 0.002, 1), lam('#f2f2f2'), dash, near);
    const alongRoad = (step, zs, fn) => { for (let x = -PERIOD * 2; x < PERIOD * 2; x += step) for (const z of zs) fn(x, z); };
    if (name === 'montagna') {
      const far = [], snow = [];
      // catena lontana (200–330 m): le cime restano dentro l'inquadratura (3–9° sopra l'orizzonte), con neve sulle più alte
      for (let i = 0; i < 46; i++) { const a = i / 46 * Math.PI * 2 + rnd() * 0.1, d = 200 + rnd() * 130, h = d * (0.05 + rnd() * 0.11), r = h * (1.3 + rnd() * 0.8);
        far.push([Math.cos(a) * d, GROUND_Y + h / 2 - 2, Math.sin(a) * d, r, h, r, rnd() * 6]);
        if (h > d * 0.1) snow.push([Math.cos(a) * d, GROUND_Y + h - 2 - h * 0.15, Math.sin(a) * d, r * 0.31, h * 0.31, r * 0.31, 0]); }
      inst(new THREE.ConeGeometry(1, 1, 7), lam('#6f8399', {flatShading: true}), far, env);
      inst(new THREE.ConeGeometry(1, 1, 7), lam('#f4f7fa', {flatShading: true}), snow, env);
      const pines = [], trunks = [];
      alongRoad(3.2, [1, -1], (x, s) => { if (rnd() < (s > 0 ? 0.5 : 0.72)) return; const z = s > 0 ? 12 + rnd() * 30 : -(22 + rnd() * 40), h = 3.5 + rnd() * 5;
        pines.push([x + rnd() * 2, GROUND_Y + h * 0.55, z, h * 0.24, h * 0.8, h * 0.24, rnd() * 6]); trunks.push([x, GROUND_Y + h * 0.1, z, 0.15, h * 0.2, 0.15, 0]); });
      inst(new THREE.ConeGeometry(1, 1, 9), lam('#2f5a46', {roughness: 1}), pines.map(q => [q[0], q[1], q[2], q[3], q[4], q[5], q[6]]), near, false);
      inst(new THREE.CylinderGeometry(1, 1, 1, 6), lam('#4a3a2c'), trunks, near);
    } else if (name === 'mare') {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(700, 340), new THREE.MeshStandardMaterial({color: '#1f72ad', roughness: 0.18, metalness: 0.25}));
      sea.rotation.x = -Math.PI / 2; sea.position.set(0, GROUND_Y - 0.06, -183); env.add(sea);
      const beach = new THREE.Mesh(new THREE.PlaneGeometry(700, 10), lam('#dccb9c')); beach.rotation.x = -Math.PI / 2; beach.position.set(0, GROUND_Y - 0.03, -8); beach.receiveShadow = true; env.add(beach);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(700, 0.55, 0.35), lam('#d9cdb3')); wall.position.set(0, GROUND_Y + 0.27, -3.3); wall.receiveShadow = true; env.add(wall);
      const sunM = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), new THREE.MeshBasicMaterial({color: '#fff3c4', fog: false})); sunM.position.set(-60, 55, -230); env.add(sunM);
      const isl = []; for (let i = 0; i < 5; i++) isl.push([-160 + i * 70 + rnd() * 30, GROUND_Y - 2, -150 - rnd() * 60, 30 + rnd() * 30, 10 + rnd() * 14, 18, rnd() * 3]);
      inst(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam('#7e9cae'), isl, env);
      const hills = []; for (let i = 0; i < 14; i++) hills.push([-200 + i * 30 + rnd() * 15, GROUND_Y - 3, 40 + rnd() * 50, 22 + rnd() * 18, 10 + rnd() * 12, 20, 0]);
      inst(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam('#7d9a5c'), hills, env);
      const boats = []; for (let i = 0; i < 6; i++) boats.push([-120 + i * 45 + rnd() * 20, GROUND_Y - 0.4, -30 - rnd() * 70]);
      boats.forEach(([x, y, z]) => { const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 1), lam('#f4f1ea')); hull.position.set(x, y, z); env.add(hull);
        const sail = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4, 3), lam('#fffdf6')); sail.position.set(x, y + 2.3, z); sail.scale.z = 0.08; env.add(sail); });
      const posts = [], lamps = [];
            alongRoad(15, [-3.6], (x, z) => lamps.push([x, GROUND_Y + 2.5, z, 0.06, 5, 0.06, 0]));
      inst(new THREE.CylinderGeometry(1, 1, 1, 8), lam('#2b3038', {roughness: 0.5, metalness: 0.4}), lamps, near);
    } else if (name === 'citta') {
      const winTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64);
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = rnd() < 0.55 ? '#ffd98a' : '#1c2333'; g.fillRect(x * 16 + 4, y * 16 + 4, 8, 9); }
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
      const facades = ['#5b6a93', '#6d6a7a', '#8a7a6a', '#4e5a6e', '#776f86'];
      const building = (x, z, w, d, h, parent) => { const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (i < 8 || (i >= 16 && i < 24) ? d : w) / 1.6, uv.getY(i) * h / 1.6);
        const tex = winTex.clone(); tex.needsUpdate = true;
        const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({color: facades[Math.floor(rnd() * facades.length)], map: tex, emissiveMap: tex, emissive: '#ffcf80', emissiveIntensity: 0.7, roughness: 0.8}));
        m.position.set(x, GROUND_Y + h / 2, z); m.receiveShadow = true; parent.add(m); };
      for (let x = -PERIOD * 2; x < PERIOD * 2;) { const w = 7 + rnd() * 8; building(x + w / 2, 15 + rnd() * 6, w, 10 + rnd() * 6, 10 + rnd() * 26, near); x += w + 1 + rnd() * 3; }
      for (let x = -PERIOD * 2; x < PERIOD * 2;) { const w = 7 + rnd() * 8; building(x + w / 2, -(16 + rnd() * 6), w, 10 + rnd() * 6, 10 + rnd() * 26, near); x += w + 1 + rnd() * 3; }
      for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, d = 110 + rnd() * 60; building(Math.cos(a) * d, Math.sin(a) * d, 14 + rnd() * 14, 14, 25 + rnd() * 50, env); }
      for (const z of [4.5, -6.5]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(700, 6), lam('#9a9ca3')); side.rotation.x = -Math.PI / 2; side.position.set(0, GROUND_Y + 0.004, z); side.receiveShadow = true; env.add(side); }
      const poles = [], heads = [];
      alongRoad(16, [6.5, -8], (x, z) => { poles.push([x, GROUND_Y + 3, z, 0.07, 6, 0.07, 0]); heads.push([x + 0.5, GROUND_Y + 6, z * 0.9, 0.18, 0.18, 0.18, 0]); });
      inst(new THREE.CylinderGeometry(1, 1, 1, 8), lam('#22272f', {roughness: 0.5, metalness: 0.5}), poles, near);
      inst(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({color: '#ffe7a8', emissive: '#ffe7a8', emissiveIntensity: 1.5}), heads, near);
    } else if (name === 'campagna') {
      const hills = []; for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + rnd() * 0.2, d = 50 + rnd() * 110; hills.push([Math.cos(a) * d, GROUND_Y - 6, Math.sin(a) * d, 30 + rnd() * 30, 14 + rnd() * 12, 26 + rnd() * 20, rnd() * 3]); }
      inst(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lam('#93b36a'), hills, env);
      for (let i = 0; i < 7; i++) { const a = rnd() * Math.PI * 2, d = 35 + rnd() * 40, x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (Math.abs(z) < 12) continue;
        const hs = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 4.5), lam('#ead6ab')); hs.position.set(x, GROUND_Y + 1.6, z); hs.rotation.y = rnd() * 3; env.add(hs);
        const rf = new THREE.Mesh(new THREE.ConeGeometry(4.3, 1.8, 4), lam('#b5523b')); rf.position.set(x, GROUND_Y + 4.1, z); rf.rotation.y = hs.rotation.y + Math.PI / 4; rf.scale.set(1, 1, 0.78); env.add(rf); }
      const cyp = [];
      alongRoad(5, [10, -11], (x, z) => { if (rnd() < 0.15) return; const h = 6 + rnd() * 4; cyp.push([x + rnd(), GROUND_Y + h / 2, z, h * 0.11, h / 2, h * 0.11, 0]); });
      alongRoad(9, [16, -18, 26], (x, z) => { if (rnd() < 0.5) return; const h = 5 + rnd() * 5; cyp.push([x + rnd() * 3, GROUND_Y + h / 2, z + rnd() * 4, h * 0.11, h / 2, h * 0.11, 0]); });
      inst(new THREE.SphereGeometry(1, 12, 10), lam('#2f4a2b', {roughness: 1}), cyp, near);
    }
  }

  // =====================================================================================
  // CICLISTA E BICI
  // =====================================================================================
  let rig = null, ver = -1, lastW = 0, lastH = 0;
  const SHELLS = new Map(); // capelli e barba già calcolati (dipendono solo da statura, massa, busto e aspetto)
  function build(st) {
    if (rig) { scene.remove(rig.root); disposeAll(rig.root); }
    const {R, p, LOOK: lk} = st, G = R.G, sH = G.H / 1.78, k = p.thigh / 17.5;
    const bmi = p.mass / (G.H * G.H), bf = Math.sqrt(bmi / 22.7), ff = Math.max(-0.3, Math.min(1.8, (bmi - 22) / 10)); // massa grassa relativa
    const fat = Math.max(0, ff);
    const root = new THREE.Group(); scene.add(root);
    const mat = (c, o = {}) => new THREE.MeshStandardMaterial({color: c, roughness: 0.6, metalness: 0, ...o});
    const add = (geo, m, parent = root, shadow = true) => { const me = new THREE.Mesh(geo, m); me.castShadow = shadow; me.receiveShadow = true; parent.add(me); return me; };
    const seg = (a, b, r, m, parent = root, shadow = true) => { const L = a.distanceTo(b) || 1e-4; const me = add(new THREE.CapsuleGeometry(r, L, 6, 14).translate(0, L / 2, 0), m, parent, shadow); orient(me, a, b); return me; };
    const skinHex = SKINS[lk.skin] || SKINS.media;
    const skin = mat(skinHex, {roughness: 0.5});
    const sleeve = mat(lk.jersey, {roughness: 0.7});
    const shorts = mat(lk.shorts, {roughness: 0.45, metalness: 0.05});
    const gloves = mat(lk.gloves, {roughness: 0.7});
    const shoeM = mat(lk.shoes, {roughness: 0.35});
    const dark = mat('#1b1f26', {roughness: 0.5});
    const rubber = mat('#16181c', {roughness: 0.92});
    const metal = mat('#c9ced6', {roughness: 0.25, metalness: 0.85});
    const helmetM = mat(lk.headc, {roughness: 0.3, metalness: 0.1});
    const helmet2 = mat(lk.headc2, {roughness: 0.35});
    const lensM = mat(lk.lens, {roughness: 0.08, metalness: 0.6});
    const bodyM = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.62});
    const bodyMats = [skin, sleeve, shorts, gloves, helmetM, helmet2, lensM, bodyM];
    const hipZ = 0.085 * sH * (1 + 0.12 * fat), kneeZ = 0.095 * sH * (1 + 0.1 * fat), ankZ = 0.105 * sH, pedZ = 0.12;
    const U = [Math.cos(G.al), Math.sin(G.al)], BK = [-U[1], U[0]];
    const hip0 = V(G.hip[0], G.hip[1]), sh = V(G.hip[0] + U[0] * 0.30 * G.H, G.hip[1] + U[1] * 0.30 * G.H);
    // bici reale (geometria del telaio e cockpit dal modello) oppure assetto generico
    const bk = R.bike, hta = (p.hta ?? 73.25) * Math.PI / 180, uS = [-Math.cos(hta), Math.sin(hta)]; // asse dello sterzo verso l'alto
    let ht = V(0.50, 0.58), hb = V(0.54, 0.42), bar = V(0.56, 0.68), stemC = null;
    if (bk) { ht = V(p.freach / 1000, p.fstack / 1000); const Lh = Math.min(0.22, Math.max(0.09, p.fstack / 1000 - 0.42)); hb = V(ht.x - uS[0] * Lh, ht.y - uS[1] * Lh);
      const cs = (p.spc + 20) / 1000; stemC = V(ht.x + uS[0] * cs, ht.y + uS[1] * cs); bar = V(bk.bar[0], bk.bar[1]); }
    const barR = bk ? p.barr / 1000 : 0.08, hoodX = bar.x + barR - 0.01;
    // testa avanti e un po' sollevata (collo esteso per guardare la strada)
    const head = V(sh.x + U[0] * 0.14 + 0.045 * sH, sh.y + U[1] * 0.14 + 0.012 * sH);
    const tt = p.trunk < 28, Ls = sh.distanceTo(hip0), dep = bf * sH;
    const at = (s, b) => V(hip0.x + U[0] * s * Ls + BK[0] * b, hip0.y + U[1] * s * Ls + BK[1] * b); // punto nel sistema del busto

    // ---- busto, bacino, collo e testa: un'unica superficie ----
    const prims = [];
    const ell = (c, rU, rB, rZ, fr = [U, BK]) => { const [u, b] = fr; prims.push({c, r: Math.max(rU, rB, rZ), f: (x, y, z) => {
      const dx = x - c.x, dy = y - c.y, dz = z - c.z, a = (dx * u[0] + dy * u[1]) / rU, bb = (dx * b[0] + dy * b[1]) / rB, cc = dz / rZ; return (Math.hypot(a, bb, cc) - 1) * Math.min(rU, rB, rZ); }}); };
    const capsule = (A, B, r) => { const ab = B.clone().sub(A), L2 = ab.lengthSq(); prims.push({c: A.clone().lerp(B, 0.5), r: Math.sqrt(L2) / 2 + r, f: (x, y, z) => {
      const t = Math.min(1, Math.max(0, ((x - A.x) * ab.x + (y - A.y) * ab.y + (z - A.z) * ab.z) / L2)); return Math.hypot(x - A.x - ab.x * t, y - A.y - ab.y * t, z - A.z - ab.z * t) - r; }}); };
    const W = [[1, 0], [0, 1]];
    ell(at(0.03, 0), 0.105 * dep, 0.096 * dep * (1 + 0.15 * fat), 0.16 * dep * (1 + 0.22 * fat));                                  // bacino
    for (const s of [-1, 1]) { const c = at(-0.035, 0.05 * dep); c.z = s * 0.065 * dep * (1 + 0.15 * fat); ell(c, 0.078 * dep, 0.066 * dep * (1 + 0.3 * fat), 0.076 * dep * (1 + 0.2 * fat)); } // glutei
    ell(at(0.36, -(0.055 * fat) * dep), 0.21 * Ls, 0.095 * dep * (1 + 0.6 * fat), 0.135 * dep * (1 + 0.38 * fat));         // addome (pancia)
    ell(at(0.64, 0.012), 0.25 * Ls, 0.105 * dep * (1 + 0.12 * fat), 0.158 * dep * (1 + 0.15 * fat));                             // gabbia toracica
    ell(at(0.72, -0.012 * dep), 0.13 * Ls, 0.07 * dep * (1 + 0.35 * fat), 0.13 * dep);                                            // petto
    for (const s of [-1, 1]) { const c = sh.clone().add(V(BK[0] * 0.01, BK[1] * 0.01)); c.z = s * 0.165 * dep; ell(c, 0.065 * sH, 0.06 * sH, 0.06 * sH * (1 + 0.1 * fat)); } // spalle
    ell(sh.clone().add(V(BK[0] * 0.035, BK[1] * 0.035)), 0.07 * sH, 0.05 * sH, 0.12 * sH);                                         // trapezio
    const neckA = sh.clone().add(V(U[0] * 0.02, U[1] * 0.02)), neckB = head.clone().add(V(-0.025 * sH, -0.05 * sH));
    capsule(neckA, neckB, 0.047 * sH * (1 + 0.25 * fat));                                                                         // collo
    const hr = 0.092 * sH;
    ell(head, 0.105 * sH, 0.108 * sH, 0.084 * sH, W);                                                                              // cranio
    ell(head.clone().add(V(0.038 * sH, -0.055 * sH)), 0.06 * sH, 0.045 * sH, 0.059 * sH * (1 + 0.3 * fat), W);                   // mandibola e guance
    const K = 0.075, nP = prims.length, iNeck = nP - 3;
    const field = (x, y, z) => { let d = 1e9; for (let i = 0; i < iNeck; i++) d = smin(d, prims[i].f(x, y, z), K);
      d = smin(d, prims[iNeck].f(x, y, z), 0.04); let hd = prims[iNeck + 1].f(x, y, z); hd = smin(hd, prims[iNeck + 2].f(x, y, z), 0.03); return smin(d, hd, 0.035); };
    const mn = V(1e9, 1e9, 1e9), mx = V(-1e9, -1e9, -1e9);
    for (const q of prims) { mn.min(q.c.clone().subScalar(q.r + 0.04)); mx.max(q.c.clone().addScalar(q.r + 0.04)); }
    const cJ = new THREE.Color(lk.jersey), cJ2 = new THREE.Color(lk.jersey2), cS = new THREE.Color(lk.shorts), cK = new THREE.Color(skinHex);
    const colorOf = (x, y, z) => {
      if (Math.hypot(x - head.x, y - head.y, z * 1.15) < 0.135 * sH) return cK;
      const s = ((x - hip0.x) * U[0] + (y - hip0.y) * U[1]) / Ls;
      if (s > 0.97) { const nd = Math.hypot(x - neckB.x, y - neckB.y); if (nd < (neckA.distanceTo(neckB) + 0.02) && Math.abs(z) < 0.07 * sH) return cK; }
      if (s < 0.17) return cS;
      if (lk.pattern === 'fascia' && s > 0.52 && s < 0.7) return cJ2;
      if (lk.pattern === 'fianchi' && s < 0.33) return cJ2;
      if (lk.pattern === 'righe' && Math.floor(s * 14) % 2) return cJ2;
      return cJ; };
    const body = add(surfaceNets(field, mn, mx, 0.0105, colorOf), bodyM);
    // ---- volto: ogni elemento appoggiato alla pelle (si cerca la superficie del campo davanti o ai lati della testa) ----
    const headG = new THREE.Group(); headG.position.copy(head); root.add(headG);
    const s0 = sH, eyeIn = lk.glasses === 'mascherina';
    const fx = (y, z) => { for (let x = 0.17 * s0; x > 0; x -= 0.0006) if (field(head.x + x, head.y + y, z) < 0) return x; return 0.1 * s0; };   // pelle davanti
    const fz = (x, y) => { for (let z = 0.14 * s0; z > 0; z -= 0.0006) if (field(head.x + x, head.y + y, z) < 0) return z; return 0.08 * s0; };   // pelle ai lati
    const hairM = mat(lk.hairc || '#3a2a20', {roughness: 0.95}), beardM = mat(lk.beardc || lk.hairc || '#3a2a20', {roughness: 0.95});
    const lipM = mat('#' + new THREE.Color(skinHex).lerp(new THREE.Color('#9b4a48'), 0.45).getHexString(), {roughness: 0.42});
    const arc = (pts, r, m) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, r, 6, false), m, headG, false);
    const ball = (c, r, m, sx = 1, sy = 1, sz = 1) => { const b = add(new THREE.SphereGeometry(r, 18, 14), m, headG, false); b.position.copy(c); b.scale.set(sx, sy, sz); return b; };
    // naso: dorso dalla radice alla punta, punta arrotondata e ali
    const nR = V(fx(0.022 * s0, 0) - 0.003 * s0, 0.022 * s0), nT = V(fx(-0.017 * s0, 0) + 0.017 * s0, -0.017 * s0);
    seg(nR, nT, 0.0068 * s0, skin, headG, false); ball(nT, 0.0092 * s0, skin, 1, 0.9, 1.05);
    for (const s of [-1, 1]) ball(V(nT.x - 0.0085 * s0, nT.y - 0.0035 * s0, s * 0.0092 * s0), 0.0068 * s0, skin, 1, 0.8, 0.9);
    // orecchie sulla pelle dei lati
    for (const s of [-1, 1]) { const ear = ball(V(-0.012 * s0, -0.006 * s0, s * (fz(-0.012 * s0, -0.006 * s0) - 0.002 * s0)), 0.02 * s0, skin, 0.75, 1.3, 0.42); ear.castShadow = true; }
    // occhi: bulbo, iride e pupilla come calotte rivolte avanti, palpebra superiore e inferiore, sopracciglio curvo
    const capG = (r, a) => new THREE.SphereGeometry(r, 22, 8, 0, 2 * Math.PI, 0, a).rotateZ(-Math.PI / 2);
    for (const s of [-1, 1]) {
      const ez = s * 0.031 * s0, ey = 0.011 * s0, re = 0.0112 * s0, eg = new THREE.Group(); eg.position.set(fx(ey, ez) - 0.0072 * s0, ey, ez); eg.rotation.y = -s * 0.14; headG.add(eg);
      add(new THREE.SphereGeometry(re, 20, 14), mat('#f2eee8', {roughness: 0.22}), eg, false);
      add(capG(re * 1.004, 0.52), mat(lk.eyes || '#5b3b22', {roughness: 0.3}), eg, false);
      add(capG(re * 1.008, 0.22), mat('#0c0c0c', {roughness: 0.15}), eg, false);
      const lidU = add(new THREE.SphereGeometry(re * 1.09, 20, 10, 0, 2 * Math.PI, 0, Math.PI * 0.47), skin, eg, false); lidU.rotation.z = -0.42;
      const lidL = add(new THREE.SphereGeometry(re * 1.06, 20, 8, 0, 2 * Math.PI, 0, Math.PI * 0.3), skin, eg, false); lidL.rotation.z = Math.PI + 0.3;
      if (eyeIn) eg.visible = false;
      const bz = [0.015, 0.031, 0.046].map(z => s * z * s0), by = [0.031, 0.036, 0.031].map(y => y * s0);
      arc(bz.map((z, k) => V(fx(by[k], z) + 0.0012 * s0, by[k], z)), 0.0031 * s0, hairM);
    }
    // bocca: labbra curve che seguono la superficie
    const my = -0.045 * s0, lz = [-0.014, -0.007, 0, 0.007, 0.014].map(z => z * s0);
    arc(lz.map((z, k) => V(fx(my, z) + 0.0016 * s0, my + (k === 2 ? 0.0012 : k % 2 ? 0.0009 : -0.0004) * s0, z)), 0.0036 * s0, lipM);
    arc(lz.slice(1, 4).map(z => V(fx(my - 0.0068 * s0, z) + 0.0015 * s0, my - 0.0068 * s0, z)), 0.0044 * s0, lipM);
    // ---- capelli e barba: strati che seguono la pelle vera (raggio fino alla superficie del campo, più uno spessore che sfuma al bordo) ----
    const rayHit = d => { let lo = 0.06 * s0, hi = 0.2 * s0; if (field(head.x + d.x * lo, head.y + d.y * lo, d.z * lo) > 0) lo = 0.02 * s0;
      for (let r = lo; r < hi; r += 0.003 * s0) if (field(head.x + d.x * r, head.y + d.y * r, d.z * r) > 0) { hi = r; lo = r - 0.003 * s0; break; }
      for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (field(head.x + d.x * m, head.y + d.y * m, d.z * m) > 0) hi = m; else lo = m; } return (lo + hi) / 2; };
    const shell = (key, need, wf, thick, color) => { // geometria con indici (normali morbide); bordo sfumato con la trasparenza per vertice
      const ck = [key, thick, s0.toFixed(3), fat.toFixed(2), Math.round(p.trunk)].join('|'); let g = SHELLS.get(ck);
      if (!g) { g = new THREE.SphereGeometry(1, 120, 80); const Pp = g.attributes.position, n = Pp.count, col = new Float32Array(n * 4), W8 = new Float32Array(n), d = V(0, 0, 0);
      for (let q = 0; q < n; q++) { d.set(Pp.getX(q), Pp.getY(q), Pp.getZ(q)).normalize(); if (!need(d)) { Pp.setXYZ(q, d.x * 0.08 * s0, d.y * 0.08 * s0, d.z * 0.08 * s0); continue; }
        const r = rayHit(d), w = wf(d.x * r / s0, d.y * r / s0, d.z * r / s0);
        W8[q] = w; Pp.setXYZ(q, d.x * (r + (0.0016 + thick * w) * s0), d.y * (r + (0.0016 + thick * w) * s0), d.z * (r + (0.0016 + thick * w) * s0)); col.set([1, 1, 1, w], q * 4); }
      const I = g.index.array, keepI = []; for (let t = 0; t < I.length; t += 3) if (W8[I[t]] + W8[I[t + 1]] + W8[I[t + 2]] > 0.02) keepI.push(I[t], I[t + 1], I[t + 2]);
      g.setIndex(keepI); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.computeVertexNormals(); g.userData.cached = true;
      if (SHELLS.size > 24) { for (const x of SHELLS.values()) x.dispose(); SHELLS.clear(); } SHELLS.set(ck, g); }
      const m = new THREE.MeshStandardMaterial({color, roughness: 0.95, vertexColors: true, transparent: true, side: THREE.DoubleSide}); m.userData.keepT = true;
      const me = add(g, m, headG); me.renderOrder = 2; return me; };
    const sst = (u) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
    // capelli: attaccatura sulla fronte (sotto il casco), sopra le orecchie, bassa sulla nuca
    if (lk.hair !== 'rasati') {
      const hl = x => x > 0.05 ? 0.045 : x > 0 ? 0.045 * x / 0.05 + (1 - x / 0.05) * 0.012 : x > -0.04 ? 0.012 + (-0.06 - 0.012) * (-x / 0.04) : -0.06;
      shell('capelli', d => d.y > -0.45 || d.x < -0.2, (x, y) => sst((y - hl(x)) / 0.016), lk.hair === 'lunghi' ? 0.007 : 0.0045, lk.hairc || '#3a2a20');
      const SK = [0.112 * s0, 0.116 * s0, 0.091 * s0];
      if (lk.hair === 'lunghi') { const lh = add(new THREE.SphereGeometry(1, 24, 12, -Math.PI * 0.45, Math.PI * 0.9, Math.PI * 0.4, Math.PI * 0.42), hairM, headG); lh.scale.set(SK[0] * 1.02, SK[1] * 1.45, SK[2] * 1.03); lh.position.y = -0.02 * s0; lh.material.side = THREE.DoubleSide; }
      if (lk.hair === 'coda' || lk.hair === 'lunghi') { const tail = add(new THREE.CapsuleGeometry(0.018 * s0, 0.09 * s0, 6, 10), hairM, headG); tail.position.set(-0.11 * s0, -0.05 * s0, 0); tail.rotation.z = 0.5; }
    }
    // barba: mento, mandibola e basette, con la bocca libera
    if (lk.beard === 'corta' || lk.beard === 'piena') {
      shell('barba', d => d.y < 0.35 && d.x > -0.55, (x, y, z) => { const cheek = -0.004 - 0.036 * Math.min(1, Math.max(0, (x + 0.02) / 0.11)); // bordo della guancia: dalla basetta all'angolo della bocca
        const mouth = 1 - sst(1.5 - Math.hypot((y + 0.048) / 0.012, z / 0.02)) * sst((x - 0.055) / 0.015);
        return sst((cheek - y) / 0.018) * sst((x + 0.04) / 0.02) * sst((y + 0.14) / 0.025) * mouth; }, lk.beard === 'piena' ? 0.0075 : 0.003, lk.beardc || lk.hairc || '#3a2a20');
    }
    if (lk.beard === 'pizzetto') { const pz = ball(V(fx(-0.072 * s0, 0) - 0.008 * s0, -0.074 * s0, 0), 0.018 * s0, beardM, 0.8, 1.15, 1); pz.castShadow = true; }
    if (lk.beard === 'baffi' || lk.beard === 'corta' || lk.beard === 'piena' || lk.beard === 'pizzetto') {
      const mz = [-0.017, -0.008, 0, 0.008, 0.017].map(z => z * s0), mY = -0.036 * s0;
      arc(mz.map((z, k) => V(fx(mY, z) + 0.0022 * s0, mY - (k === 0 || k === 4 ? 0.004 : 0) * s0, z)), 0.0042 * s0, beardM); }
    // copricapo: calotte che avvolgono la testa (il casco sta sopra le sopracciglia, più basso dietro)
    const hel = new THREE.Group(); hel.rotation.z = lk.head === 'aero' ? -0.12 : 0.14; headG.add(hel);
    if (lk.head === 'casco') {
      const sm = add(new THREE.SphereGeometry(hr * 1.24, 48, 22, 0, Math.PI * 2, 0, Math.PI * 0.5), helmetM, hel); sm.scale.set(1.2, 0.98, 1.08); sm.position.set(-0.012 * sH, 0.03 * sH, 0); sm.material.side = THREE.DoubleSide;
      const rimH = add(new THREE.TorusGeometry(hr * 1.24, 0.0045 * sH, 8, 64), dark, hel); rimH.rotation.x = Math.PI / 2; rimH.scale.set(1.2, 1.08, 1); rimH.position.set(-0.012 * sH, 0.03 * sH, 0); // bordo
      for (const z of [-0.035, 0, 0.035]) { const s2 = add(new THREE.TorusGeometry(hr * 1.27, 0.006, 8, 40, Math.PI * 0.8), z ? dark : helmet2, hel); s2.rotation.z = Math.PI * 0.1; s2.scale.set(1.18, 0.97, 1); s2.position.set(-0.012 * sH, 0.03 * sH, z * sH); }
      for (const s of [-1, 1]) arc([V(0.02 * sH, 0.03 * sH, s * 0.085 * sH), V(0.015 * sH, -0.03 * sH, s * 0.09 * sH), V(0.03 * sH, -0.085 * sH, s * 0.07 * sH)], 0.0022 * sH, dark); // cinghietti
    } else if (lk.head === 'aero') {
      const sm = add(new THREE.SphereGeometry(hr * 1.18, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.6), helmetM, hel); sm.scale.set(1.75, 1.0, 1.05); sm.position.set(-hr * 0.55, 0.014, 0); sm.material.side = THREE.DoubleSide;
      const vis = add(new THREE.CylinderGeometry(hr * 1.12, hr * 1.12, hr * 0.55, 32, 1, true, Math.PI / 2 - 0.9, 1.8), lensM, hel); vis.position.set(0.006, -0.01, 0); vis.material.side = THREE.DoubleSide;
    } else if (lk.head === 'cappellino') {
      const sm = add(new THREE.SphereGeometry(hr * 1.14, 40, 18, 0, Math.PI * 2, 0, Math.PI * 0.5), helmetM, hel); sm.scale.set(1.1, 1.0, 1.0); sm.position.y = 0.03 * sH; sm.material.side = THREE.DoubleSide;
      const vis = add(new THREE.CylinderGeometry(hr * 0.95, hr * 0.95, 0.006, 24, 1, false, Math.PI / 2 - 1.1, 2.2), helmetM, hel); vis.position.set(hr * 0.5, 0.03 * sH, 0); vis.rotation.z = 0.1;
    } else if (lk.head === 'bandana') {
      const sm = add(new THREE.SphereGeometry(hr * 1.13, 40, 18, 0, Math.PI * 2, 0, Math.PI * 0.5), helmetM, hel); sm.scale.set(1.1, 1.0, 1.0); sm.position.y = 0.025 * sH; sm.material.side = THREE.DoubleSide;
      const kn = add(new THREE.SphereGeometry(0.022, 12, 10), helmetM, hel); kn.position.set(-hr * 1.1, 0.0, 0);
    } else {
      // senza copricapo: i capelli sono disegnati sopra (volto)
    }
    if (lk.glasses !== 'nessuno') {
      const mk = lk.glasses === 'mascherina', ph = mk ? 1.0 : 0.86, tU = mk ? 0.2 : 0.15, tD = mk ? 0.17 : 0.12, rS = 0.1 * s0, cY = 0.012 * s0;
      const shM = new THREE.MeshStandardMaterial({color: '#' + new THREE.Color(lk.lens).lerp(new THREE.Color('#0b0d12'), 0.4).getHexString(), roughness: 0.12, metalness: 0.45, transparent: true, opacity: 0.93, side: THREE.DoubleSide});
      // superficie della lente: griglia sulla sfera con contorno a superellisse e incavo per il naso
      const NU = 48, NV = 10, gp = [], gi = [], tc = Math.PI / 2 + (tD - tU) / 2, hh = (tU + tD) / 2;
      for (let i = 0; i <= NU; i++) { const u = -1 + 2 * i / NU, f = Math.PI + u * ph, he = Math.pow(Math.max(0, 1 - Math.abs(u) ** 3.5), 1 / 3.5), notch = (mk ? 0.35 : 0.55) * tD * Math.exp(-((u / 0.14) ** 2));
        const t0 = tc - hh * he * 1.05, t1 = tc + hh * he - notch;
        for (let j = 0; j <= NV; j++) { const t = t0 + (t1 - t0) * j / NV; gp.push(-rS * Math.cos(f) * Math.sin(t), rS * Math.cos(t), rS * Math.sin(f) * Math.sin(t)); } }
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, c = a + NV + 1; gi.push(a, c, a + 1, a + 1, c, c + 1); }
      const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); sgeo.setIndex(gi); sgeo.computeVertexNormals();
      const shield = add(sgeo, shM, headG, false);
      shield.position.set(fx(cY, 0) - rS + 0.013 * s0, cY, 0); shield.scale.set(1, 1, 0.92);
      const fr = new THREE.MeshStandardMaterial({color: '#16181c', roughness: 0.4});
      const topE = []; for (let k = 0; k <= 16; k++) { const u = -0.97 + 1.94 * k / 16, f = Math.PI + u * ph, t = tc - hh * Math.pow(1 - Math.abs(u) ** 3.5, 1 / 3.5) * 1.05; topE.push(V(shield.position.x - rS * Math.cos(f) * Math.sin(t), cY + rS * Math.cos(t), rS * 0.92 * Math.sin(f) * Math.sin(t))); }
      arc(topE, 0.0026 * s0, fr);                                                                                                   // montatura superiore
      for (const s of [-1, 1]) { const e0 = topE[s > 0 ? 16 : 0], y1 = cY + 0.004 * s0;
        arc([e0, V(-0.01 * s0, y1, s * (fz(-0.01 * s0, y1) + 0.0025 * s0)), V(-0.05 * s0, y1 - 0.01 * s0, s * (fz(-0.05 * s0, y1 - 0.01 * s0) + 0.0025 * s0))], 0.0022 * s0, fr); } // asticelle
    }
    // ---- braccia: cinematica inversa spalla → gomito → polso (omero 0,186 e avambraccio 0,155 dell'altezza, Winter) ----
    const La = 0.186 * G.H, Lfa = 0.155 * G.H, hoodA = V(Math.sin(1.2), Math.cos(1.2)), hoodN = V(-Math.cos(1.2), Math.sin(1.2)); // asse e normale della leva
    const armSide = s => {
      const S = V(sh.x, sh.y, s * 0.165 * dep);
      let E, Wr, Hc = null;
      if (tt) { E = V(sh.x + 0.05, sh.y - 0.26, s * 0.11); Wr = V(E.x + 0.30, E.y + 0.05, s * 0.07); }
      else {
        Hc = V(hoodX, bar.y + 0.005, s * 0.21);                                     // centro della leva (cappuccio)
        Wr = Hc.clone().addScaledVector(hoodN, 0.034 * sH).addScaledVector(hoodA, -0.05 * sH); Wr.z = s * 0.2; // polso: dietro e sopra la presa
        const d = S.distanceTo(Wr), e1 = Wr.clone().sub(S).normalize();
        if (d >= La + Lfa - 1e-4) E = S.clone().addScaledVector(e1, La);
        else { const a = (La * La - Lfa * Lfa + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, La * La - a * a));
          const pole = V(-0.3, -1, s * 0.6); pole.addScaledVector(e1, -pole.dot(e1)).normalize();      // gomiti in basso e un po' in fuori
          E = S.clone().addScaledVector(e1, a).addScaledVector(pole, hh); }
      }
      const fa1 = 1 + 0.35 * fat, fa2 = 1 + 0.2 * fat;
      const ua = add(limbGeo(S.distanceTo(E), [[0, 0.047 * sH * fa1], [0.45, 0.044 * sH * fa1], [1, 0.035 * sH]], [[0.2, 0.75, 0.12, -1], [0.15, 0.7, 0.08, 1]]), skin); orient(ua, S, E);
      const sl = add(limbGeo(S.distanceTo(E) * 0.42, [[0, 0.054 * sH * fa1], [1, 0.05 * sH * fa1]]), sleeve); orient(sl, S, E);
      add(new THREE.SphereGeometry(0.036 * sH * fa2, 16, 12), skin).position.copy(E);                       // gomito
      const fa = add(limbGeo(E.distanceTo(Wr), [[0, 0.036 * sH * fa2], [0.3, 0.04 * sH * fa2], [1, 0.025 * sH]], [[0.05, 0.5, 0.1, 1]]), skin); orient(fa, E, Wr);
      if (!Hc) { const hand = add(new THREE.CapsuleGeometry(0.03 * sH, 0.05 * sH, 6, 12), gloves); orient(hand, Wr.clone().add(V(-0.03, 0.01)), Wr.clone().add(V(0.03, -0.02))); hand.scale.set(1.15, 1, 0.85); return; }
      // guanto: dorso e palmo sopra la leva, dita che la avvolgono, pollice all'interno
      const palmC = Hc.clone().addScaledVector(hoodN, 0.024 * sH).addScaledVector(hoodA, -0.006 * sH); palmC.z = s * 0.208;
      seg(Wr, palmC, 0.026 * sH, gloves);
      const palm = add(new THREE.SphereGeometry(1, 20, 14), gloves); palm.scale.set(0.05 * sH, 0.021 * sH, 0.04 * sH); palm.position.copy(palmC); palm.rotation.z = Math.atan2(hoodA.y, hoodA.x);
      const Lf = 1.3 * Math.PI, fg = new THREE.TorusGeometry(0.02 * sH, 0.0088 * sH, 8, 18, Lf).rotateZ(-(Lf + (2 * Math.PI - Lf) / 2));
      const fingers = add(fg, gloves); const a3 = hoodA.clone(), n3 = hoodN.clone();
      fingers.quaternion.setFromRotationMatrix(_m.makeBasis(n3, new THREE.Vector3().crossVectors(a3, n3), a3)); fingers.position.copy(Hc).addScaledVector(hoodA, 0.012 * sH); fingers.position.z = s * 0.21;
      const tIn = V(0, 0, -s * 0.026 * sH);
      seg(palmC.clone().addScaledVector(hoodA, -0.012 * sH).add(tIn), Hc.clone().addScaledVector(hoodA, 0.018 * sH).addScaledVector(hoodN, -0.004 * sH).add(tIn).setZ(s * 0.21 - s * 0.022 * sH), 0.0085 * sH, gloves);
    };
    armSide(1); armSide(-1);

    // ---- bici ----
    const wr = 0.335, tyre = 0.025, ra = V(-0.404, 0.07), BB = V(0, 0);
    // ruota anteriore: l'asse è sulla retta dello sterzo, con 45 mm di offset della forcella, all'altezza di quello posteriore
    const dF = (hb.y + 0.045 * Math.cos(hta) - 0.07) / Math.sin(hta), fa = bk ? V(hb.x - uS[0] * dF + 0.045 * Math.sin(hta), 0.07) : V(0.60, 0.07);
    const stt = V(G.sad[0] * 0.80, G.sad[1] * 0.80), sad = V(G.sad[0] - 0.02, G.sad[1] - 0.01);
    const frameAt = x => { if (lk.fstyle !== 'sfumata') return lk.frame; const t = Math.min(1, Math.max(0, (x + 0.41) / 1.01)); return '#' + new THREE.Color(lk.frame).lerp(new THREE.Color(lk.frame2), t).getHexString(); };
    const paint = c => mat(c, {roughness: 0.28, metalness: 0.35});
    const tube = (a, b, r, m, r2 = r) => { const L = a.distanceTo(b); const g = new THREE.CylinderGeometry(r2, r, L, 20).translate(0, L / 2, 0); const me = add(g, m); orient(me, a, b); return me; };
    const rear = lk.fstyle === 'bicolore' ? lk.frame2 : null;
    for (const s of [-1, 1]) {
      tube(V(0, 0, s * 0.035), V(ra.x, ra.y, s * 0.06), 0.012, paint(rear || frameAt(-0.2)), 0.008);
      tube(V(stt.x, stt.y, s * 0.02), V(ra.x, ra.y, s * 0.06), 0.009, paint(rear || frameAt(-0.3)), 0.007);
      tube(V(hb.x, hb.y, s * 0.02), V(fa.x, fa.y, s * 0.05), 0.014, paint(frameAt(0.57)), 0.009);
    }
    tube(BB, hb, 0.022, paint(frameAt(0.27)), 0.02); tube(BB, stt, 0.018, paint(frameAt(-0.1)), 0.015); tube(stt, ht, 0.016, paint(frameAt(0.2)), 0.017); tube(hb, ht, 0.021, paint(frameAt(0.52)), 0.019);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.075, 24).rotateX(Math.PI / 2), paint(frameAt(0)));
    tube(stt, sad, 0.0135, metal);
    const saddle = add(new THREE.CapsuleGeometry(0.035, 0.2, 8, 16).rotateZ(Math.PI / 2), dark); saddle.position.copy(sad).add(V(0.01, 0.015)); saddle.scale.set(1, 0.38, 1.25);
    if (stemC) { tube(ht, stemC, 0.0165, dark); add(new THREE.CylinderGeometry(0.019, 0.019, 0.006, 20), metal).position.copy(ht); // spessori e calotta
      const st2 = add(new THREE.CylinderGeometry(0.019, 0.019, 0.04, 20), dark); orient(st2, stemC.clone().addScaledVector(V(uS[0], uS[1]), -0.02), stemC.clone().addScaledVector(V(uS[0], uS[1]), 0.02)); // morsetto dell'attacco
      tube(stemC, bar, 0.0155, dark, 0.014); add(new THREE.CylinderGeometry(0.019, 0.019, 0.05, 20).rotateX(Math.PI / 2), dark).position.copy(bar); } // attacco e collarino
    else tube(ht, bar, 0.013, dark);
    tube(V(bar.x, bar.y, -0.21), V(bar.x, bar.y, 0.21), 0.012, dark);
    for (const s of [-1, 1]) {
      const c = new THREE.CatmullRomCurve3([V(bar.x, bar.y, s * 0.21), V(bar.x + barR * 0.85, bar.y - 0.01, s * 0.21), V(bar.x + barR + 0.015, bar.y - 0.08, s * 0.21), V(bar.x + barR - 0.03, bar.y - 0.13, s * 0.21), V(bar.x - 0.03, bar.y - 0.125, s * 0.21)]);
      add(new THREE.TubeGeometry(c, 40, 0.012, 10), dark);
      const hood = add(new THREE.CapsuleGeometry(0.016, 0.04, 6, 10).rotateZ(-1.2), dark); hood.position.set(hoodX, bar.y + 0.005, s * 0.21);
      const lever = add(new THREE.CapsuleGeometry(0.008, 0.09, 4, 8).translate(0, 0.045, 0), dark); orient(lever, V(hoodX + 0.022, bar.y + 0.01, s * 0.21), V(hoodX + 0.03, bar.y - 0.09, s * 0.205)); // leva del freno
      if (tt) tube(V(bar.x, bar.y, s * 0.06), V(bar.x + 0.30, bar.y - 0.06, s * 0.06), 0.011, dark);
    }
    if (lk.ftext) { const tex = textTexture(lk.ftext, contrast(lk.frame));
      for (const s of [-1, 1]) { const pl = add(new THREE.PlaneGeometry(0.34, 0.034), new THREE.MeshStandardMaterial({map: tex, transparent: true, roughness: 0.3}), root, false);
        pl.position.copy(BB.clone().lerp(hb, 0.5)).add(V(0, 0, s * 0.0235)); pl.rotation.set(0, s > 0 ? 0 : Math.PI, Math.atan2(hb.y, hb.x) * (s > 0 ? 1 : -1)); } }
    const imgTex = src => { const img = new Image(), tex = new THREE.Texture(img); img.onload = () => { tex.needsUpdate = true; }; img.src = src; tex.colorSpace = THREE.SRGBColorSpace; return tex; };
    if (lk.flogo) { const tex = imgTex(lk.flogo); for (const s of [-1, 1]) { const pl = add(new THREE.PlaneGeometry(0.05, 0.05), new THREE.MeshStandardMaterial({map: tex, transparent: true}), root, false); pl.position.copy(ht.clone().lerp(hb, 0.5)).add(V(0, 0, s * 0.022)); if (s < 0) pl.rotation.y = Math.PI; } }
    if (lk.logo) { const tex = imgTex(lk.logo); for (const s of [-1, 1]) { const pl = add(new THREE.PlaneGeometry(0.09, 0.09), new THREE.MeshStandardMaterial({map: tex, transparent: true}), root, false);
      const c = at(0.62, 0); pl.position.set(c.x, c.y, s * (0.158 * dep * (1 + 0.15 * fat) + 0.004)); pl.rotation.z = G.al - 0.2; if (s < 0) pl.rotation.y = Math.PI; } }
    const prof = {basso: 0.03, medio: 0.05, alto: 0.08, lenticolare: 0.08};
    const wheels = [ra, fa].map((ax, w) => {
      const g = new THREE.Group(); g.position.copy(ax); root.add(g);
      const pr = lk.wheels === 'lenticolare' && w === 1 ? 'alto' : lk.wheels, d = prof[pr], rIn = wr - tyre - d;
      add(new THREE.TorusGeometry(wr - tyre / 2, tyre / 2, 16, 96), rubber, g);
      const rimPts = [new THREE.Vector2(rIn, -0.011), new THREE.Vector2(wr - tyre * 0.8, -0.0125), new THREE.Vector2(wr - tyre * 0.8, 0.0125), new THREE.Vector2(rIn, 0.011), new THREE.Vector2(rIn, -0.011)];
      add(new THREE.LatheGeometry(rimPts, 96).rotateX(Math.PI / 2), mat(lk.rim, {roughness: 0.3, metalness: 0.3}), g);
      if (pr === 'lenticolare') add(new THREE.CylinderGeometry(rIn + 0.002, rIn + 0.002, 0.02, 64).rotateX(Math.PI / 2), mat(lk.rim, {roughness: 0.25, metalness: 0.2}), g);
      else { const n = {basso: 24, medio: 20, alto: 18}[pr], pos = [];
        for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2, s = j % 2 ? 1 : -1; pos.push(0, 0, s * 0.03, Math.cos(a) * rIn, Math.sin(a) * rIn, 0); }
        const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({color: '#9aa3af'}))); }
      add(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 16).rotateX(Math.PI / 2), metal, g);
      return g;
    });
    add(new THREE.TorusGeometry(0.1, 0.005, 8, 64), metal).position.set(0, 0, 0.055);
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 24).rotateX(Math.PI / 2), metal).position.set(ra.x, ra.y, 0.05);
    { const c = [V(0, 0.1, 0.055), V(ra.x, ra.y + 0.035, 0.05), V(ra.x, ra.y - 0.035, 0.05), V(0, -0.1, 0.055)];
      root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(c), new THREE.LineBasicMaterial({color: '#555b63'}))); }

    // ---- gambe (parti mobili) ----
    const Lc = G.Lc, ft = 1 + 0.4 * fat, fs = 1 + 0.22 * fat;
    // ---- scarpa da strada: superficie morbida (calcagno, collo del piede, avampiede, punta, colletto) sopra una suola rigida ----
    // sistema del piede: origine nella caviglia, x lungo la suola verso la punta, y in alto; lunghezza ≈ 0,152 × altezza
    const k2 = sH, hA = G.hA, ybS = -hA - 0.009, plateT = ybS + 0.006;
    const SE = [[-0.025, 0.044, 0.044, 0.044, 0.039], [0.035, 0.05, 0.07, 0.045, 0.043], [0.11, 0.03, 0.07, 0.03, 0.047], [0.165, 0.022, 0.044, 0.022, 0.039], [-0.012, hA - 0.004, 0.047, 0.03, 0.04]]
      .map(([x, y, rx, ry, rz]) => [x * k2, ybS + y * k2, rx * k2, ry * k2, rz * k2]);
    const fShoe = (x, y, z) => { let d = 1e9; for (const [cx, cy, rx, ry, rz] of SE) { const e = (Math.hypot((x - cx) / rx, (y - cy) / ry, z / rz) - 1) * Math.min(rx, ry, rz); d = smin(d, e, 0.03 * k2); } return Math.max(d, plateT - y); };
    const shoeKey = 'scarpa|' + k2.toFixed(3) + '|' + hA.toFixed(4); let shoeGeo = SHELLS.get(shoeKey);
    if (!shoeGeo) { shoeGeo = surfaceNets(fShoe, V(-0.085 * k2, plateT - 0.004, -0.06 * k2), V(0.225 * k2, 0.03 * k2, 0.06 * k2), 0.0035 * k2, () => new THREE.Color(1, 1, 1)); shoeGeo.userData.cached = true; SHELLS.set(shoeKey, shoeGeo); }
    const fp = new THREE.Shape(); // impronta della suola (x avanti, y = lato)
    fp.moveTo(-0.068 * k2, 0); fp.bezierCurveTo(-0.068 * k2, 0.04 * k2, -0.02 * k2, 0.04 * k2, 0.03 * k2, 0.042 * k2); fp.bezierCurveTo(0.09 * k2, 0.05 * k2, 0.13 * k2, 0.05 * k2, 0.17 * k2, 0.04 * k2);
    fp.bezierCurveTo(0.215 * k2, 0.025 * k2, 0.215 * k2, -0.025 * k2, 0.17 * k2, -0.04 * k2); fp.bezierCurveTo(0.13 * k2, -0.05 * k2, 0.09 * k2, -0.05 * k2, 0.03 * k2, -0.042 * k2);
    fp.bezierCurveTo(-0.02 * k2, -0.04 * k2, -0.068 * k2, -0.04 * k2, -0.068 * k2, 0);
    const plateGeo = new THREE.ExtrudeGeometry(fp, {depth: 0.0075, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 24}).rotateX(Math.PI / 2).translate(0, plateT + 0.001, 0);
    const carbon = mat('#202329', {roughness: 0.32, metalness: 0.35});
    const surfY = (x, z) => { for (let y = 0.04 * k2; y > ybS; y -= 0.0005) if (fShoe(x, y, z) < 0) return y; return plateT; };
    const strap = []; for (let a = -1.25; a <= 1.2501; a += 0.25) { const c = V(0.095 * k2, plateT + 0.004, 0), dir = V(0, Math.cos(a), Math.sin(a)); let r = 0.002; while (r < 0.09 && fShoe(c.x, c.y + dir.y * r, dir.z * r) < 0) r += 0.0007; strap.push(c.clone().addScaledVector(dir, r + 0.0018)); }
    const strapGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strap), 24, 0.006 * k2, 6).scale(1, 1, 1);
    const legs = [1, -1].map(s => {
      // coscia: quadricipite davanti (−1), ischiocrurali dietro (+1); polpaccio dietro, stinco più piatto
      const thigh = add(limbGeo(G.Lf, [[0, 0.084 * k * sH * ft], [0.35, 0.076 * k * sH * ft], [0.8, 0.055 * sH * fs], [1, 0.049 * sH]], [[0.25, 0.85, 0.16, -1], [0.15, 0.7, 0.08, 1]]), skin);
      const shortsL = add(limbGeo(G.Lf * 0.6, [[0, 0.092 * k * sH * ft], [0.55, 0.086 * k * sH * ft], [1, 0.077 * k * sH * ft]], [[0.35, 1.2, 0.15, -1], [0.2, 1.1, 0.08, 1]]), shorts);
      const kneeCap = add(new THREE.SphereGeometry(0.0475 * sH * fs, 24, 16), skin);
      const shank = add(limbGeo(G.Lt, [[0, 0.047 * sH * fs], [0.25, 0.05 * Math.sqrt(sH) * k * fs], [0.65, 0.038 * sH], [1, 0.028 * sH]], [[0.08, 0.55, 0.32, 1], [0.1, 0.9, 0.04, -1]]), skin);
      const foot = new THREE.Group(); root.add(foot);
      const ax = G.Lb - G.cl, ay = -hA - G.st;
      add(shoeGeo, shoeM, foot); add(plateGeo, carbon, foot); add(strapGeo, shoeM, foot);
      const by = surfY(0.035 * k2, s * 0.022 * k2), boa = add(new THREE.CylinderGeometry(0.012 * k2, 0.012 * k2, 0.008 * k2, 20), carbon, foot, false); // rotore di chiusura
      boa.position.set(0.035 * k2, by + 0.002, s * 0.022 * k2); boa.rotation.x = s * 0.45;
      const cleatTop = plateT - 0.0075, cleatBot = Math.max(ay + 0.009, cleatTop - 0.01);                                  // tacchetta sotto la suola
      add(new THREE.CylinderGeometry(0.027, 0.03, cleatTop - cleatBot, 3).rotateY(Math.PI / 6).scale(1.15, 1, 0.95).translate(ax, (cleatTop + cleatBot) / 2, 0), mat('#e5007d', {roughness: 0.5}), foot);
      const pedM = mat('#2d3138', {roughness: 0.35, metalness: 0.45});                                                       // pedale: corpo e perno
      add(new THREE.CapsuleGeometry(0.009, 0.05, 4, 12).rotateZ(Math.PI / 2).scale(1, 1, 3.2).translate(ax, ay, 0), pedM, foot);
      add(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 12).rotateX(Math.PI / 2).translate(ax, ay, -s * 0.035), metal, foot);
      const crank = new THREE.Group(); crank.position.set(0, 0, s * 0.075); root.add(crank);
      add(new THREE.BoxGeometry(0.03, Lc, 0.012).translate(0, Lc / 2, 0), metal, crank);
      add(new THREE.CylinderGeometry(0.007, 0.007, 0.05, 10).rotateX(Math.PI / 2).translate(0, Lc, s * 0.025), metal, crank);
      return {s, thigh, shortsL, kneeCap, shank, foot, crank};
    });
    // ---- ossa (vista Muscoli) e muscoli ----
    const boneM = mat('#e8e3d8', {roughness: 0.6});
    const bones = legs.map(() => ({fem: add(limbGeo(G.Lf, [[0, 0.016], [1, 0.016]], [], 12), boneM), tib: add(limbGeo(G.Lt, [[0, 0.015], [1, 0.012]], [], 12), boneM), ft: add(limbGeo(G.Lfoot, [[0, 0.011], [1, 0.008]], [], 10), boneM)}));
    const spine = add(limbGeo(Ls, [[0, 0.018], [1, 0.014]], [], 12), boneM); orient(spine, hip0, sh);
    const unit = new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0);
    const muscles = legs.map(() => R.ms.map(m => { const mm = new THREE.MeshStandardMaterial({color: m.col, emissive: m.col, emissiveIntensity: 0.3, roughness: 0.5, transparent: true});
      const me = new THREE.Mesh(unit, mm); root.add(me); return {me, r: Math.max(0.008, Math.sqrt(m.A) * 0.0028)}; }));
    const ghostG = new THREE.BufferGeometry(); ghostG.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    const ghost = new THREE.Line(ghostG, new THREE.LineDashedMaterial({color: '#e5007d', dashSize: 0.03, gapSize: 0.02, depthTest: false})); ghost.renderOrder = 5; root.add(ghost);
    const arM = new THREE.MeshBasicMaterial({color: 0xe5007d, depthTest: false}), arrow = new THREE.Group();
    arrow.userData.shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 12).translate(0, 0.5, 0), arM);
    arrow.userData.head = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.05, 16).translate(0, 0.025, 0), arM);
    arrow.add(arrow.userData.shaft, arrow.userData.head); arrow.traverse(o => { o.renderOrder = 6; }); root.add(arrow);
    // i dettagli del volto sfumano con il corpo nelle viste Muscoli e Atleta + muscoli
    headG.traverse(o => { if (o.isMesh && !bodyMats.includes(o.material)) bodyMats.push(o.material); });
    root.traverse(o => { if (o.isMesh) o.userData.body = bodyMats.includes(o.material); });
    rig = {root, legs, bones, muscles, wheels, ghost, ghostG, arrow, bodyMats, boneM, hipZ, kneeZ, ankZ, pedZ, hip0, U, BK, view: null};
  }

  function setView(view) {
    if (rig.view === view) return; rig.view = view;
    const see = view === 'atleta' ? 1 : view === 'entrambi' ? 0.42 : 0.12;
    for (const m of rig.bodyMats) { m.transparent = see < 1 || !!m.userData.keepT; m.opacity = see; m.depthWrite = see === 1; m.needsUpdate = true; }
    rig.root.traverse(o => { if (o.userData.body) o.castShadow = see === 1; });
    rig.boneM.visible = view === 'muscoli';
    for (const l of rig.muscles) for (const x of l) x.me.visible = view !== 'atleta';
  }

  function render(st, W, H) {
    if (!W || !H) return;
    if (W !== lastW || H !== lastH) { renderer.setSize(W, H, false); cam.aspect = W / H; lastW = W; lastH = H; }
    const sc = SC[st.LOOK.scene] ? st.LOOK.scene : 'nessuno';
    if (sc !== envName) { buildEnv(sc); envName = sc; }
    if (st.ver !== ver || !rig) { build(st); ver = st.ver; rig.view = null; }
    setView(st.VIEW);
    const {R} = st, N = R.leg.length, i = Math.round(st.th / (2 * Math.PI) * N) % N, run = st.DIST * 0.5;
    const az = (st.ROT || 0) * Math.PI / 180, el = (st.elev ?? 4) * Math.PI / 180, target = V(0.09, 0.6, 0);
    const vh = 1.92, vw = 2.1, f = Math.tan(cam.fov * Math.PI / 360), d = Math.max(vh / 2 / f, vw / 2 / (f * cam.aspect)) * 1.02;
    cam.position.set(target.x - Math.sin(az) * Math.cos(el) * d, target.y + Math.sin(el) * d, target.z + Math.cos(az) * Math.cos(el) * d);
    cam.lookAt(target); cam.updateProjectionMatrix();
    if (near) near.position.x = -(run % PERIOD);
    const L2 = (q, z) => V(q[0], q[1], z);
    const pel = (a, b, z) => V(rig.hip0.x + rig.U[0] * a + rig.BK[0] * b, rig.hip0.y + rig.U[1] * a + rig.BK[1] * b, z);
    rig.legs.forEach((lg, j) => {
      const P = R.P[j === 0 ? i : (i + N / 2) % N], s = lg.s;
      const hip = L2(P.hip, s * rig.hipZ), knee = L2(P.knee, s * rig.kneeZ), ank = L2(P.ank, s * rig.ankZ), ped = L2(P.ped, s * rig.pedZ);
      orient(lg.thigh, hip, knee); orient(lg.shortsL, hip, knee); lg.kneeCap.position.copy(knee);
      orient(lg.shank, knee, ank);
      lg.foot.position.copy(ank); lg.foot.rotation.set(0, 0, P.sole);
      lg.crank.rotation.z = Math.atan2(P.ped[1], P.ped[0]) - Math.PI / 2;
      const b = rig.bones[j]; orient(b.fem, hip, knee); orient(b.tib, knee, ank); orient(b.ft, ank, ped);
      const pt = (a, c, fr, off) => { const dx = c[0] - a[0], dy = c[1] - a[1], n = Math.hypot(dx, dy); return [a[0] + dx * fr - dy / n * off, a[1] + dy * fr + dx / n * off]; };
      const heel = pt(P.ank, P.ped, -0.35, -0.01), zl = s * rig.kneeZ;
      const att = {glut: [pel(0.05, 0.08, s * 0.07), pt(P.hip, P.knee, 0.25, -0.035)], hams: [pel(-0.02, 0.05, s * 0.07), pt(P.knee, P.ank, 0.12, -0.03)],
        vast: [pt(P.hip, P.knee, 0.3, 0.035), pt(P.knee, P.ank, 0.08, 0.03)], rf: [pel(0.06, -0.03, s * 0.07), pt(P.knee, P.ank, 0.06, 0.04)],
        ilio: [pel(0.14, -0.01, s * 0.05), pt(P.hip, P.knee, 0.1, 0.03)], gast: [pt(P.hip, P.knee, 0.93, -0.03), heel], sol: [pt(P.knee, P.ank, 0.3, -0.03), heel],
        ta: [pt(P.knee, P.ank, 0.2, 0.03), pt(P.ank, P.ped, 0.5, 0.02)]};
      const leg = R.leg[j === 0 ? i : (i + N / 2) % N];
      R.ms.forEach((m, q) => { const x = rig.muscles[j][q], [a0, a1] = att[m.id];
        const A = a0.isVector3 ? a0 : V(a0[0], a0[1], zl), B = a1.isVector3 ? a1 : V(a1[0], a1[1], zl);
        const Lm = orient(x.me, A, B); x.me.scale.set(x.r, Lm, x.r);
        const act = Math.min(1, leg.mf[q].a / Math.max(R.al, 0.05)); x.me.material.opacity = 0.3 + 0.7 * act; x.me.material.emissiveIntensity = 0.1 + 0.9 * act; });
    });
    rig.wheels.forEach(g => { g.rotation.z = -run / 0.335; });
    const P = R.P[i], fv = R.leg[i].f, fm = Math.hypot(fv[0], fv[1]), fmax = Math.max(...R.leg.map(l => Math.hypot(...l.f)), 1);
    rig.arrow.visible = fm > 20 && (st.LOOK || {}).force !== 'no';
    if (rig.arrow.visible) { const Ln = 0.08 + 0.2 * fm / fmax; rig.arrow.position.set(P.ped[0], P.ped[1], rig.pedZ + 0.06); rig.arrow.quaternion.setFromUnitVectors(V(0, 1, 0), V(fv[0] / fm, fv[1] / fm, 0)); rig.arrow.userData.shaft.scale.set(1, Ln - 0.05, 1); rig.arrow.userData.head.position.y = Ln - 0.05; }
    rig.ghost.visible = !!st.RA;
    if (st.RA) { const Q = st.RA.P[i], a = rig.ghostG.attributes.position, z = rig.hipZ + 0.06;
      [Q.hip, Q.knee, Q.ank, Q.ped].forEach((q, n) => a.setXYZ(n, q[0], q[1], z)); a.needsUpdate = true; rig.ghost.computeLineDistances(); }
    renderer.render(scene, cam);
  }

  // fotografia del render per la scheda atleta: si disegna e si legge subito il buffer
  const snapshot = (st, W, H) => { const w0 = lastW, h0 = lastH; render(st, W, H); const url = renderer.domElement.toDataURL('image/png'); if (w0 && h0) render(st, w0, h0); return url; };
  window.BIO3D = {ok: true, render, snapshot, has3DScene: true};
}
