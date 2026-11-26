/**
 * 버스가 달리는 공간(2차): 4차로 도로, 인도, 가로등, 가로수, 건물, 먼 도시 윤곽, 다른 버스, 운행 연결망.
 * 버스는 +x 로 달린다(z = 0, 안쪽 차로). 도로 중심선은 z = -1.75, 문 쪽(+z)에 바깥 차로와 인도가 있다.
 *
 * 세계는 처음부터 다 만들어져 있다. 보이는 정도만 '버스에서 가까운 곳부터' 열린다(uBus.y = 열린 반경).
 * 구조(도로·건물)는 움직이지 않고, 그 위의 신호만 움직인다. 색은 화면에 보이는 값 그대로 적는다.
 */
import { bodyGeometry } from './bus.js';

const rand = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function buildEnvironment(THREE, renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(60, 30, 60), new THREE.MeshBasicMaterial({ color: 0x010206, side: THREE.BackSide })));
  const panel = (w, h, color, pos, look) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(...look); s.add(m); };
  panel(30, 4, 0xd6e8ff, [0, 13, 3], [0, 0, 0]);
  panel(26, 1.0, 0x8fd8ff, [2, 4.5, 17], [0, 1.6, 0]);
  panel(26, 0.5, 0x3aa0ff, [2, 1.6, 17], [0, 1.2, 0]);
  panel(24, 0.8, 0x2f6dff, [-6, 6, -18], [0, 1.5, 0]);
  panel(5, 8, 0xa9ccff, [24, 5, 7], [0, 1.5, 0]);
  panel(4, 6, 0x4b7dff, [-24, 5, -5], [0, 1.5, 0]);
  const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(s, 0.03).texture; pm.dispose();
  return tex;
}

const radial = (THREE, stops, size = 256) => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, size, size); return new THREE.CanvasTexture(c); };

const VERT = `varying vec3 vWp; varying vec3 vC;
  void main() { vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vC = instanceColor;
  #else
    vC = vec3(1.0);
  #endif
    vec4 w = modelMatrix * p; vWp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const COMMON = `varying vec3 vWp; varying vec3 vC; uniform vec4 uBus; uniform float uFog; uniform float uT; uniform vec2 uPulse;
  float pulseK() { return exp(-pow((vWp.x - uPulse.x) / 7.0, 2.0)) * uPulse.y * step(abs(vWp.z + 1.75), 7.2) * step(vWp.y, 0.1); }
  float revK() { float d = length(vec2((vWp.x - uBus.x - uBus.z) * 0.6, vWp.z)); return (1.0 - smoothstep(uBus.y * 0.55, uBus.y, d)) * (1.0 - uBus.w * smoothstep(2.6, 5.0, vWp.y)); }
  float fogK() { float d = distance(vWp, cameraPosition) * uFog; return exp(-d * d); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`;

export function buildWorld(THREE, scene, { mobile }) {
  const R = rand(11);
  const U = { uBus: { value: new THREE.Vector4(0, 0, 0, 0) }, uFog: { value: 0.0012 }, uT: { value: 0 }, uFar: { value: 0 }, uNet: { value: 0 }, uPx: { value: 1 }, uPulse: { value: new THREE.Vector2(0, 0) } };
  const mat = (frag, extra = {}, opts = {}) => new THREE.ShaderMaterial({ uniforms: { ...U, ...extra }, vertexShader: VERT, fragmentShader: COMMON + frag, extensions: { derivatives: true }, ...opts });
  const solid = (r, g, b, shade = 0.45) => mat(`uniform vec3 uCol; uniform float uSh;
    void main() { vec3 n = normalize(cross(dFdx(vWp), dFdy(vWp))); float sh = 1.0 - uSh + uSh * clamp(dot(n, normalize(vec3(0.35, 0.8, 0.5))), 0.0, 1.0);
      gl_FragColor = vec4(uCol * vC * sh * max(revK(), pulseK()) * fogK(), 1.0); }`, { uCol: { value: new THREE.Vector3(r, g, b) }, uSh: { value: shade } });
  const glow = (r, g, b) => mat(`uniform vec3 uCol; void main() { gl_FragColor = vec4(uCol * vC * revK() * fogK(), 1.0); }`, { uCol: { value: new THREE.Vector3(r, g, b) } });
  const world = { U };

  /* 버스의 조명(버스를 따라다닌다) */
  scene.add(new THREE.HemisphereLight(0x86aef5, 0x04060b, 0.2));
  const key = new THREE.DirectionalLight(0xdcebff, 1.2); scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x35b8ff, 1.5); scene.add(rim, rim.target);
  const glowL = new THREE.PointLight(0xbfd8ff, 0.7, 26, 1.6); scene.add(glowL);
  world.lights = { key, rim, glow: glowL };

  /* 평평한 사각형들을 한 덩어리로 */
  const quads = (list, y, material) => { const pos = [], idx = []; list.forEach(([x0, z0, x1, z1], i) => { pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1); idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2); }); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); const m = new THREE.Mesh(g, material); m.frustumCulled = false; scene.add(m); return m; };

  const X0 = -90, X1 = 640, CROSS = [70, 150, 230, 310, 390, 470, 550], AVE = [-96, 104];
  const RZ0 = -8.75, RZ1 = 5.25;                         // 큰길의 폭
  quads([[-900, -900, 1500, 900]], -0.02, solid(0.012, 0.016, 0.026, 0));
  const roads = [[X0, RZ0, X1, RZ1]];
  for (const x of CROSS) roads.push([x - 5.5, -230, x + 5.5, 230]);
  for (const z of AVE) roads.push([10, z - 5.5, 610, z + 5.5]);
  quads(roads, 0, solid(0.036, 0.043, 0.06, 0));
  /* 인도(교차로에서 끊긴다) */
  const walks = [], xs = [X0, ...CROSS.flatMap((x) => [x - 9, x + 9]), X1];
  for (let i = 0; i < xs.length; i += 2) walks.push([xs[i], RZ1, xs[i + 1], RZ1 + 3.2], [xs[i], RZ0 - 3.2, xs[i + 1], RZ0]);
  quads(walks, 0.12, solid(0.06, 0.068, 0.088, 0));
  /* 노면 표시: 중앙선, 차선, 가장자리, 정지선, 횡단보도 */
  const marks = [];
  for (const dz of [-0.13, 0.13]) marks.push([X0, -1.75 + dz - 0.05, X1, -1.75 + dz + 0.05]);
  for (const z of [RZ0 + 0.25, RZ1 - 0.25]) marks.push([X0, z - 0.06, X1, z + 0.06]);
  for (let x = X0; x < X1; x += 9) for (const z of [1.75, -5.25]) marks.push([x, z - 0.06, x + 3.4, z + 0.06]);
  for (const x of CROSS) {
    for (const sx of [-1, 1]) { const cx = x + sx * 8.6; for (let z = RZ0 + 0.6; z < RZ1 - 0.4; z += 1.1) marks.push([cx - 1.4, z, cx + 1.4, z + 0.55]); marks.push([x + sx * 11, sx === -1 ? -1.6 : RZ0, x + sx * 11 + 0.35, sx === -1 ? RZ1 : -1.9]); }
    for (let z = -220; z < 220; z += 9) if (z < RZ0 - 6 || z > RZ1 + 6) marks.push([x - 0.06, z, x + 0.06, z + 3.4]);
  }
  for (const z of AVE) for (let x = 14; x < 606; x += 9) marks.push([x, z - 0.06, x + 3.4, z + 0.06]);
  quads(marks, 0.014, solid(0.46, 0.5, 0.58, 0));

  /* 인스턴스 묶음 */
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc3 = new THREE.Vector3(), col = new THREE.Color();
  const instanced = (geo, material, items) => { const im = new THREE.InstancedMesh(geo, material, items.length); items.forEach((it, i) => { m4.compose(v3.set(it[0], it[1], it[2]), q.identity(), sc3.set(it[3], it[4], it[5])); im.setMatrixAt(i, m4); if (it[6]) im.setColorAt(i, col.setRGB(it[6][0], it[6][1], it[6][2])); }); im.frustumCulled = false; scene.add(im); return im; };
  const box = new THREE.BoxGeometry(1, 1, 1);

  /* 가로등: 기둥, 팔, 등, 노면에 떨어진 빛 */
  const poles = [], heads = [], pools = [];
  for (let x = X0 + 10; x < X1; x += 32) for (const s of [1, -1]) {
    const px = x + (s === 1 ? 0 : 16), pz = s === 1 ? RZ1 + 0.7 : RZ0 - 0.7;
    if (CROSS.some((c) => Math.abs(c - px) < 10) || (s === 1 && Math.abs(px - 501) < 15)) continue;   // 정류장 자리는 비워 둔다
    poles.push([px, 3.6, pz, 0.13, 7.2, 0.13], [px, 7.15, pz - s * 1.1, 0.09, 0.09, 2.2]);
    heads.push([px, 7.08, pz - s * 2.1, 0.5, 0.07, 0.24]);
    pools.push([px - 7, pz - s * 2.1 - 7, px + 7, pz - s * 2.1 + 7]);
  }
  instanced(box, solid(0.07, 0.08, 0.1, 0.5), poles);
  instanced(box, glow(0.78, 0.88, 1.0), heads);
  const poolTex = radial(THREE, [[0, 'rgba(120,160,220,0.5)'], [0.5, 'rgba(60,90,150,0.16)'], [1, 'rgba(0,0,0,0)']]);
  const poolMesh = (() => { const pos = [], uv = [], idx = []; pools.forEach(([x0, z0, x1, z1], i) => { pos.push(x0, 0.02, z0, x1, 0.02, z0, x1, 0.02, z1, x0, 0.02, z1); uv.push(0, 0, 1, 0, 1, 1, 0, 1); idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2); }); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { ...U, uMap: { value: poolTex } }, vertexShader: `varying vec3 vWp; varying vec3 vC; varying vec2 vUv; void main() { vUv = uv; vC = vec3(1.0); vec4 w = modelMatrix * vec4(position, 1.0); vWp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`, fragmentShader: COMMON + `uniform sampler2D uMap; varying vec2 vUv; void main() { vec4 t = texture2D(uMap, vUv); gl_FragColor = vec4(t.rgb * t.a * 0.55 * revK() * fogK(), 1.0); }`, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.frustumCulled = false; scene.add(m); return m; })();

  /* 문 쪽 인도의 낮은 기둥(가까이 스쳐 지나가는 것), 건너편의 가로수(중간 거리) */
  const bollards = [], trunks = [], crowns = [];
  for (let x = X0 + 4; x < X1; x += 4) if (!CROSS.some((c) => Math.abs(c - x) < 10) && Math.abs(x - 512) > 16) bollards.push([x, 0.24, RZ1 + 0.3, 0.1, 0.26, 0.1]);   // 인도 턱의 낮은 표지(버스를 가리지 않는 높이)
  for (let x = X0 + 6; x < X1; x += 11) { if (CROSS.some((c) => Math.abs(c - x) < 11)) continue; const h = 3.2 + R() * 1.6, r = 1.5 + R() * 0.8; trunks.push([x, h / 2, RZ0 - 2.2, 0.16, h, 0.16]); crowns.push([x, h + r * 0.55, RZ0 - 2.2, r, r * (0.85 + R() * 0.3), r, [0.8 + R() * 0.3, 0.9 + R() * 0.2, 1]]); }
  for (const z of AVE) for (let x = 20; x < 600; x += 14) { if (CROSS.some((c) => Math.abs(c - x) < 10)) continue; const h = 3 + R() * 1.5, r = 1.6 + R() * 0.7; trunks.push([x, h / 2, z + 7.5, 0.16, h, 0.16]); crowns.push([x, h + r * 0.55, z + 7.5, r, r, r, [0.9, 1, 1]]); }
  instanced(box, solid(0.1, 0.11, 0.14, 0.4), bollards);
  instanced(box, solid(0.045, 0.042, 0.045, 0.3), trunks);
  instanced(new THREE.IcosahedronGeometry(1, 1), solid(0.032, 0.062, 0.066, 0.7), crowns);

  /* 건물: 블록마다 필지를 나누고, 일부는 단을 올리고 옥상 설비를 얹는다. 창은 일부만 켠다 */
  const builds = [], roofs = [];
  const bands = [[-86, -15, 1], [-200, -106, 1.5], [30, 94, 1], [114, 200, 1.5]];       // 큰길에서 가까운 줄, 먼 줄
  const xb = [X0 + 30, ...CROSS, X1 - 20];
  for (let i = 0; i < xb.length - 1; i++) for (const [za, zb, tall] of bands) {
    const x0 = xb[i] + 9, x1 = xb[i + 1] - 9, nx = 2 + Math.floor(R() * 2), nz = zb - za > 80 ? 2 : 1 + Math.floor(R() * 2);
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      if (R() < 0.1) continue;
      const cw = (x1 - x0) / nx, cd = (zb - za) / nz, w = cw * (0.66 + R() * 0.24), d = cd * (0.62 + R() * 0.26);
      const cx = x0 + (a + 0.5) * cw, cz = za + (b + 0.5) * cd, near = Math.abs(cz) < 60;
      const h = (near ? 7 + R() * R() * 22 : 10 + R() * R() * 58) * (R() < 0.12 ? 1.6 : 1) * (tall > 1 && R() < 0.3 ? 1.5 : 1);
      const seed = [R(), 0.5 + R() * 0.5, near ? 1 : 0.6];
      builds.push([cx, h / 2, cz, w, h, d, seed]);
      if (h > 24 && R() < 0.6) { const th = h * (0.25 + R() * 0.3); builds.push([cx + (R() - 0.5) * w * 0.2, h + th / 2, cz + (R() - 0.5) * d * 0.2, w * 0.6, th, d * 0.6, [R(), seed[1], seed[2]]]); roofs.push([cx, h + th + 1, cz, w * 0.25, 2, d * 0.25]); }
      else { roofs.push([cx - w * 0.2, h + 0.9, cz + d * 0.15, w * 0.28, 1.8, d * 0.24]); if (R() < 0.5) roofs.push([cx + w * 0.25, h + 0.6, cz - d * 0.2, w * 0.16, 1.2, d * 0.3]); }
      roofs.push([cx, h + 0.25, cz, w * 1.0, 0.5, d * 1.0]);                              // 옥상 난간 턱
    }
  }
  const buildingMat = mat(`uniform float uFar; uniform float uNet; uniform float uMode;
    void main() { vec3 n = normalize(cross(dFdx(vWp), dFdy(vWp))); vec3 c;
      if (abs(n.y) > 0.5) c = vec3(0.05, 0.061, 0.088);
      else { bool xf = abs(n.x) > 0.5; vec2 uv = (xf ? vWp.zy : vWp.xy) / vec2(3.1, 3.4); vec2 cell = floor(uv), f = fract(uv);
        float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.3, f.y) * step(f.y, 0.78) * step(1.0, cell.y);
        float seed = floor(vC.r * 200.0 + 0.5); float h = hash(cell + seed * 1.37 + (xf ? 13.0 : 0.0)), lit = step(1.0 - 0.1 * vC.g, h);
        vec3 wall = vec3(0.05, 0.062, 0.094) * (xf ? 0.7 : 1.0) * (0.75 + 0.25 * smoothstep(0.0, 30.0, vWp.y));
        vec3 glass = vec3(0.016, 0.022, 0.04) + lit * mix(vec3(0.24, 0.3, 0.42), vec3(0.36, 0.33, 0.26), step(0.6, hash(cell.yx + seed))) * (0.45 + 0.55 * hash(cell + 3.0)) * vC.b;
        c = mix(wall, glass, win); }
      float k = mix(revK(), uFar, uMode);
      gl_FragColor = vec4(c * k * fogK() * (1.0 - 0.3 * uNet), 1.0); }`, { uMode: { value: 0 } });
  instanced(box, buildingMat, builds);
  instanced(box, solid(0.05, 0.058, 0.08, 0.45), roofs);
  /* 먼 도시 윤곽: 단순한 큰 덩어리. 가까이 가지 않으므로 창도 드물게 */
  const far = [];
  for (let i = 0; i < (mobile ? 40 : 70); i++) { const side = R() < 0.5 ? -1 : 1, z = side * (250 + R() * 260), x = -260 + R() * 1150, h = 30 + R() * R() * 120; far.push([x, h / 2, z, 22 + R() * 40, h, 22 + R() * 40, [R(), 0.35, 0.45]]); }
  const farMat = buildingMat.clone(); farMat.uniforms = { ...U, uMode: { value: 1 } };
  instanced(box, farMat, far);
  /* 지평선 쪽의 옅은 하늘빛: 먼 윤곽이 검은 배경과 구분되게 한다 */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(880, 32, 16), new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, depthWrite: false, vertexShader: `varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `varying vec3 vP; uniform float uFar; void main() { float e = normalize(vP).y; float g = exp(-pow(max(e, 0.0) / 0.09, 1.4)) * step(-0.02, e); gl_FragColor = vec4(vec3(0.016, 0.034, 0.075) * g * uFar, 1.0); }` }));
  sky.renderOrder = -1; scene.add(sky); world.sky = sky;

  /* 다른 버스: 큰길의 옆 차로와 반대 차로, 교차로를 건너는 길, 뒤쪽 길. 서로와 주인공을 피하도록 출발 위치를 고른다 */
  const lanes = [
    { a: [X0, 3.5], b: [X1, 3.5], speed: 1.0, fixed: (160 - X0) / (X1 - X0) },                       // 같은 방향 바깥 차로: 멀리 앞서 달린다(측면 구간에서 주인공을 가리지 않는다)
    { a: [X1, -3.5], b: [X0, -3.5], speed: 0.8 }, { a: [X1, -7], b: [X0, -7], speed: 1.15 }, { a: [X1, -3.5], b: [X0, -3.5], speed: 0.8 }, { a: [X1, -7], b: [X0, -7], speed: 1.0 },
    { a: [152.6, -230], b: [152.6, 230], speed: 0.9 }, { a: [307.4, 230], b: [307.4, -230], speed: 1.0 }, { a: [392.6, -230], b: [392.6, 230], speed: 0.75 }, { a: [227.4, 230], b: [227.4, -230], speed: 0.85 },
    { a: [10, -93.5], b: [610, -93.5], speed: 0.95 }, { a: [610, -98.5], b: [10, -98.5], speed: 0.7 }, { a: [10, 106.5], b: [610, 106.5], speed: 0.9 },
    { a: [467.4, 230], b: [467.4, -230], speed: 1.1 }, { a: [312.6, -230], b: [312.6, 230], speed: 0.8 }, { a: [610, 101.5], b: [10, 101.5], speed: 1.05 }, { a: [10, -93.5], b: [610, -93.5], speed: 0.95 },
  ].slice(0, mobile ? 9 : 16).map((l) => ({ ...l, len: Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]), off: 0, alongX: Math.abs(l.b[0] - l.a[0]) > 1, coord: Math.abs(l.b[0] - l.a[0]) > 1 ? l.a[1] : l.a[0] }));
  /* 나란한 다른 차로끼리는 스쳐 지나가도 되므로 거리 계산에서 뺀다. 같은 차로와 교차하는 길만 본다 */
  const apart = (alongX1, coord1, x1, z1, l2, x2, z2) => (alongX1 === l2.alongX && Math.abs(coord1 - l2.coord) > 3 ? 1e9 : Math.hypot(x1 - x2, z1 - z2));
  const at = (l, dist, out) => { const k = (((l.off + (dist * l.speed) / l.len) % 1) + 1) % 1; out[0] = l.a[0] + (l.b[0] - l.a[0]) * k; out[1] = l.a[1] + (l.b[1] - l.a[1]) * k; return out; };
  const pa = [0, 0], pb = [0, 0];
  lanes.forEach((l, i) => {
    if (l.fixed != null) { l.off = l.fixed; return; }
    let best = 0, bestGap = -1;
    for (let t = 0; t < 36; t++) {
      l.off = (t / 36 + i * 0.071) % 1;
      let gap = 1e9;
      for (let d = 0; d <= 600; d += 2) {
        at(l, d, pa);
        gap = Math.min(gap, d < 8 ? Math.hypot(pa[0] - d, pa[1]) - 70 : apart(true, 0, d, 0, l, pa[0], pa[1]));   // 첫 화면에서는 주인공 가까이에 다른 차가 없게 한다
        for (let j = 0; j < i; j++) { at(lanes[j], d, pb); gap = Math.min(gap, apart(l.alongX, l.coord, pa[0], pa[1], lanes[j], pb[0], pb[1])); }
      }
      if (gap > bestGap) { bestGap = gap; best = l.off; }
    }
    l.off = best; l.gap = bestGap;
  });
  world.minGap = Math.min(...lanes.filter((l) => l.gap != null).map((l) => l.gap));   // 확인용: 같은 차로·교차하는 길에서 차량 중심 사이의 가장 가까운 거리(m)
  const obGeo = bodyGeometry(THREE, 20, 6);
  const oBody = new THREE.InstancedMesh(obGeo, solid(0.1, 0.12, 0.165, 0.75), lanes.length); oBody.frustumCulled = false; scene.add(oBody);
  const oGlass = new THREE.InstancedMesh(box, solid(0.012, 0.016, 0.028, 0.2), lanes.length); oGlass.frustumCulled = false; scene.add(oGlass);
  const nL = lanes.length, lightPos = new Float32Array(nL * 4 * 3), lightCol = new Float32Array(nL * 4 * 3), sigPos = new Float32Array(nL * 3), sigAct = new Float32Array(nL);
  for (let i = 0; i < nL; i++) for (let k = 0; k < 4; k++) lightCol.set(k < 2 ? [0.8, 0.9, 1.0] : [0.7, 0.08, 0.1], (i * 4 + k) * 3);
  const lGeo = new THREE.BufferGeometry(); lGeo.setAttribute('position', new THREE.BufferAttribute(lightPos, 3)); lGeo.setAttribute('aC', new THREE.BufferAttribute(lightCol, 3));
  const pointMat = (frag, extra = {}) => new THREE.ShaderMaterial({ uniforms: { ...U, ...extra }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aC; attribute float aS; varying vec3 vWp; varying vec3 vC; varying float vS; uniform float uPx; uniform float uSize;
      void main() { vC = aC; vS = aS; vWp = position; vec4 mv = viewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * uSize * clamp(70.0 / -mv.z, 0.5, 3.0); }`,
    fragmentShader: COMMON + 'varying float vS;' + frag });
  const oLights = new THREE.Points(lGeo, pointMat(`void main() { vec2 p = gl_PointCoord * 2.0 - 1.0; float a = smoothstep(1.0, 0.1, dot(p, p)); gl_FragColor = vec4(vC * a * revK() * fogK(), 1.0); }`, { uSize: { value: 6.5 } })); oLights.frustumCulled = false; scene.add(oLights);
  /* 위치 신호: 버스마다 차례로 켜지는 고리 */
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sigPos, 3)); sGeo.setAttribute('aS', new THREE.BufferAttribute(sigAct, 1)); sGeo.setAttribute('aC', new THREE.BufferAttribute(new Float32Array(nL * 3).fill(1), 3));
  const oSig = new THREE.Points(sGeo, pointMat(`void main() { vec2 p = gl_PointCoord * 2.0 - 1.0; float r = length(p); float k = fract(uT * 0.5 + vWp.x * 0.013);
      float ring = smoothstep(0.06, 0.0, abs(r - 0.34)) + smoothstep(0.05, 0.0, abs(r - (0.4 + 0.55 * k))) * (1.0 - k) * 0.8 + smoothstep(0.16, 0.0, r);
      gl_FragColor = vec4(vec3(0.36, 0.66, 1.0) * ring * vS * fogK() * 1.2, 1.0); }`, { uSize: { value: 30 } })); oSig.frustumCulled = false; scene.add(oSig);
  const order = lanes.map((_, i) => i);      // 켜지는 순서: 주인공에게서 가까운 차로부터

  /* 운행 연결망: 큰길에서 시작해 바깥으로 그려지는 선(구조는 고정) + 그 위를 흐르는 빛 */
  const segs = [], netPos = [], netD = [], netC = [];
  const addSeg = (ax, az, bx, bz, d0, d1, hero) => { segs.push([ax, az, bx, bz, d0, d1]); netPos.push(ax, 0.3, az, bx, 0.3, bz); netD.push(d0, d1); const c = hero ? [0.24, 0.8, 1.0] : [0.08, 0.24, 0.7]; netC.push(...c, ...c); };
  for (let x = X0 + 30; x < X1 - 30; x += 20) addSeg(x, 0, x + 20, 0, 0, 0, true);
  for (const x of CROSS) for (const s of [-1, 1]) for (let z = 0; z < 200; z += 20) addSeg(x, s * z, x, s * (z + 20), z, z + 20, false);
  for (const z of AVE) for (let x = 20; x < 600; x += 20) addSeg(x, z, x + 20, z, Math.abs(z) + 10, Math.abs(z) + 10, false);
  const nGeo = new THREE.BufferGeometry(); nGeo.setAttribute('position', new THREE.Float32BufferAttribute(netPos, 3)); nGeo.setAttribute('aD', new THREE.Float32BufferAttribute(netD, 1)); nGeo.setAttribute('aC', new THREE.Float32BufferAttribute(netC, 3));
  const net = new THREE.LineSegments(nGeo, new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aD; attribute vec3 aC; varying float vD; varying vec3 vC2; varying vec3 vWp; void main() { vD = aD; vC2 = aC; vWp = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying float vD; varying vec3 vC2; varying vec3 vWp; uniform float uNet; uniform float uFog; void main() { float edge = uNet * 230.0; float on = 1.0 - smoothstep(edge - 4.0, edge, vD); float lead = exp(-pow((vD - edge + 6.0) / 9.0, 2.0)) * step(0.01, uNet) * (1.0 - step(0.999, uNet));
      float d = distance(vWp, cameraPosition) * uFog; gl_FragColor = vec4(vC2 * (0.85 * on + 1.3 * lead) * exp(-d * d), 1.0); }` })); net.frustumCulled = false; scene.add(net);
  const nP = mobile ? 110 : 260, pFrom = new Float32Array(nP * 3), pTo = new Float32Array(nP * 3), pPh = new Float32Array(nP * 3);
  for (let i = 0; i < nP; i++) { const sgm = segs[Math.floor(R() * segs.length)], flip = R() < 0.5; pFrom.set(flip ? [sgm[2], 0.4, sgm[3]] : [sgm[0], 0.4, sgm[1]], i * 3); pTo.set(flip ? [sgm[0], 0.4, sgm[1]] : [sgm[2], 0.4, sgm[3]], i * 3); pPh.set([R(), 0.12 + R() * 0.2, (sgm[4] + sgm[5]) / 2], i * 3); }
  const fGeo = new THREE.BufferGeometry(); fGeo.setAttribute('position', new THREE.BufferAttribute(pFrom, 3)); fGeo.setAttribute('aTo', new THREE.BufferAttribute(pTo, 3)); fGeo.setAttribute('aPh', new THREE.BufferAttribute(pPh, 3));
  const flow = new THREE.Points(fGeo, new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aTo; attribute vec3 aPh; uniform float uT, uNet, uPx; varying float vI; void main() { float k = fract(aPh.x + uT * aPh.y); vec3 p = mix(position, aTo, k); vI = (1.0 - smoothstep(uNet * 230.0 - 6.0, uNet * 230.0, aPh.z)) * (0.4 + 0.6 * sin(k * 3.14159)); vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * 3.6 * clamp(95.0 / -mv.z, 0.8, 2.4); }`,
    fragmentShader: `varying float vI; void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; gl_FragColor = vec4(vec3(0.5, 0.84, 1.0) * smoothstep(1.0, 0.2, dot(q, q)) * vI, 1.0); }` })); flow.frustumCulled = false; scene.add(flow);

  /* 주인공 버스 둘레: 접지 그림자, 전조등이 비추는 노면, 도시 구도에서의 머리 위 표식(시안). 퍼지는 고리는 쓰지 않는다 */
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 5.6), new THREE.MeshBasicMaterial({ map: radial(THREE, [[0, 'rgba(0,0,0,1)'], [0.5, 'rgba(0,0,0,0.92)'], [0.78, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; shadow.renderOrder = 2; scene.add(shadow);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(44, 30), new THREE.MeshBasicMaterial({ map: radial(THREE, [[0, 'rgba(70,112,180,0.2)'], [0.4, 'rgba(34,62,112,0.09)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.022; pool.renderOrder = 1; scene.add(pool);
  const bc = document.createElement('canvas'); bc.width = 256; bc.height = 128; const bg = bc.getContext('2d');
  for (const [cy, a] of [[40, 0.9], [88, 0.9]]) { const g2 = bg.createRadialGradient(18, cy, 2, 120, cy, 130); g2.addColorStop(0, `rgba(190,220,255,${a})`); g2.addColorStop(0.35, 'rgba(90,140,220,0.3)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); bg.globalCompositeOperation = 'lighter'; bg.fillStyle = g2; bg.fillRect(0, 0, 256, 128); }
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(34, 7.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); beam.rotation.x = -Math.PI / 2; beam.position.y = 0.026; beam.renderOrder = 1; scene.add(beam);
  const beamL = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 3.5, 0, 0, 15, 0], 3)), new THREE.LineBasicMaterial({ color: 0x35c2ff, transparent: true, opacity: 0 })); scene.add(beamL);
  const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshBasicMaterial({ color: 0x18b4ff, transparent: true, opacity: 0 })); scene.add(tip);

  const yAxis = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), gs = new THREE.Vector3(9.4, 1.1, 0.02);
  /**
   * @param s { busX, dist, time, p, reveal(열린 반경 m), ahead(앞쪽으로 더 여는 거리), low(1 이면 높은 곳은 아직 열지 않는다: 첫 화면), far, net, sig, head(전조등 0~1), pulseX·pulse(오프닝에서 노면을 따라 흐르는 빛의 위치와 세기), px }
   */
  world.update = (s) => {
    U.uBus.value.set(s.busX, s.reveal, s.ahead, s.low || 0); U.uT.value = s.time; U.uFar.value = s.far; U.uNet.value = s.net; U.uPx.value = s.px; U.uPulse.value.set(s.pulseX || 0, s.pulse || 0); U.uFog.value = 0.0011 + 0.0016 * s.far;
    const bz = s.busZ || 0;
    shadow.position.set(s.busX, 0.03, bz); pool.position.set(s.busX, 0.022, bz); pool.material.opacity = 1 - 0.5 * s.net;
    beam.position.set(s.busX + 5.3 + 17, 0.026, bz); beam.material.opacity = 0.85 * s.head;
    lanes.forEach((l, i) => {
      at(l, s.dist, pa); const dx = l.b[0] - l.a[0], dz = l.b[1] - l.a[1], yaw = Math.atan2(-dz, dx);
      q.setFromAxisAngle(yAxis, yaw); m4.compose(v3.set(pa[0], 0, pa[1]), q, one); oBody.setMatrixAt(i, m4);
      m4.compose(v3.set(pa[0], 2.03, pa[1]), q, gs.set(9.3, 1.12, 2.52)); oGlass.setMatrixAt(i, m4);
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      [[5.5, 0.85, 0.85], [5.5, 0.85, -0.85], [-5.52, 1.4, 0.95], [-5.52, 1.4, -0.95]].forEach(([lx, ly, lz], k) => { lightPos.set([pa[0] + lx * cy + lz * sy, ly, pa[1] - lx * sy + lz * cy], (i * 4 + k) * 3); });
      sigPos.set([pa[0], 4.6, pa[1]], i * 3);
      sigAct[i] = smooth(order.indexOf(i) / nL, order.indexOf(i) / nL + 0.12, s.sig);
    });
    oBody.instanceMatrix.needsUpdate = oGlass.instanceMatrix.needsUpdate = true; lGeo.attributes.position.needsUpdate = sGeo.attributes.position.needsUpdate = sGeo.attributes.aS.needsUpdate = true;
    beamL.position.x = tip.position.x = s.busX; beamL.position.z = tip.position.z = bz; tip.position.y = 15.6; tip.rotation.y = s.time * 0.6;
    beamL.material.opacity = 0.7 * s.net; tip.material.opacity = s.net; tip.scale.setScalar(0.7 + 1.7 * s.net);
  };
  return world;
}
