/**
 * 주인공 버스 — 코드로 만든 모델(2차). 최종 품질은 아니며, 정교한 GLB 로 바꾸기 전까지의 대역이다.
 * 저상 시내버스 비례(길이 11m · 폭 2.5m · 높이 3.1m). 단위 1 = 1m. 앞 +x, 위 +y, 오른쪽(문 쪽) +z.
 *
 * 차체는 '둥근 모서리의 상자'를 수식으로 만든 한 장의 곡면이다(옆면이 살짝 볼록하고 지붕 쪽으로 좁아진다).
 * 유리·문·램프·패널 선은 같은 수식으로 계산해 곡면 위에 정확히 얹는다.
 * GLB 로 바꿀 때는 buildBus() 가 돌려주는 { group, wheels, lamps } 형태만 맞추면 된다.
 */
export const BUS = { length: 11, width: 2.5, wheelRadius: 0.48, axles: [2.85, -2.75] };

const N = 6, W2 = 1.25, HH = 1.4, YC = 1.7, XF0 = 4.92, AF = 0.58, MF = 3.2, XR0 = -5.12, AR = 0.38, MR = 4;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const sp = (c, e) => Math.sign(c) * Math.abs(c) ** e;
const tumble = (y) => 1 - 0.04 * smooth(1.45, 3.1, y);                        // 지붕 쪽으로 좁아지는 옆면
const rake = (x, y) => 0.22 * smooth(1.1, 3.05, y) * smooth(3.8, 4.9, x);      // 뒤로 누운 앞유리
const sideZ = (y) => W2 * tumble(y) * (1 - Math.abs((y - YC) / HH) ** N) ** (1 / N);
const roofY = (z) => YC + HH * (1 - Math.abs(z / W2) ** N) ** (1 / N);
const noseQ = (y, z) => Math.min(1, Math.abs((y - YC) / HH) ** N + Math.abs(z / (W2 * tumble(y))) ** N);
const frontX = (y, z) => { const x0 = XF0 + AF * (1 - noseQ(y, z) ** (MF / N)) ** (1 / MF); return x0 - rake(x0, y); };
const rearX = (y, z) => XR0 - AR * (1 - noseQ(y, z) ** (MR / N)) ** (1 / MR);

/** 차체 곡면(뒤 코 → 몸통 → 앞 코). quality 로 분할 수를 조절한다 */
export function bodyGeometry(THREE, seg = 88, tube = 36) {
  const rings = [];
  for (let k = 0; k <= 12; k++) { const rho = Math.sin((k / 12) * Math.PI / 2) ** 0.7; rings.push([XR0 - AR * (1 - rho ** MR) ** (1 / MR), rho]); }
  for (let k = 1; k < tube; k++) rings.push([XR0 + ((XF0 - XR0) * k) / tube, 1]);
  for (let k = 14; k >= 0; k--) { const rho = Math.sin((k / 14) * Math.PI / 2) ** 0.7; rings.push([XF0 + AF * (1 - rho ** MF) ** (1 / MF), rho]); }
  const pos = [], idx = [];
  rings.forEach(([x0, rho]) => {
    for (let j = 0; j <= seg; j++) {
      const th = (j / seg) * Math.PI * 2, y = YC + HH * rho * sp(Math.sin(th), 2 / N);
      pos.push(x0 - rake(x0, y), y, W2 * rho * sp(Math.cos(th), 2 / N) * tumble(y));
    }
  });
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + seg + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function buildBus(THREE, shared) {
  const group = new THREE.Group();
  const R = BUS.wheelRadius;

  /* 재질에 공통으로 넣는 것: 오프닝의 '빛이 지나간 곳부터 드러남', 가로등 빛, 커서 주변의 얇은 고리 */
  const inject = (mat) => {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uSweep: shared.sweep, uCur: shared.cur, uCurAmt: shared.curAmt, uLamp: shared.lamp });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;\nuniform vec4 uSweep;\nuniform vec3 uCur;\nuniform float uCurAmt;\nuniform vec3 uLamp;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float sw = exp(-pow((vWp.x - uSweep.x) / 0.16, 2.0)) * uSweep.y;
          float dc = distance(vWp, uCur);
          float ring = smoothstep(0.05, 0.0, abs(fract(dc * 2.6 - uSweep.z * 0.35) - 0.5) - 0.455);
          float loc = smoothstep(1.7, 0.0, dc) * uCurAmt;
          float lampBand = exp(-pow((vWp.x - uLamp.x) / 1.7, 2.0)) * uLamp.y * smoothstep(0.6, 2.6, vWp.y);
          totalEmissiveRadiance += vec3(0.25, 0.74, 1.0) * (sw * 1.7 + loc * (0.06 + ring * 0.55)) + vec3(0.5, 0.62, 0.85) * lampBand * 0.11;`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          gl_FragColor.rgb *= mix(1.0, 0.035 + 0.965 * smoothstep(uSweep.x - 0.4, uSweep.x + 1.4, vWp.x), uSweep.w);`);
    };
    return mat;
  };
  const M = {
    body: inject(new THREE.MeshPhysicalMaterial({ color: 0x0a1836, metalness: 0.86, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.5 })),
    trim: inject(new THREE.MeshStandardMaterial({ color: 0x04060a, metalness: 0.3, roughness: 0.66, envMapIntensity: 0.55 })),
    glass: inject(new THREE.MeshPhysicalMaterial({ color: 0x010204, metalness: 0.0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.8, reflectivity: 0.7 })),
    rubber: inject(new THREE.MeshStandardMaterial({ color: 0x050506, metalness: 0.0, roughness: 0.93, envMapIntensity: 0.2, side: THREE.DoubleSide })),
    rim: inject(new THREE.MeshStandardMaterial({ color: 0x39414f, metalness: 0.96, roughness: 0.24, envMapIntensity: 1.4, side: THREE.DoubleSide })),
    dark: inject(new THREE.MeshStandardMaterial({ color: 0x010102, metalness: 0.0, roughness: 0.95, envMapIntensity: 0.05 })),
    chrome: inject(new THREE.MeshStandardMaterial({ color: 0x8a94a6, metalness: 1, roughness: 0.16, envMapIntensity: 1.5 })),
    seam: new THREE.LineBasicMaterial({ color: 0x000103, transparent: true, opacity: 0.85 }),
    cyan: new THREE.MeshBasicMaterial({ color: 0x1f9bd8 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    drl: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    tail: new THREE.MeshBasicMaterial({ color: 0x1c0204 }),
  };
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  /* 곡면 위에 얹는 조각: fn(u, v) → [x, y, z], out 은 바깥 방향(면의 앞뒤를 맞추는 데 쓴다) */
  const patch = (fn, u0, u1, v0, v1, mat, out, nu = 18, nv = 8) => {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { pos.push(...fn(u0 + ((u1 - u0) * i) / nu, v0 + ((v1 - v0) * j) / nv)); uv.push(i / nu, j / nv); }
    const P = (k) => [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
    const a = P(0), b = P(1), c = P(nu + 1), e1 = b.map((v, k) => v - a[k]), e2 = c.map((v, k) => v - a[k]);
    const nrm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const flip = nrm[0] * out[0] + nrm[1] * out[1] + nrm[2] * out[2] < 0;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const p = j * (nu + 1) + i, q = p + nu + 1; flip ? idx.push(p, q, p + 1, p + 1, q, q + 1) : idx.push(p, p + 1, q, p + 1, q + 1, q); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return add(g, mat);
  };
  const sideP = (s, off) => (x, y) => [x, y, s * (sideZ(y) + off)];
  const frontP = (off) => (z, y) => [frontX(y, z) + off, y, z];
  const rearP = (off) => (z, y) => [rearX(y, z) - off, y, z];
  const seam = (pts) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); group.add(new THREE.Line(g, M.seam)); };
  const sideRect = (s, x0, x1, y0, y1, off = 0.004) => { const pts = []; for (let k = 0; k <= 10; k++) pts.push([x0, y0 + ((y1 - y0) * k) / 10, s * (sideZ(y0 + ((y1 - y0) * k) / 10) + off)]); pts.push([x1, y1, s * (sideZ(y1) + off)]); for (let k = 10; k >= 0; k--) pts.push([x1, y0 + ((y1 - y0) * k) / 10, s * (sideZ(y0 + ((y1 - y0) * k) / 10) + off)]); pts.push(pts[0]); seam(pts); };

  add(bodyGeometry(THREE), M.body);

  /* 유리 안쪽을 암시하는 아주 옅은 무늬(천장등 띠, 손잡이 기둥, 좌석 등받이). 실제 실내 깊이는 아니다 */
  const ic = document.createElement('canvas'); ic.width = 1024; ic.height = 128;
  const ig = ic.getContext('2d'); ig.fillStyle = '#000'; ig.fillRect(0, 0, 1024, 128);
  const lg = ig.createLinearGradient(0, 0, 0, 128); lg.addColorStop(0, 'rgba(150,190,255,0.55)'); lg.addColorStop(0.16, 'rgba(60,90,150,0.12)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
  ig.fillStyle = lg; ig.fillRect(0, 0, 1024, 128);
  ig.fillStyle = 'rgba(0,0,0,0.75)'; for (let x = 30; x < 1024; x += 58) { ig.fillRect(x, 78, 34, 50); ig.fillRect(x + 44, 0, 3, 128); }
  const interior = new THREE.CanvasTexture(ic); interior.encoding = THREE.sRGBEncoding;
  const sideGlass = M.glass.clone(); inject(sideGlass); sideGlass.emissive = new THREE.Color(0x9fc4ff); sideGlass.emissiveMap = interior; sideGlass.emissiveIntensity = 0.14;

  for (const s of [1, -1]) {
    const out = [0, 0, s];
    /* 옆 유리 띠와 고무 틀, 기둥 */
    patch(sideP(s, 0.003), -5.02, s === 1 ? 4.78 : 4.72, 1.4, 2.66, M.rubber, out, 30, 6);
    patch(sideP(s, 0.006), -4.97, s === 1 ? 3.52 : 4.67, 1.45, 2.61, sideGlass, out, 40, 6);
    for (const x of [-3.95, -2.45, -0.88, 0.68, 2.1].concat(s === 1 ? [] : [3.5])) patch(sideP(s, 0.008), x - 0.035, x + 0.035, 1.45, 2.61, M.rubber, out, 1, 6);
    /* 아랫단(어두운 무광), 허리의 가는 시안색 선, 패널 경계 */
    patch(sideP(s, 0.004), -5.0, 4.85, 0.36, 0.62, M.trim, out, 30, 4);
    patch(sideP(s, 0.006), -5.0, 4.8, 1.3, 1.312, M.cyan, out, 30, 1);
    for (const x of [-4.3, -1.75, 1.55]) seam([[x, 0.64, s * (sideZ(0.64) + 0.004)], [x, 1.29, s * (sideZ(1.29) + 0.004)]]);
    seam([[-5.0, 2.74, s * (sideZ(2.74) + 0.004)], [4.6, 2.74, s * (sideZ(2.74) + 0.004)]]);
    /* 바퀴집: 어두운 안쪽과 둘레의 턱 */
    for (const ax of BUS.axles) {
      patch((a, r) => { const x = ax + Math.cos(a) * r, y = Math.max(0.31, R + Math.sin(a) * r); return [x, y, s * (sideZ(y) + 0.005)]; }, -0.32, Math.PI + 0.32, 0, 0.66, M.dark, out, 28, 3);
      const lip = add(new THREE.TorusGeometry(0.66, 0.026, 8, 40, Math.PI + 0.5), M.body, ax, R, s * (sideZ(R + 0.3) + 0.004)); lip.rotation.z = -0.25;
    }
    if (s === 1) {
      /* 문 두 개: 유리와 틀, 가운데 이음 */
      for (const [x0, x1] of [[3.58, 4.74], [-0.78, 0.58]]) {
        patch(sideP(1, 0.007), x0, x1, 0.66, 2.61, M.rubber, out, 6, 12);
        patch(sideP(1, 0.01), x0 + 0.05, (x0 + x1) / 2 - 0.02, 0.72, 2.56, M.glass, out, 3, 12);
        patch(sideP(1, 0.01), (x0 + x1) / 2 + 0.02, x1 - 0.05, 0.72, 2.56, M.glass, out, 3, 12);
        sideRect(1, x0 - 0.02, x1 + 0.02, 0.63, 2.66, 0.006);
      }
    }
    /* 사이드미러: 지붕 앞에서 휘어 내려오는 팔과 거울 몸체 */
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(4.86, 2.86, s * 1.12), new THREE.Vector3(5.42, 2.98, s * 1.5), new THREE.Vector3(5.46, 2.52, s * 1.56));
    add(new THREE.TubeGeometry(curve, 14, 0.024, 8), M.trim);
    const housing = add(new THREE.SphereGeometry(1, 20, 14), M.trim, 5.47, 2.3, s * 1.57); housing.scale.set(0.075, 0.25, 0.13);
    const mg = add(new THREE.CircleGeometry(1, 20), M.chrome, 5.39, 2.3, s * 1.57); mg.scale.set(0.105, 0.21, 1); mg.rotation.y = -Math.PI / 2;
  }

  /* 앞면: 앞유리와 틀, 행선지 표시, 와이퍼, 전조등, 범퍼 */
  const F = [1, 0, 0];
  patch(frontP(0.004), -1.1, 1.1, 1.26, 2.99, M.rubber, F, 16, 14);
  patch(frontP(0.008), -1.05, 1.05, 1.31, 2.7, M.glass, F, 16, 12);
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 64;
  const sg = sc.getContext('2d'); sg.fillStyle = '#01030a'; sg.fillRect(0, 0, 512, 64); sg.fillStyle = '#bfeaff'; sg.font = '700 40px Arial, sans-serif'; sg.textBaseline = 'middle'; sg.fillText('01', 26, 34); sg.textAlign = 'right'; sg.fillText('LIVEBUS', 488, 34);
  const signTex = new THREE.CanvasTexture(sc); signTex.encoding = THREE.sRGBEncoding;
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, color: 0x000000 });
  patch((z, y) => frontP(0.01)(-z, y), -0.9, 0.9, 2.74, 2.95, signMat, F, 8, 2);
  for (const s of [1, -1]) seam([[frontX(1.36, s * 0.1) + 0.012, 1.36, s * 0.1], [frontX(1.6, s * 0.5) + 0.012, 1.6, s * 0.5], [frontX(1.9, s * 0.86) + 0.012, 1.9, s * 0.86]]);
  patch(frontP(0.005), -1.12, 1.12, 0.36, 0.66, M.trim, F, 16, 4);
  patch(frontP(0.008), -1.0, 1.0, 1.1, 1.112, M.cyan, F, 16, 1);
  patch(frontP(0.01), -0.26, 0.26, 0.44, 0.56, M.chrome, F, 2, 1);
  const lamps = { head: M.lamp, drl: M.drl, sign: signMat, tail: M.tail, cyan: M.cyan };
  for (const s of [1, -1]) {
    const z0 = s * 0.52, z1 = s * 1.1;
    patch(frontP(0.006), Math.min(z0, z1), Math.max(z0, z1), 0.72, 1.0, M.glass, F, 8, 4);                   // 램프 덮개
    patch(frontP(0.009), Math.min(z0, z1) + 0.04, Math.max(z0, z1) - 0.04, 0.945, 0.972, M.drl, F, 8, 1);   // 주간등 띠
    for (const zc of [0.68, 0.9]) {                                                                          // 원형 전조등: 테와 렌즈
      const x = frontX(0.83, s * zc) + 0.012;
      const lens = add(new THREE.SphereGeometry(0.058, 16, 12, 0, Math.PI), M.lamp, x - 0.02, 0.83, s * zc); lens.rotation.y = Math.PI / 2;
      const ringM = add(new THREE.TorusGeometry(0.064, 0.008, 8, 24), M.chrome, x, 0.83, s * zc); ringM.rotation.y = Math.PI / 2;
    }
  }
  /* 뒷면: 뒷유리, 후미등(덮개 안의 세로 띠), 범퍼 */
  const B = [-1, 0, 0];
  patch(rearP(0.006), -0.98, 0.98, 1.85, 2.68, M.glass, B, 12, 6);
  patch(rearP(0.005), -1.12, 1.12, 0.36, 0.66, M.trim, B, 12, 4);
  for (const s of [1, -1]) {
    const z0 = Math.min(s * 0.86, s * 1.1), z1 = Math.max(s * 0.86, s * 1.1);
    patch(rearP(0.006), z0, z1, 0.95, 1.9, M.glass, B, 3, 8);
    patch(rearP(0.009), z0 + 0.05, z1 - 0.05, 1.02, 1.83, M.tail, B, 2, 8);
  }
  /* 지붕 설비 */
  const rr = (w, h, r) => { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
  for (const [x, w, d, h, mat] of [[-1.5, 4.6, 1.7, 0.2, M.trim], [2.9, 1.5, 1.4, 0.13, M.body]]) {
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(rr(w, d, 0.25), { depth: h, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 }), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, roofY(d / 2) - 0.03, 0); group.add(m);
  }

  /* 바퀴: 차체와 따로 도는 네 개. 두꺼운 타이어, 안으로 들어간 휠, 너트와 통풍구 */
  const tirePts = [[0.29, -0.16], [0.4, -0.165], [0.455, -0.14], [0.478, -0.09], [0.48, 0], [0.478, 0.09], [0.455, 0.14], [0.4, 0.165], [0.29, 0.16]].map(([r, z]) => new THREE.Vector2(r, z));
  const tireGeo = new THREE.LatheGeometry(tirePts, 48); tireGeo.rotateX(Math.PI / 2);
  const rimPts = [[0.292, 0.15], [0.3, 0.165], [0.285, 0.17], [0.27, 0.12], [0.2, 0.07], [0.11, 0.06], [0.1, 0.1], [0, 0.1]].map(([r, z]) => new THREE.Vector2(r, z));
  const wheels = [];
  for (const ax of BUS.axles) for (const s of [1, -1]) {
    const w = new THREE.Group(); w.position.set(ax, R, s * (W2 - 0.2)); group.add(w);
    w.add(new THREE.Mesh(tireGeo, M.rubber));
    for (const zz of [-0.05, 0.05]) { const gr = add(new THREE.TorusGeometry(0.481, 0.006, 6, 48), M.dark, 0, 0, zz, w); }   // 트레드 홈
    const rimGeo = new THREE.LatheGeometry(rimPts, 40); rimGeo.rotateX(s * Math.PI / 2);
    w.add(new THREE.Mesh(rimGeo, M.rim));
    for (let k = 0; k < 10; k++) { const an = (k / 10) * Math.PI * 2; const b = add(new THREE.CylinderGeometry(0.013, 0.013, 0.03, 8), M.chrome, Math.cos(an) * 0.15, Math.sin(an) * 0.15, s * 0.075, w); b.rotation.x = Math.PI / 2; }
    for (let k = 0; k < 8; k++) { const an = (k / 8) * Math.PI * 2 + 0.2; const h = add(new THREE.CircleGeometry(0.03, 14), M.dark, Math.cos(an) * 0.225, Math.sin(an) * 0.225, s * 0.098, w); h.rotation.y = s === 1 ? 0 : Math.PI; }
    wheels.push(w);
  }
  return { group, wheels, lamps, materials: M };
}
