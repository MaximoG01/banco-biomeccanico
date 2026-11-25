// Rendering 3D del ciclista (Three.js). Legge lo stato del modello da window.BIO e disegna nella figura #bike.
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
  host.insertBefore(cv, host.querySelector('.figbtn'));

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 60);
  scene.add(new THREE.HemisphereLight(0xeef6ff, 0x5c5248, 1.15));
  const sun = new THREE.DirectionalLight(0xfff6ea, 2.4);
  sun.position.set(1.2, 3.2, 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -1.8, right: 1.8, top: 2.2, bottom: -1.2, near: 0.5, far: 9});
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc8dcff, 0.7); fill.position.set(-2.2, 1.4, -1.8); scene.add(fill);
  const rimL = new THREE.DirectionalLight(0xffffff, 0.5); rimL.position.set(-1, 2, 2.5); scene.add(rimL);
  const GROUND_Y = 0.07 - 0.335;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({opacity: 0.3}));
  ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND_Y; ground.receiveShadow = true; scene.add(ground);

  const SKINS = {chiara: '#efc4a4', media: '#d9a17f', olivastra: '#b98560', scura: '#7a4e34'};
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const Z = V(0, 0, 1);
  const _m = new THREE.Matrix4();
  // orienta un oggetto (asse locale +y lungo il segmento) da a verso b, con l'asse z il più vicino possibile a z mondo
  const orient = (o, a, b) => {
    const y = b.clone().sub(a), L = y.length() || 1e-6; y.multiplyScalar(1 / L);
    let z = Z.clone().addScaledVector(y, -y.dot(Z)); if (z.lengthSq() < 1e-8) z = V(1, 0, 0); z.normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    o.quaternion.setFromRotationMatrix(_m.makeBasis(x, y, z)); o.position.copy(a); return L;
  };
  // arto: superficie di rotazione con estremità arrotondate; keys = [[t (0..1), raggio], …]
  const limbGeo = (L, keys, seg = 32) => {
    const R = t => { for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, r0] = keys[i - 1], [t1, r1] = keys[i], u = (t - t0) / ((t1 - t0) || 1), s = u * u * (3 - 2 * u); return r0 + (r1 - r0) * s; } return keys[keys.length - 1][1]; };
    const r0 = keys[0][1], r1 = keys[keys.length - 1][1], pts = [];
    for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push(new THREE.Vector2(r0 * Math.sin(a), -r0 * 0.75 * Math.cos(a))); }
    for (let i = 1; i < 30; i++) { const t = i / 30; pts.push(new THREE.Vector2(R(t), t * L)); }
    for (let i = 0; i <= 8; i++) { const a = (1 - i / 8) * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(1e-4, r1 * Math.sin(a)), L + r1 * 0.75 * Math.cos(a))); }
    pts[0].x = 1e-4;
    return new THREE.LatheGeometry(pts, seg);
  };
  const disposeAll = o => o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) [].concat(c.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });

  let rig = null, ver = -1, lastW = 0, lastH = 0, groundPx = {gy: 0, s: 300};

  function jerseyTexture(lk) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
    g.fillStyle = lk.jersey; g.fillRect(0, 0, 64, 256);
    g.fillStyle = lk.jersey2;
    // v = 0 in basso (vita), v = 1 in alto (spalle); il canvas ha y verso il basso
    if (lk.pattern === 'fascia') g.fillRect(0, 256 * (1 - 0.66), 64, 256 * 0.18);
    if (lk.pattern === 'fianchi') g.fillRect(0, 256 * (1 - 0.3), 64, 256 * 0.3);
    if (lk.pattern === 'righe') for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 64, 12);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function textTexture(text, color, bg) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, 512, 64); }
    g.fillStyle = color; g.font = '700 44px "Barlow Condensed", Barlow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 34); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const contrast = c => { const n = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); return (n[0] * 0.299 + n[1] * 0.587 + n[2] * 0.114) > 150 ? '#15191f' : '#ffffff'; };

  function build(st) {
    if (rig) { scene.remove(rig.root); disposeAll(rig.root); }
    const {R, p, LOOK: lk} = st, G = R.G, sH = G.H / 1.78, bf = Math.sqrt(p.mass / (G.H * G.H) / 22.7), k = p.thigh / 17.5;
    const root = new THREE.Group(); scene.add(root);
    const mat = (c, o = {}) => new THREE.MeshStandardMaterial({color: c, roughness: 0.6, metalness: 0, ...o});
    const add = (geo, m, parent = root, shadow = true) => { const me = new THREE.Mesh(geo, m); me.castShadow = shadow; me.receiveShadow = true; parent.add(me); return me; };
    const skin = mat(SKINS[lk.skin] || SKINS.media, {roughness: 0.55});
    const jersey = mat('#ffffff', {map: jerseyTexture(lk), roughness: 0.7});
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
    const bodyMats = [skin, jersey, sleeve, shorts, gloves, helmetM, helmet2, lensM];
    const hipZ = 0.085 * sH, kneeZ = 0.095 * sH, ankZ = 0.105 * sH, pedZ = 0.12;
    const u2 = [Math.cos(G.al), Math.sin(G.al)], bk = [-u2[1], u2[0]];
    const hip0 = V(G.hip[0], G.hip[1]);
    const sh = V(G.hip[0] + u2[0] * 0.30 * G.H, G.hip[1] + u2[1] * 0.30 * G.H);
    const ht = V(0.50, 0.58), hb = V(0.54, 0.42), bar = V(0.56, 0.68), head = V(sh.x + u2[0] * 0.13 + 0.03, sh.y + u2[1] * 0.13);
    const tt = p.trunk < 28;

    // ---- busto, bacino, collo, testa ----
    const Ls = sh.distanceTo(hip0), dep = bf * sH;
    const torso = add(limbGeo(Ls, [[0, 0.10 * dep], [0.25, 0.104 * dep], [0.5, 0.098 * dep], [0.78, 0.118 * dep], [0.93, 0.108 * dep], [1, 0.07 * dep]], 40), jersey);
    orient(torso, hip0, sh); torso.scale.set(1, 1, 1.55);
    const pelvis = add(new THREE.SphereGeometry(1, 32, 20), shorts);
    pelvis.position.copy(hip0).add(V(bk[0] * 0.01, bk[1] * 0.01)); pelvis.quaternion.copy(torso.quaternion); pelvis.scale.set(0.115 * dep, 0.105 * dep, 0.16 * dep);
    const neckA = sh.clone().add(V(u2[0] * 0.03, u2[1] * 0.03)), neckB = head.clone().add(V(-0.03 * sH, -0.055 * sH));
    const neck = add(limbGeo(neckA.distanceTo(neckB), [[0, 0.05 * sH], [1, 0.042 * sH]]), skin); orient(neck, neckA, neckB);
    const hr = 0.092 * sH, headG = new THREE.Group(); headG.position.copy(head); root.add(headG);
    const skull = add(new THREE.SphereGeometry(hr, 32, 24), skin, headG); skull.scale.set(1.06, 1.12, 0.9);
    const nose = add(new THREE.ConeGeometry(0.014 * sH, 0.035 * sH, 12), skin, headG); nose.rotation.z = -Math.PI / 2 - 0.3; nose.position.set(hr * 1.05, -0.01 * sH, 0);
    for (const s of [-1, 1]) { const ear = add(new THREE.SphereGeometry(0.02 * sH, 12, 10), skin, headG); ear.scale.set(0.8, 1.3, 0.5); ear.position.set(-0.01, -0.005, s * hr * 0.9); }
    // copricapo: calotte che avvolgono la testa
    const hel = new THREE.Group(); hel.rotation.z = -0.12; headG.add(hel);
    if (lk.head === 'casco') {
      const sm = add(new THREE.SphereGeometry(hr * 1.16, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.56), helmetM, hel); sm.scale.set(1.22, 1.02, 1.08); sm.position.set(-0.01, 0.012, 0); sm.material.side = THREE.DoubleSide;
      for (const z of [-0.035, 0, 0.035]) { const st2 = add(new THREE.TorusGeometry(hr * 1.2, 0.006, 8, 40, Math.PI * 0.8), z ? dark : helmet2, hel); st2.rotation.z = Math.PI * 0.1; st2.scale.set(1.2, 1.0, 1); st2.position.set(-0.01, 0.014, z * sH); }
    } else if (lk.head === 'aero') {
      const sm = add(new THREE.SphereGeometry(hr * 1.14, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.6), helmetM, hel); sm.scale.set(1.75, 1.0, 1.05); sm.position.set(-hr * 0.55, 0.01, 0); sm.material.side = THREE.DoubleSide;
      const vis = add(new THREE.CylinderGeometry(hr * 1.08, hr * 1.08, hr * 0.55, 32, 1, true, Math.PI / 2 - 0.9, 1.8), lensM, hel); vis.position.set(0.004, -0.01, 0); vis.material.side = THREE.DoubleSide;
      const st2 = add(new THREE.TorusGeometry(hr * 1.15, 0.007, 8, 40, Math.PI * 0.7), helmet2, hel); st2.rotation.z = Math.PI * 0.18; st2.scale.set(1.7, 1, 1); st2.position.set(-hr * 0.5, 0.012, 0);
    } else if (lk.head === 'cappellino') {
      const sm = add(new THREE.SphereGeometry(hr * 1.07, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), helmetM, hel); sm.scale.set(1.08, 1.05, 0.95); sm.position.y = 0.01;
      const vis = add(new THREE.CylinderGeometry(hr * 0.95, hr * 0.95, 0.006, 24, 1, false, Math.PI / 2 - 1.1, 2.2), helmetM, hel); vis.position.set(hr * 0.45, 0.006, 0); vis.rotation.z = -0.15;
    } else if (lk.head === 'bandana') {
      const sm = add(new THREE.SphereGeometry(hr * 1.05, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), helmetM, hel); sm.scale.set(1.08, 1.1, 0.93);
      const kn = add(new THREE.SphereGeometry(0.022, 12, 10), helmetM, hel); kn.position.set(-hr * 1.05, 0.0, 0);
    } else {
      const hair = add(new THREE.SphereGeometry(hr * 1.02, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), mat('#3a2a20', {roughness: 0.9}), hel); hair.scale.set(1.08, 1.12, 0.93);
    }
    if (lk.glasses !== 'nessuno') {
      const h = lk.glasses === 'mascherina' ? hr * 0.42 : hr * 0.3, ang = lk.glasses === 'mascherina' ? 1.9 : 1.6;
      const lens = add(new THREE.CylinderGeometry(hr * 1.02, hr * 1.0, h, 32, 1, true, Math.PI / 2 - ang / 2, ang), lensM, headG);
      lens.position.set(0.006, 0.012 * sH, 0); lens.scale.set(1.06, 1, 0.92); lens.material.side = THREE.DoubleSide;
      for (const s of [-1, 1]) { const arm = add(new THREE.BoxGeometry(hr * 0.9, 0.004, 0.004), dark, headG); arm.position.set(-hr * 0.15, 0.014 * sH, s * hr * 0.88); }
    }
    // ---- braccia ----
    const armSide = s => {
      const S = V(sh.x, sh.y, s * 0.17 * bf * sH);
      let E, Hn;
      if (tt) { E = V(sh.x + 0.05, sh.y - 0.26, s * 0.11); Hn = V(E.x + 0.30, E.y + 0.05, s * 0.07); }
      else { Hn = V(bar.x + 0.065, bar.y + 0.005, s * 0.2); E = V((sh.x + Hn.x) / 2 - 0.03, (sh.y + Hn.y) / 2 - 0.08, s * 0.2); }
      const ua = add(limbGeo(S.distanceTo(E), [[0, 0.047 * sH], [0.5, 0.043 * sH], [1, 0.036 * sH]]), skin); orient(ua, S, E);
      const sl = add(limbGeo(S.distanceTo(E) * 0.45, [[0, 0.052 * sH * bf], [1, 0.047 * sH]]), sleeve); orient(sl, S, E);
      const cap = add(new THREE.SphereGeometry(0.058 * sH * bf, 20, 14), sleeve); cap.position.copy(S);
      const fa = add(limbGeo(E.distanceTo(Hn), [[0, 0.036 * sH], [0.35, 0.039 * sH], [1, 0.027 * sH]]), skin); orient(fa, E, Hn);
      const hand = add(new THREE.SphereGeometry(0.042 * sH, 16, 12), gloves); hand.position.copy(Hn); hand.scale.set(1.25, 0.8, 0.9);
    };
    armSide(1); armSide(-1);

    // ---- bici ----
    const wr = 0.335, tyre = 0.025, ra = V(-0.41, 0.07), fa = V(0.60, 0.07), BB = V(0, 0);
    const stt = V(G.sad[0] * 0.80, G.sad[1] * 0.80), sad = V(G.sad[0] - 0.02, G.sad[1] - 0.01);
    const xmin = -0.41, xmax = 0.6;
    const frameAt = x => { if (lk.fstyle !== 'sfumata') return lk.frame; const t = Math.min(1, Math.max(0, (x - xmin) / (xmax - xmin))); return '#' + new THREE.Color(lk.frame).lerp(new THREE.Color(lk.frame2), t).getHexString(); };
    const paint = c => mat(c, {roughness: 0.28, metalness: 0.35});
    const tube = (a, b, r, m) => { const L = a.distanceTo(b); const g = new THREE.CylinderGeometry(r, r, L, 18).translate(0, L / 2, 0); const me = add(g, m); orient(me, a, b); return me; };
    const rear = lk.fstyle === 'bicolore' ? lk.frame2 : null;
    for (const s of [-1, 1]) {
      tube(V(0, 0, s * 0.035), V(ra.x, ra.y, s * 0.06), 0.011, paint(rear || frameAt(-0.2)));
      tube(V(stt.x, stt.y, s * 0.02), V(ra.x, ra.y, s * 0.06), 0.009, paint(rear || frameAt(-0.3)));
      tube(V(hb.x, hb.y, s * 0.02), V(fa.x, fa.y, s * 0.05), 0.012, paint(frameAt(0.57)));
    }
    const dt = tube(BB, hb, 0.022, paint(frameAt(0.27)));
    tube(BB, stt, 0.017, paint(frameAt(-0.1))); tube(stt, ht, 0.015, paint(frameAt(0.2))); tube(hb, ht, 0.02, paint(frameAt(0.52)));
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.075, 24).rotateX(Math.PI / 2), paint(frameAt(0)));                      // scatola movimento centrale
    tube(stt, sad, 0.0135, metal);                                                                                          // reggisella
    const saddle = add(new THREE.CapsuleGeometry(0.035, 0.2, 8, 16).rotateZ(Math.PI / 2), dark); saddle.position.copy(sad).add(V(0.01, 0.015)); saddle.scale.set(1, 0.38, 1.25);
    tube(ht, bar, 0.013, dark);                                                                                            // attacco
    tube(V(bar.x, bar.y, -0.21), V(bar.x, bar.y, 0.21), 0.012, dark);                                                      // curva
    for (const s of [-1, 1]) {
      const c = new THREE.CatmullRomCurve3([V(bar.x, bar.y, s * 0.21), V(bar.x + 0.07, bar.y - 0.01, s * 0.21), V(bar.x + 0.095, bar.y - 0.08, s * 0.21), V(bar.x + 0.05, bar.y - 0.14, s * 0.21), V(bar.x - 0.03, bar.y - 0.13, s * 0.21)]);
      add(new THREE.TubeGeometry(c, 32, 0.012, 10), dark);
      const hood = add(new THREE.CapsuleGeometry(0.016, 0.04, 6, 10).rotateZ(-1.2), dark); hood.position.set(bar.x + 0.07, bar.y + 0.005, s * 0.21);
      if (tt) tube(V(bar.x, bar.y, s * 0.06), V(bar.x + 0.30, bar.y - 0.06, s * 0.06), 0.011, dark);
    }
    if (lk.ftext) { const tex = textTexture(lk.ftext, contrast(lk.frame));
      for (const s of [-1, 1]) { const pl = add(new THREE.PlaneGeometry(0.34, 0.034), new THREE.MeshStandardMaterial({map: tex, transparent: true, roughness: 0.3}), root, false);
        pl.position.copy(BB.clone().lerp(hb, 0.5)).add(V(0, 0, s * 0.0235)); pl.rotation.set(0, s > 0 ? 0 : Math.PI, Math.atan2(hb.y, hb.x) * (s > 0 ? 1 : -1)); } }
    if (lk.flogo) { const img = new Image(); img.src = lk.flogo; const tex = new THREE.Texture(img); img.onload = () => { tex.needsUpdate = true; }; tex.colorSpace = THREE.SRGBColorSpace;
      for (const s of [-1, 1]) { const pl = add(new THREE.PlaneGeometry(0.05, 0.05), new THREE.MeshStandardMaterial({map: tex, transparent: true}), root, false); pl.position.copy(ht.clone().lerp(hb, 0.5)).add(V(0, 0, s * 0.021)); if (s < 0) pl.rotation.y = Math.PI; } }
    if (lk.logo) { const img = new Image(); img.src = lk.logo; const tex = new THREE.Texture(img); img.onload = () => { tex.needsUpdate = true; }; tex.colorSpace = THREE.SRGBColorSpace;
      for (const s of [-1, 1]) { const pl = add(new THREE.PlaneGeometry(0.09, 0.09), new THREE.MeshStandardMaterial({map: tex, transparent: true}), root, false);
        const c = hip0.clone().lerp(sh, 0.55); pl.position.set(c.x, c.y, s * 0.105 * dep * 1.55 + s * 0.004); pl.rotation.z = G.al - 0.2; if (s < 0) pl.rotation.y = Math.PI; } }
    // ruote
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
    // trasmissione
    add(new THREE.TorusGeometry(0.1, 0.005, 8, 64), metal).position.set(0, 0, 0.055);
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 24).rotateX(Math.PI / 2), metal).position.set(ra.x, ra.y, 0.05);
    { const c = [V(0, 0.1, 0.055), V(ra.x, ra.y + 0.035, 0.05), V(ra.x, ra.y - 0.035, 0.05), V(0, -0.1, 0.055)];
      const g = new THREE.BufferGeometry().setFromPoints([c[0], c[1], c[2], c[3]]); root.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({color: '#555b63'}))); }

    // ---- gambe (parti mobili) ----
    const Lc = G.Lc;
    const legs = [1, -1].map(s => {
      const thigh = add(limbGeo(G.Lf, [[0, 0.088 * k * sH], [0.3, 0.08 * k * sH], [0.78, 0.058 * sH], [1, 0.05 * sH]]), skin);
      const shortsL = add(limbGeo(G.Lf * 0.6, [[0, 0.1 * k * sH], [0.5, 0.092 * k * sH], [1, 0.082 * k * sH]]), shorts);
      const kneeCap = add(new THREE.SphereGeometry(0.052 * sH, 20, 14), skin);
      const shank = add(limbGeo(G.Lt, [[0, 0.049 * sH], [0.22, 0.06 * Math.sqrt(sH) * k], [0.6, 0.042 * sH], [1, 0.03 * sH]]), skin);
      // piede: scarpa, suola, tacchetta e pedale nel sistema del piede (x lungo la pianta, y verso l'alto)
      const foot = new THREE.Group(); root.add(foot);
      const hA = G.hA, Lb = G.Lb, yb = -hA - 0.009, ax = Lb - G.cl, ay = -hA - G.st, k2 = sH, dp = 0.085 * sH;
      const shp = new THREE.Shape(); shp.moveTo(-0.05 * k2, yb);
      shp.lineTo(Lb + 0.06 * k2, yb); shp.quadraticCurveTo(Lb + 0.09 * k2, yb + 0.004, Lb + 0.075 * k2, yb + 0.02);
      shp.quadraticCurveTo(Lb + 0.055 * k2, -hA + 0.035 * k2, Lb * 0.45, -hA + 0.062 * k2);
      shp.quadraticCurveTo(0.06 * k2, 0.02 * k2, 0.035 * k2, 0.04 * k2); shp.lineTo(-0.035 * k2, 0.035 * k2);
      shp.quadraticCurveTo(-0.07 * k2, -hA * 0.2, -0.06 * k2, -hA + 0.01); shp.closePath();
      add(new THREE.ExtrudeGeometry(shp, {depth: dp, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 4, curveSegments: 16}).translate(0, 0, -dp / 2), shoeM, foot);
      add(new THREE.BoxGeometry(Lb + 0.12 * k2, 0.007, dp + 0.02).translate((Lb + 0.12 * k2) / 2 - 0.055 * k2, yb - 0.002, 0), dark, foot);
      add(new THREE.BoxGeometry(0.05, 0.006, 0.055).translate(ax, yb - 0.008, 0), mat('#e5007d', {roughness: 0.5}), foot);
      const pt = Math.max(yb - 0.011, ay + 0.004), pb = Math.min(ay - 0.008, pt - 0.012);
      add(new THREE.BoxGeometry(0.085, pt - pb, 0.07).translate(ax, (pt + pb) / 2, 0), mat('#3a3f47', {roughness: 0.4, metalness: 0.3}), foot);
      // pedivella
      const crank = new THREE.Group(); crank.position.set(0, 0, s * 0.075); root.add(crank);
      add(new THREE.BoxGeometry(0.03, Lc, 0.012).translate(0, Lc / 2, 0), metal, crank);
      add(new THREE.CylinderGeometry(0.007, 0.007, 0.05, 10).rotateX(Math.PI / 2).translate(0, Lc, s * 0.025), metal, crank);
      return {s, thigh, shortsL, kneeCap, shank, foot, crank};
    });
    // ---- ossa (vista Muscoli) e muscoli ----
    const boneM = mat('#e8e3d8', {roughness: 0.6});
    const bones = legs.map(() => ({fem: add(limbGeo(G.Lf, [[0, 0.016], [1, 0.016]], 12), boneM), tib: add(limbGeo(G.Lt, [[0, 0.015], [1, 0.012]], 12), boneM), ft: add(limbGeo(G.Lfoot, [[0, 0.011], [1, 0.008]], 10), boneM)}));
    const spine = add(limbGeo(Ls, [[0, 0.018], [1, 0.014]], 12), boneM); orient(spine, hip0, sh);
    const unit = new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0);
    const muscles = legs.map(() => R.ms.map(m => { const mm = new THREE.MeshStandardMaterial({color: m.col, emissive: m.col, emissiveIntensity: 0.3, roughness: 0.5, transparent: true});
      const me = new THREE.Mesh(unit, mm); me.castShadow = false; root.add(me); return {me, r: Math.max(0.008, Math.sqrt(m.A) * 0.0028)}; }));
    // gamba di A tratteggiata e freccia della forza
    const ghostG = new THREE.BufferGeometry(); ghostG.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    const ghost = new THREE.Line(ghostG, new THREE.LineDashedMaterial({color: '#e5007d', dashSize: 0.03, gapSize: 0.02, depthTest: false})); ghost.renderOrder = 5; root.add(ghost);
    const arrow = new THREE.ArrowHelper(V(0, -1, 0), V(), 0.2, 0xe5007d, 0.05, 0.035); arrow.renderOrder = 6;
    arrow.line.material.depthTest = false; arrow.cone.material.depthTest = false; arrow.line.material.linewidth = 3; root.add(arrow);
    root.traverse(o => { if (o.isMesh && o.material !== boneM && !muscles.some(l => l.some(x => x.me === o))) o.userData.body = bodyMats.includes(o.material); });
    rig = {root, legs, bones, muscles, wheels, ghost, ghostG, arrow, bodyMats, boneM, hipZ, kneeZ, ankZ, pedZ, hip0, u2, bk, sH, Lc, view: null};
  }

  function setView(view) {
    if (rig.view === view) return; rig.view = view;
    const show = view !== 'atleta', see = view === 'atleta' ? 1 : view === 'entrambi' ? 0.42 : 0.1;
    for (const m of rig.bodyMats) { m.transparent = see < 1; m.opacity = see; m.depthWrite = see === 1; m.needsUpdate = true; }
    rig.root.traverse(o => { if (o.userData.body) o.castShadow = see === 1; });
    rig.boneM.visible = view === 'muscoli';
    for (const l of rig.muscles) for (const x of l) x.me.visible = show;
  }

  function render(st, W, H) {
    if (!W || !H) return;
    if (W !== lastW || H !== lastH) { renderer.setSize(W, H, false); cam.aspect = W / H; lastW = W; lastH = H; }
    if (st.ver !== ver || !rig) { build(st); ver = st.ver; rig.view = null; }
    setView(st.VIEW);
    const {R} = st, N = R.leg.length, i = Math.round(st.th / (2 * Math.PI) * N) % N;
    // camera: azimut dalla rotazione della pagina, elevazione dal trascinamento verticale
    const az = (st.ROT || 0) * Math.PI / 180, el = (st.elev ?? 8) * Math.PI / 180, target = V(0.09, 0.6, 0);
    const vh = 1.92, vw = 2.1, f = Math.tan(cam.fov * Math.PI / 360), d = Math.max(vh / 2 / f, vw / 2 / (f * cam.aspect)) * 1.02;
    cam.position.set(target.x - Math.sin(az) * Math.cos(el) * d, target.y + Math.sin(el) * d, target.z + Math.cos(az) * Math.cos(el) * d);
    cam.lookAt(target); cam.updateProjectionMatrix();
    // gambe
    const L2 = (q, z) => V(q[0], q[1], z);
    const pel = (a, b, z) => V(rig.hip0.x + rig.u2[0] * a + rig.bk[0] * b, rig.hip0.y + rig.u2[1] * a + rig.bk[1] * b, z);
    rig.legs.forEach((lg, j) => {
      const P = R.P[j === 0 ? i : (i + N / 2) % N], s = lg.s;
      const hip = L2(P.hip, s * rig.hipZ), knee = L2(P.knee, s * rig.kneeZ), ank = L2(P.ank, s * rig.ankZ), ped = L2(P.ped, s * rig.pedZ);
      orient(lg.thigh, hip, knee); orient(lg.shortsL, hip, knee); lg.kneeCap.position.copy(knee);
      orient(lg.shank, knee, ank);
      lg.foot.position.copy(ank); lg.foot.rotation.set(0, 0, P.sole);
      lg.crank.rotation.z = Math.atan2(P.ped[1], P.ped[0]) - Math.PI / 2;
      const b = rig.bones[j]; orient(b.fem, hip, knee); orient(b.tib, knee, ank); orient(b.ft, ank, ped);
      // muscoli: stessi punti d'inserzione del disegno 2D, attivazione dal modello
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
    rig.wheels.forEach(g => { g.rotation.z = -st.DIST * 0.35 / 0.335; });
    // forza sul pedale destro
    const P = R.P[i], fv = R.leg[i].f, fm = Math.hypot(fv[0], fv[1]), fmax = Math.max(...R.leg.map(l => Math.hypot(...l.f)), 1);
    rig.arrow.visible = fm > 20; if (fm > 20) { rig.arrow.position.set(P.ped[0], P.ped[1], rig.pedZ + 0.06); rig.arrow.setDirection(V(fv[0] / fm, fv[1] / fm, 0)); rig.arrow.setLength(0.06 + 0.2 * fm / fmax, 0.05, 0.035); }
    // gamba di A
    rig.ghost.visible = !!st.RA;
    if (st.RA) { const Q = st.RA.P[i], a = rig.ghostG.attributes.position, z = rig.hipZ + 0.06;
      [[Q.hip, z], [Q.knee, z], [Q.ank, z], [Q.ped, z]].forEach(([q, zz], n) => a.setXYZ(n, q[0], q[1], zz)); a.needsUpdate = true; rig.ghost.computeLineDistances(); }
    renderer.render(scene, cam);
    // posizione della strada sullo schermo, per lo sfondo dipinto dietro
    const g0 = V(0.1, GROUND_Y, 0).project(cam), g1 = V(1.1, GROUND_Y, 0).project(cam);
    groundPx = {gy: (1 - g0.y) / 2 * H, s: Math.abs(g1.x - g0.x) / 2 * W};
  }

  window.BIO3D = {ok: true, render, ground: () => groundPx};
}
