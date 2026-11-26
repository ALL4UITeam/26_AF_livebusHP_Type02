/**
 * 버스가 달리는 공간(3차: 도시 배경과 선·도트 개선). 4차로 도로, 연석과 인도, 가로등, 가로수, 건물, 먼 도시 윤곽, 다른 버스, 운행 연결망.
 * 버스는 +x 로 달린다(z = 0, 안쪽 차로). 도로 중심선은 z = -1.75, 문 쪽(+z)에 바깥 차로와 인도가 있다.
 *
 * - 세계는 처음부터 다 만들어져 있고, 보이는 정도만 '버스에서 가까운 곳부터' 열린다(uBus.y = 열린 반경). 구조는 움직이지 않는다.
 * - 건물: 모서리를 깎은 기둥 하나를 인스턴스로 반복하고, 정면(창틀·안쪽 깊이·층·1층 유리면·출입구·옥상 턱)은 shader 가 건물 유형과 크기에 맞춰 그린다.
 *   유형: 0 낮은 상가, 1 콘크리트 업무시설(뚫린 창), 2 금속 패널 업무시설(띠 창), 3 유리 외벽 고층, 4 먼 줄, 5 지평선의 윤곽, 8 옥상 설비.
 *   창의 불빛은 건물·층·방 단위의 고정된 무늬다(시간에 따라 바뀌지 않는다).
 * - 빛: 가로등은 도로·연석·인도·건물 아랫부분에 같은 식으로 닿는다(lampL). 색은 화면에 보이는 값 그대로 적는다.
 * - 선과 도트(lines.js): ① 도시 구조선 = 어둡고 안정적인 청색 ② 선택 노선 = 선명한 시안 ③ 이동하는 데이터 = 작은 선두 + 짧은 잔광 ④ 위치 도트 = 선명한 중심 + 절제된 주변 빛.
 */
import { fatLines, dots, RES } from './lines.js';

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
const COMMON = `varying vec3 vWp; varying vec3 vC; uniform vec4 uBus; uniform float uFog; uniform float uT; uniform vec2 uPulse; uniform float uFar; uniform float uNet;
  const vec3 HAZE = vec3(0.009, 0.016, 0.033);
  float pulseK() { return exp(-pow((vWp.x - uPulse.x) / 7.0, 2.0)) * uPulse.y * step(abs(vWp.z + 1.75), 7.2) * step(vWp.y, 0.1); }
  float revK() { float d = length(vec2((vWp.x - uBus.x - uBus.z) * 0.6, vWp.z)); return (1.0 - smoothstep(uBus.y * 0.55, uBus.y, d)) * (1.0 - uBus.w * smoothstep(2.6, 5.0, vWp.y)); }
  float fogK() { float d = distance(vWp, cameraPosition) * uFog; return exp(-d * d); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  /* 가로등: 32m 간격, 높이 7m. 교차로 둘레와 정류장 자리에는 없다(기둥을 세우지 않은 곳과 같다) */
  float lampOne(vec3 p, float x0, float zl) {
    float lx = floor((p.x - x0) / 32.0 + 0.5) * 32.0 + x0;
    float skip = 1.0 - step(10.0, abs(mod(lx - 70.0 + 40.0, 80.0) - 40.0));
    if (zl > 0.0 && abs(lx - 496.0) < 1.0) skip = 1.0;
    vec3 d = vec3(p.x - lx, p.y - 7.0, p.z - zl); float r2 = dot(d, d);
    return (1.0 - skip) * 46.0 / (r2 + 14.0) * clamp(-d.y / sqrt(r2), 0.0, 1.0) * step(-80.5, lx) * step(lx, 640.0);
  }
  float lampL(vec3 p) { return lampOne(p, -80.0, 3.85) + lampOne(p, -64.0, -7.35); }
  vec3 air(vec3 c) { float f = fogK(); return c * f + HAZE * (1.0 - f) * uFar; }`;

/* 건물 정면을 그리는 shader. 한 건물 = 모서리를 깎은 기둥 하나(크기는 인스턴스 값으로, 깎는 폭은 미터로 일정) */
const B_VERT = `attribute vec3 aPos; attribute vec3 aSize; attribute vec4 aStyle; attribute vec3 aTone; attribute vec2 aCorner; attribute vec2 aInset; attribute vec3 aN;
  varying vec3 vWp; varying vec3 vC; varying vec3 vL; varying vec3 vN; varying vec3 vSize; varying vec4 vStyle;
  void main() { float c = min(0.38, 0.2 * min(aSize.x, aSize.z));
    vec3 l = vec3(aCorner.x * (aSize.x * 0.5 - aInset.x * c), position.y * aSize.y, aCorner.y * (aSize.z * 0.5 - aInset.y * c));
    vL = l; vN = aN; vSize = aSize; vStyle = aStyle; vC = aTone; vWp = aPos + l; gl_Position = projectionMatrix * viewMatrix * vec4(vWp, 1.0); }`;
const B_FRAG = `varying vec3 vL; varying vec3 vN; varying vec3 vSize; varying vec4 vStyle; uniform float uDet;
  float rectM(vec2 q, vec2 lo, vec2 hi, vec2 w) { vec2 a = smoothstep(lo - w, lo + w, q) * (1.0 - smoothstep(hi - w, hi + w, q)); return a.x * a.y; }
  void main() {
    vec3 n = vN, tone = vC, col; float ty = floor(vStyle.y + 0.5), seed = floor(vStyle.x * 251.0 + 0.5) / 251.0;   // 인스턴스 값은 보간 오차가 없도록 다시 맞춘다(창 무늬가 흔들리지 않게)
    float sky = step(4.5, ty) * step(ty, 5.5), simple = step(3.5, ty);
    float det = (1.0 - smoothstep(100.0, 230.0, distance(vWp, cameraPosition) / uDet)) * (1.0 - simple);   // 가까울수록 세부를 그린다
    float lamb = 0.6 + 0.4 * clamp(dot(n, normalize(vec3(0.35, 0.8, 0.5))), 0.0, 1.0);
    float lamp = lampL(vWp) * (1.0 - sky);
    if (n.y > 0.5) {                                                          // 옥상: 바닥과 둘레의 턱
      float e = min(vSize.x * 0.5 - abs(vL.x), vSize.z * 0.5 - abs(vL.z));
      col = mix(vec3(0.026, 0.031, 0.044), tone * 0.95, (1.0 - smoothstep(0.38, 0.5, e)) * (1.0 - step(7.5, ty)) + step(7.5, ty) * 0.6);
    } else if (ty > 7.5) {                                                    // 옥상 설비: 가는 살
      col = tone * (0.6 + 0.3 * step(0.5, fract(vL.y * 4.0)) * det) * lamb;
    } else {
      vec2 t = vec2(-n.z, n.x); float face = step(0.9, max(abs(n.x), abs(n.z)));      // 깎인 모서리 면에는 창이 없다
      float fw = abs(t.x) * vSize.x + abs(t.y) * vSize.z, u = dot(vL.xz, t) + fw * 0.5, v = vL.y;
      vec3 V = normalize(cameraPosition - vWp); float vn0 = dot(V, n), vn = max(vn0, 0.12); vec2 par = vec2(dot(V.xz, t), V.y) / vn * det;
      float fh = floor(vStyle.z * 20.0 + 0.5) / 20.0, gf = (ty < 2.5 ? 4.6 : (ty < 3.5 ? 6.2 : 0.0)), top = vSize.y - 1.0;
      float nb = max(1.0, floor(fw / (floor(vStyle.w * 20.0 + 0.5) / 20.0) + 0.5)), bw = fw / nb, bi = floor(u / bw), fu = fract(u / bw);
      float fi = floor((v - gf) / fh), fv = fract((v - gf) / fh), nfl = floor((top - gf) / fh + 0.15);
      float upper = step(gf, v) * step(fi, nfl - 0.5) * face;
      /* 유형별 창의 자리(칸 안의 비율)와 안쪽 깊이(m) */
      vec2 lo = vec2(0.2, 0.3), hi = vec2(0.8, 0.84); float dep = 0.3;
      if (ty < 0.5) { lo = vec2(0.12, 0.26); hi = vec2(0.88, 0.86); dep = 0.22; }
      else if (ty > 1.5 && ty < 2.5) { lo = vec2(0.03, 0.34); hi = vec2(0.97, 0.82); dep = 0.16; }
      else if (ty > 2.5 && ty < 3.5) { lo = vec2(0.035, 0.03); hi = vec2(0.965, 0.97); dep = 0.07; }
      else if (ty > 3.5) { lo = vec2(0.22, 0.3); hi = vec2(0.78, 0.8); dep = 0.0; }
      vec2 q = vec2(fu, fv), cell = vec2(bw, fh), w = fwidth(q) * 0.8 + 1e-4;
      vec2 gq = q - par * dep / cell;                                         // 유리는 벽보다 안쪽에 있다: 보는 각도에 따라 창틀 안쪽 면이 드러난다
      float open = rectM(q, lo, hi, w) * upper, glass = rectM(gq, lo, hi, w) * open, reveal = open - glass;
      /* 벽: 콘크리트는 거칠고 층마다 줄눈, 금속 패널은 매끈하고 세로 이음, 유리 외벽은 층 사이가 불투명 유리 */
      vec3 wall = tone * (0.93 + 0.14 * hash(floor(vec2(u * 0.7, v * 0.5)) + seed * 91.0) * det);
      float joint = (1.0 - smoothstep(0.0, 0.035, fv)) * step(gf, v) * det;
      if (ty > 1.5 && ty < 2.5) { joint = max(joint, (1.0 - smoothstep(0.0, 0.012, abs(fu - 0.5) - 0.488)) * det); wall += tone * pow(1.0 - vn0, 3.0) * 0.5; }
      if (ty > 2.5 && ty < 3.5) wall = mix(vec3(0.02, 0.028, 0.045), tone, 0.25) + vec3(0.03, 0.05, 0.09) * pow(1.0 - vn0, 2.5);
      wall *= 1.0 - 0.3 * joint;
      wall *= mix(1.0, 0.8, step(top, v) * (1.0 - step(vSize.y - 0.18, v)));  // 옥상 턱 아래의 그늘, 맨 위의 얇은 덮개
      col = wall * lamb * (0.82 + 1.5 * lamp);
      float rs = gq.y > hi.y ? 0.42 : (gq.y < lo.y ? 1.25 : 0.72);            // 창 안쪽 면: 위는 그늘, 아래 턱은 밝게
      col = mix(col, wall * rs * (0.8 + 1.2 * lamp), clamp(reveal, 0.0, 1.0));
      /* 창의 불빛: 층 단위(늦게까지 켜진 층) × 방 단위(1~3칸). 일부는 낮은 채도의 따뜻한 색 */
      float span = 1.0 + floor(hash(vec2(seed * 13.0, fi)) * 3.0), room = floor(bi / span) + (abs(n.x) > 0.5 ? 31.0 : 0.0);
      float pf = mix(0.12, 0.62, step(0.84, hash(vec2(fi * 1.7, seed * 57.0)))) * (1.0 - 0.55 * simple);
      float lit = step(1.0 - pf, hash(vec2(room * 3.1 + fi * 17.0, seed * 31.0)));
      float warm = step(0.68, hash(vec2(room + fi * 7.0, seed * 5.0)));
      vec2 rq = q - par * 2.6 / cell;                                         // 방 안쪽: 천장 쪽이 밝다
      float blind = step(0.55, hash(vec2(bi * 3.1 + fi, seed * 17.0))) * step(hi.y - (hi.y - lo.y) * 0.45, gq.y) * det;
      float inner = (0.5 + 0.5 * smoothstep(lo.y, hi.y, rq.y)) * (0.7 + 0.3 * hash(vec2(bi, fi + seed * 9.0))) * (1.0 - 0.5 * blind);
      vec3 litC = mix(vec3(0.5, 0.64, 0.9), vec3(0.92, 0.74, 0.5), warm) * inner * mix(0.4, 0.22, simple);
      vec3 dark = vec3(0.012, 0.018, 0.034) + vec3(0.035, 0.06, 0.11) * pow(1.0 - vn0, 2.5) + vec3(0.03, 0.036, 0.05) * lamp;   // 꺼진 유리: 비스듬할수록 하늘빛이 비친다
      vec3 gcol = mix(dark, litC, lit);
      if (ty > 2.5 && ty < 3.5) gcol = mix(dark * 1.25 + tone * 0.06, gcol, step(0.24, gq.y));              // 유리 외벽의 층 사이
      vec2 fm = vec2(0.06 / bw, 0.06 / fh);
      float frame = (1.0 - rectM(gq, lo + fm, hi - fm, w)) * det;
      if (ty > 1.5 && ty < 3.5) frame = max(frame, (1.0 - smoothstep(0.0, 0.4 * fm.x, abs(gq.x - 0.5) - 0.4 * fm.x)) * det);   // 넓은 창의 가운데 살
      gcol = mix(gcol, vec3(0.018, 0.022, 0.03) * (1.0 + 2.0 * lamp), frame);
      col = mix(col, gcol, glass);
      /* 1층: 받침돌, 유리면, 출입구 한 칸, 그 위의 띠(글자 없음) */
      if (gf > 0.0 && v < gf && face > 0.5) {
        float band = step(gf - 1.0, v), under = (1.0 - smoothstep(0.0, 0.1, abs(v - (gf - 1.05)))) * det;
        vec2 sq = vec2(fu, v), slo = vec2(0.06, 0.55), shi = vec2(0.94, gf - 1.12), sw = vec2(w.x, fwidth(v) * 0.8 + 1e-4);
        vec2 sgq = sq - par * 0.32 / vec2(bw, 1.0);
        float sOpen = rectM(sq, slo, shi, sw), sGlass = rectM(sgq, slo, shi, sw) * sOpen;
        float door = step(abs(bi - floor(hash(vec2(seed * 3.7, 1.0)) * nb)), 0.5);
        float shop = step(0.42, hash(vec2(bi * 5.3, seed * 11.0))) * (1.0 - door), sWarm = step(0.5, hash(vec2(bi, seed * 23.0)));
        vec3 base = tone * mix(0.62, 1.12, band) * (1.0 - 0.45 * under) * (0.8 + 0.2 * smoothstep(0.0, 0.42, v));
        col = base * lamb * (0.82 + 1.6 * lamp);
        col = mix(col, base * (sgq.y > shi.y ? 0.4 : 0.7), clamp(sOpen - sGlass, 0.0, 1.0));
        vec2 srq = sq - par * 2.2 / vec2(bw, 1.0);
        vec3 sLit = mix(vec3(0.5, 0.62, 0.86), vec3(0.9, 0.74, 0.52), sWarm) * (0.35 + 0.65 * smoothstep(0.4, shi.y, srq.y)) * 0.3;
        vec3 sg = mix(dark * 1.3, sLit, shop) + door * vec3(0.05, 0.065, 0.09);
        float sfr = max(1.0 - rectM(sgq, slo + vec2(0.05 / bw, 0.05), shi - vec2(0.05 / bw, 0.05), sw), 1.0 - smoothstep(0.0, 0.02 / bw, abs(sgq.x - 0.5) - 0.02 / bw)) * det;
        sg = mix(sg, vec3(0.02, 0.024, 0.032) * (1.0 + 2.0 * lamp), sfr);
        col = mix(col, sg, sGlass);
      }
      col *= mix(0.55, 1.0, smoothstep(0.0, 1.6, v));                         // 땅에 닿는 자리의 그늘
    }
    float k = mix(revK(), uFar, sky);
    gl_FragColor = vec4(air(col) * k * (1.0 - 0.3 * uNet), 1.0);
  }`;

export function buildWorld(THREE, scene, { mobile, bodyGeometry, path = [] }) {
  const R = rand(11);
  RES.value = new THREE.Vector2(1280, 720);
  const U = { uBus: { value: new THREE.Vector4(0, 0, 0, 0) }, uFog: { value: 0.0012 }, uT: { value: 0 }, uFar: { value: 0 }, uNet: { value: 0 }, uPx: { value: 1 }, uPulse: { value: new THREE.Vector2(0, 0) }, uDet: { value: mobile ? 0.6 : 1 } };
  const mat = (frag, extra = {}, opts = {}) => new THREE.ShaderMaterial({ uniforms: { ...U, ...extra }, vertexShader: VERT, fragmentShader: COMMON + frag, extensions: { derivatives: true }, ...opts });
  /* 가로등 빛을 받는 면. pave: 0 없음, 1 아스팔트(옅은 얼룩), 2 인도(0.6m 포장 줄눈) */
  const surf = (r, g, b, shade = 0.45, pave = 0) => mat(`uniform vec3 uCol; uniform float uSh; uniform float uPave;
    void main() { vec3 n = normalize(cross(dFdx(vWp), dFdy(vWp))); float sh = 1.0 - uSh + uSh * clamp(dot(n, normalize(vec3(0.35, 0.8, 0.5))), 0.0, 1.0);
      vec3 c = uCol * vC;
      if (uPave > 1.5) { vec2 q = vWp.xz / 0.6, fq = fwidth(q); float j = max(smoothstep(0.44, 0.5, abs(fract(q.x) - 0.5)), smoothstep(0.44, 0.5, abs(fract(q.y) - 0.5))); c *= 1.0 - 0.28 * j * (1.0 - smoothstep(0.12, 0.4, fq.x + fq.y)); }
      else if (uPave > 0.5) c *= 0.94 + 0.08 * sin(vWp.x * 0.83) * sin(vWp.z * 1.37) + 0.04 * hash(floor(vWp.xz * 3.0));
      float lamp = lampL(vWp) * (0.3 + 0.7 * max(n.y, 0.0));
      gl_FragColor = vec4(air(c * sh * (0.74 + 2.1 * lamp)) * max(revK(), pulseK()), 1.0); }`, { uCol: { value: new THREE.Vector3(r, g, b) }, uSh: { value: shade }, uPave: { value: pave } });
  const glow = (r, g, b) => mat(`uniform vec3 uCol; void main() { gl_FragColor = vec4(uCol * vC * revK() * fogK(), 1.0); }`, { uCol: { value: new THREE.Vector3(r, g, b) } });
  const world = { U };

  /* 버스의 조명(버스를 따라다닌다) */
  scene.add(new THREE.HemisphereLight(0x86aef5, 0x04060b, 0.2));
  const key = new THREE.DirectionalLight(0xdcebff, 1.2); scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x35b8ff, 1.5); scene.add(rim, rim.target);
  const glowL = new THREE.PointLight(0xbfd8ff, 0.7, 26, 1.6); scene.add(glowL);
  world.lights = { key, rim, glow: glowL };

  const quads = (list, y, material) => { const pos = [], idx = []; list.forEach(([x0, z0, x1, z1], i) => { pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1); idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2); }); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); const m = new THREE.Mesh(g, material); m.frustumCulled = false; scene.add(m); return m; };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc3 = new THREE.Vector3(), col = new THREE.Color();
  const instanced = (geo, material, items) => { const im = new THREE.InstancedMesh(geo, material, items.length); items.forEach((it, i) => { m4.compose(v3.set(it[0], it[1], it[2]), q.identity(), sc3.set(it[3], it[4], it[5])); im.setMatrixAt(i, m4); if (it[6]) im.setColorAt(i, col.setRGB(it[6][0], it[6][1], it[6][2])); }); im.frustumCulled = false; scene.add(im); return im; };
  const box = new THREE.BoxGeometry(1, 1, 1);

  /* ── 땅: 도로, 연석, 인도, 노면 표시 ── */
  const X0 = -90, X1 = 640, CROSS = [70, 150, 230, 310, 390, 470, 550], AVE = [-96, 104], RZ0 = -8.75, RZ1 = 5.25, CURB = 0.2, WALK = 3.2;
  quads([[-900, -900, 1500, 900]], -0.02, surf(0.012, 0.016, 0.026, 0));
  const roads = [[X0, RZ0, X1, RZ1]];
  for (const x of CROSS) roads.push([x - 5.5, -230, x + 5.5, 230]);
  for (const z of AVE) roads.push([10, z - 5.5, 610, z + 5.5]);
  quads(roads, 0, surf(0.036, 0.043, 0.06, 0, 1));
  const walks = [], curbs = [], plaza = [], xs = [X0, ...CROSS.flatMap((x) => [x - 9, x + 9]), X1];
  for (let i = 0; i < xs.length; i += 2) {
    walks.push([xs[i], RZ1 + CURB, xs[i + 1], RZ1 + WALK], [xs[i], RZ0 - WALK, xs[i + 1], RZ0 - CURB]); plaza.push([xs[i], RZ1 + WALK, xs[i + 1], 63]);
    const len = xs[i + 1] - xs[i], cx = (xs[i] + xs[i + 1]) / 2;
    curbs.push([cx, 0.065, RZ1 + CURB / 2, len, 0.13, CURB], [cx, 0.065, RZ0 - CURB / 2, len, 0.13, CURB]);
  }
  quads(walks, 0.12, surf(0.058, 0.066, 0.086, 0, 2));
  quads(plaza, 0.1, surf(0.03, 0.035, 0.047, 0, 2));                                     // 문 쪽의 넓은 포장 광장(건물은 그 뒤에 선다)
  instanced(box, surf(0.1, 0.108, 0.128, 0.3), curbs);                                   // 연석: 인도보다 밝은 돌
  const marks = [];
  for (const dz of [-0.13, 0.13]) marks.push([X0, -1.75 + dz - 0.05, X1, -1.75 + dz + 0.05]);
  for (const z of [RZ0 + 0.25, RZ1 - 0.25]) marks.push([X0, z - 0.06, X1, z + 0.06]);
  for (let x = X0; x < X1; x += 9) for (const z of [1.75, -5.25]) marks.push([x, z - 0.06, x + 3.4, z + 0.06]);
  for (const x of CROSS) {
    for (const sx of [-1, 1]) { const cx = x + sx * 8.6; for (let z = RZ0 + 0.6; z < RZ1 - 0.4; z += 1.1) marks.push([cx - 1.4, z, cx + 1.4, z + 0.55]); marks.push([x + sx * 11, sx === -1 ? -1.6 : RZ0, x + sx * 11 + 0.35, sx === -1 ? RZ1 : -1.9]); }
    for (let z = -220; z < 220; z += 9) if (z < RZ0 - 6 || z > RZ1 + 6) marks.push([x - 0.06, z, x + 0.06, z + 3.4]);
  }
  for (const z of AVE) for (let x = 14; x < 606; x += 9) marks.push([x, z - 0.06, x + 3.4, z + 0.06]);
  quads(marks, 0.014, surf(0.3, 0.33, 0.39, 0));

  /* ── 가로등(기둥·팔·등), 인도 턱의 낮은 표지, 가로수(나무 둘레의 흙 자리 포함) ── */
  const poles = [], heads = [], bollards = [], trunks = [], crowns = [], pits = [];
  for (let x = X0 + 10; x < X1; x += 32) for (const s of [1, -1]) {
    const px = x + (s === 1 ? 0 : 16), pz = s === 1 ? RZ1 + 0.7 : RZ0 - 0.7;
    if (CROSS.some((c) => Math.abs(c - px) < 10) || (s === 1 && Math.abs(px - 501) < 15)) continue;   // 정류장 자리는 비워 둔다
    poles.push([px, 3.6, pz, 0.13, 7.2, 0.13], [px, 7.15, pz - s * 1.1, 0.09, 0.09, 2.2], [px, 0.2, pz, 0.26, 0.4, 0.26]);
    heads.push([px, 7.08, pz - s * 2.1, 0.5, 0.07, 0.24]);
  }
  instanced(box, surf(0.07, 0.08, 0.1, 0.5), poles);
  instanced(box, glow(0.78, 0.86, 0.98), heads);
  for (let x = X0 + 4; x < X1; x += 4) if (!CROSS.some((c) => Math.abs(c - x) < 10) && Math.abs(x - 512) > 16) bollards.push([x, 0.24, RZ1 + 0.42, 0.1, 0.26, 0.1]);
  for (let x = X0 + 6; x < X1; x += 11) { if (CROSS.some((c) => Math.abs(c - x) < 11)) continue; const h = 3.2 + R() * 1.6, r = 1.5 + R() * 0.8, z = RZ0 - 2.3; trunks.push([x, h / 2, z, 0.16, h, 0.16]); crowns.push([x, h + r * 0.55, z, r, r * (0.85 + R() * 0.3), r, [0.8 + R() * 0.3, 0.9 + R() * 0.2, 1]]); pits.push([x - 0.6, z - 0.6, x + 0.6, z + 0.6]); }
  for (const z of AVE) for (let x = 20; x < 600; x += 14) { if (CROSS.some((c) => Math.abs(c - x) < 10)) continue; const h = 3 + R() * 1.5, r = 1.6 + R() * 0.7; trunks.push([x, h / 2, z + 7.5, 0.16, h, 0.16]); crowns.push([x, h + r * 0.55, z + 7.5, r, r, r, [0.9, 1, 1]]); }
  instanced(box, surf(0.1, 0.11, 0.14, 0.4), bollards);
  instanced(box, surf(0.045, 0.042, 0.045, 0.3), trunks);
  instanced(new THREE.IcosahedronGeometry(1, 1), surf(0.03, 0.058, 0.062, 0.75), crowns);
  quads(pits, 0.125, surf(0.022, 0.024, 0.028, 0));

  /* ── 건물 ── */
  const blds = [];   // [x, z, w, h, d, 유형, 층 높이, 칸 너비]
  const TONES = [[0.078, 0.084, 0.098], [0.092, 0.092, 0.096], [0.066, 0.076, 0.096], [0.1, 0.096, 0.09], [0.07, 0.074, 0.082]];
  const spec = (ty) => (ty === 0 ? { fh: 3.6, bw: 4.2, fl: 1 + Math.floor(R() * 3), w: 10 + R() * 7, d: 12 + R() * 6, gf: 4.6 }
    : ty === 1 ? { fh: 3.5, bw: 3.1 + R() * 0.6, fl: 5 + Math.floor(R() * 6), w: 14 + R() * 9, d: 14 + R() * 8, gf: 4.6 }
      : ty === 2 ? { fh: 3.7, bw: 4.4 + R() * 1.2, fl: 6 + Math.floor(R() * 7), w: 16 + R() * 9, d: 15 + R() * 8, gf: 4.6 }
        : { fh: 3.9, bw: 1.6 + R() * 0.5, fl: 14 + Math.floor(R() * 10), w: 20 + R() * 7, d: 18 + R() * 7, gf: 6.2 });
  const put = (cx, cz, ty, s, w = s.w, d = s.d) => { const h = s.gf + s.fl * s.fh + 1.0; blds.push([cx, cz, w, h, d, ty, s.fh, s.bw]); return h; };
  const xb = [X0 + 30, ...CROSS, X1 - 20];
  for (let i = 0; i < xb.length - 1; i++) {
    const x0 = xb[i] + 9, x1 = xb[i + 1] - 9;
    for (const [front, dir] of [[-14, -1], [64, 1]]) {                                   // 큰길을 바라보는 첫 줄: 정면이 한 선에 맞는다. 문 쪽은 카메라가 지나는 자리(z < 60)를 광장으로 비워 둔다
      let x = x0 + R() * 1.5, lastTall = false;
      while (x1 - x > 9) {
        const pr = R(); let ty = pr < 0.3 ? 0 : pr < 0.6 ? 1 : pr < 0.86 ? 2 : 3; if (ty === 3 && lastTall) ty = 1; lastTall = ty === 3;
        const s = spec(ty), w = Math.min(s.w, x1 - x), set = ty === 3 ? 3 + R() * 3 : R() < 0.25 ? 1.5 : 0;
        if (w < 8) break;
        put(x + w / 2, front + dir * (set + s.d / 2), ty, s, w); x += w + (R() < 0.3 ? 2.5 + R() * 3 : 0.5);
      }
    }
    for (const [za, zb] of [[-84, -46], [-200, -106], [114, 200]]) {           // 뒤쪽 줄: 중층·고층 위주
      const nx = 2 + Math.floor(R() * 2);
      for (let a = 0; a < nx; a++) { if (R() < 0.12) continue; const cw = (x1 - x0) / nx, near = Math.abs(za) < 100, ty = near ? (R() < 0.45 ? 1 : R() < 0.6 ? 2 : 3) : 4;
        const s = near ? spec(ty) : { fh: 3.6, bw: 3.4, fl: 6 + Math.floor(R() * R() * 20), w: cw * (0.6 + R() * 0.25), d: (zb - za) * (0.5 + R() * 0.3), gf: 0 };
        put(x0 + (a + 0.5) * cw + (R() - 0.5) * 3, (za + zb) / 2 + (R() - 0.5) * 8, ty, s, Math.min(s.w, cw - 2), Math.min(s.d, zb - za - 2)); }
    }
  }
  const nMain = blds.length, skirts = [];
  for (let i = 0; i < nMain; i++) {                                                      // 옥상: 계단실, 설비, 고층의 꼭대기 구조
    const [x, z, w, h, d, ty] = blds[i];
    if (ty > 3.5) continue;
    blds.push([x + (R() - 0.5) * w * 0.4, z + (R() - 0.5) * d * 0.3, 3.2 + R() * 1.5, 2.8, 3 + R() * 1.5, 8, 0, 0, h]);
    if (ty === 3) blds.push([x, z, w * 0.62, 3.6, d * 0.62, 8, 0, 0, h]);
    for (let k = 0; k < (mobile ? 1 : 1 + Math.floor(R() * 3)); k++) blds.push([x + (R() - 0.5) * w * 0.7, z + (R() - 0.5) * d * 0.7, 1.8 + R(), 1.3 + R() * 0.6, 1.2 + R(), 8, 0, 0, h]);
    if (Math.abs(z) < 60) skirts.push([x, z, w, d]);
  }
  for (let i = 0; i < (mobile ? 36 : 64); i++) { const side = R() < 0.5 ? -1 : 1; blds.push([-260 + R() * 1150, side * (250 + R() * 260), 22 + R() * 40, 30 + R() * R() * 120, 22 + R() * 40, 5, 4.2, 5]); }
  {
    const ring = [[1, 1, 0, 1], [1, 1, 1, 0], [-1, 1, 1, 0], [-1, 1, 0, 1], [-1, -1, 0, 1], [-1, -1, 1, 0], [1, -1, 1, 0], [1, -1, 0, 1]];   // [모서리 x, z, 깎는 방향 x, z]
    const nrm = [[0.707, 0.707], [0, 1], [-0.707, 0.707], [-1, 0], [-0.707, -0.707], [0, -1], [0.707, -0.707], [1, 0]];
    const pos = [], cor = [], ins = [], nn = [], idx = [];
    const vtx = (r, y, nx, ny, nz) => { pos.push(0, y, 0); cor.push(r[0], r[1]); ins.push(r[2], r[3]); nn.push(nx, ny, nz); return pos.length / 3 - 1; };
    ring.forEach((r, i) => { const r2 = ring[(i + 1) % 8], [nx, nz] = nrm[i]; const a = vtx(r, 0, nx, 0, nz), b = vtx(r2, 0, nx, 0, nz), c = vtx(r, 1, nx, 0, nz), d = vtx(r2, 1, nx, 0, nz); idx.push(a, b, c, b, d, c); });
    const t0 = vtx(ring[0], 1, 0, 1, 0); for (let i = 1; i < 8; i++) vtx(ring[i], 1, 0, 1, 0); for (let i = 1; i < 7; i++) idx.push(t0, t0 + i, t0 + i + 1);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aCorner', new THREE.Float32BufferAttribute(cor, 2)); g.setAttribute('aInset', new THREE.Float32BufferAttribute(ins, 2)); g.setAttribute('aN', new THREE.Float32BufferAttribute(nn, 3)); g.setIndex(idx);
    const n = blds.length, aPos = new Float32Array(n * 3), aSize = new Float32Array(n * 3), aStyle = new Float32Array(n * 4), aTone = new Float32Array(n * 3);
    blds.forEach(([x, z, w, h, d, ty, fh, bw, y0 = 0], i) => { const tn = ty === 8 ? [0.06, 0.066, 0.08] : ty > 3.5 ? [0.05, 0.058, 0.08] : TONES[Math.floor(R() * TONES.length)]; aPos.set([x, y0, z], i * 3); aSize.set([w, h, d], i * 3); aStyle.set([R(), ty, fh || 3.6, bw || 3.4], i * 4); aTone.set(tn, i * 3); });
    for (const [name, arr, size] of [['aPos', aPos, 3], ['aSize', aSize, 3], ['aStyle', aStyle, 4], ['aTone', aTone, 3]]) g.setAttribute(name, new THREE.InstancedBufferAttribute(arr, size));
    g.instanceCount = n;
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: U, vertexShader: B_VERT, fragmentShader: COMMON + B_FRAG, extensions: { derivatives: true }, side: THREE.DoubleSide })); m.frustumCulled = false; scene.add(m);
    world.buildings = n;
  }
  /* 건물이 땅에 닿는 자리의 그늘: 건물 둘레 2.4m 로 번지는 어둠(가까운 줄만) */
  {
    const pos = [], al = [], idx = []; let k = 0;
    for (const [x, z, w, d] of skirts) { const hx = w / 2, hz = d / 2, o = 2.4, inn = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]], out = [[-hx - o, -hz - o], [hx + o, -hz - o], [hx + o, hz + o], [-hx - o, hz + o]];
      for (let e = 0; e < 4; e++) { const a = inn[e], b = inn[(e + 1) % 4], c = out[e], dd = out[(e + 1) % 4]; pos.push(x + a[0], 0.008, z + a[1], x + b[0], 0.008, z + b[1], x + c[0], 0.008, z + c[1], x + dd[0], 0.008, z + dd[1]); al.push(1, 1, 0, 0); idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); k += 4; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aA', new THREE.Float32BufferAttribute(al, 1)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexShader: 'attribute float aA; varying float vA; void main() { vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'varying float vA; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, vA * vA * 0.62); }' })); m.frustumCulled = false; m.renderOrder = 1; scene.add(m);
  }
  /* 지평선 쪽의 옅은 하늘빛: 먼 윤곽이 검은 배경과 구분되게 한다 */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(880, 32, 16), new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, depthWrite: false, vertexShader: `varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `varying vec3 vP; uniform float uFar; void main() { float e = normalize(vP).y; float g = exp(-pow(max(e, 0.0) / 0.1, 1.3)) * step(-0.02, e); gl_FragColor = vec4(vec3(0.014, 0.028, 0.06) * g * uFar, 1.0); }` }));
  sky.renderOrder = -1; scene.add(sky); world.sky = sky;

  /* ── 다른 버스: 큰길의 옆 차로와 반대 차로, 교차로를 건너는 길, 뒤쪽 길. 서로와 주인공을 피하도록 출발 위치를 고른다 ── */
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
  const oBody = new THREE.InstancedMesh(obGeo, surf(0.066, 0.08, 0.112, 0.75), lanes.length); oBody.frustumCulled = false; scene.add(oBody);
  const oGlass = new THREE.InstancedMesh(box, surf(0.012, 0.016, 0.028, 0.2), lanes.length); oGlass.frustumCulled = false; scene.add(oGlass);
  const nL = lanes.length;

  /* ── 선 ①: 도시 구조(운행 연결망). 어둡고 안정적인 청색. 큰길에서 바깥으로 그려지며 켜진다(길 하나가 한 줄이라 이음매가 없다) ── */
  const streets = [];   // [ax, az, bx, bz, d0, d1]
  for (const x of CROSS) for (const s of [-1, 1]) streets.push([x, s * 6, x, s * 200, 6, 200]);
  for (const z of AVE) streets.push([20, z, 600, z, Math.abs(z) + 8, Math.abs(z) + 8]);
  const netL = fatLines(THREE, streets.length, { px: [0.8, 1.5], uniforms: { uNet: U.uNet },
    frag: `uniform float uNet; vec4 shade() { float e = uNet * 230.0; float on = 1.0 - smoothstep(e - 6.0, e, vE.x); float lead = exp(-pow((vE.x - e + 6.0) / 9.0, 2.0)) * step(0.01, uNet) * (1.0 - step(0.999, uNet));
      return vec4(vec3(0.028, 0.095, 0.3) * (on + 0.8 * lead) * lineA(), 1.0); }` });
  streets.forEach(([ax, az, bx, bz, d0, d1], i) => netL.set(i, [ax, 0.3, az], [bx, 0.3, bz], [d0, 0, 0, 0], [d1, 0, 0, 0], 0.45)); netL.done(); scene.add(netL.mesh);
  /* ── 선 ②: 선택 노선(주인공 버스가 달리는 길). 선명한 시안. 버스의 실제 경로(차로 변경 포함)를 따라 노면에 놓인다 ── */
  const rp = []; { const zAt = (x) => { if (!path.length || x <= path[0][0]) return 0; for (let i = 1; i < path.length; i++) if (path[i][0] >= x) { const [xa, za] = path[i - 1], [xb2, zb2] = path[i]; return za + ((zb2 - za) * (x - xa)) / Math.max(1e-6, xb2 - xa); } return path[path.length - 1][1]; };
    for (let x = X0 + 30; x <= X1 - 28; x += 4) rp.push([x, zAt(x)]); }
  const routeU = { uBusX: { value: 0 }, uRoute: { value: 0 }, uAhead: { value: 0 }, uPing: { value: 0 } };
  const routeL = fatLines(THREE, rp.length - 1, { px: [1.3, 3.4], cap: 0, uniforms: routeU,
    frag: `uniform float uBusX, uRoute, uAhead, uPing; vec4 shade() { float x = vE.x, behind = 1.0 - smoothstep(uBusX - 9.0, uBusX - 5.0, x), ahead = smoothstep(uBusX + 5.5, uBusX + 12.0, x);
      float k = behind * smoothstep(uBusX - 330.0, uBusX - 70.0, x) + ahead * (1.0 - smoothstep(uBusX + 140.0, uBusX + 430.0, x)) * 0.5 * uAhead;
      k *= 1.0 + 0.85 * uPing * exp(-pow((x - uBusX) / 60.0, 2.0));                              // 위치가 갱신되면 이 차량이 지나는 구간만 잠깐 밝아진다
      return vec4(vec3(0.15, 0.7, 1.0) * k * uRoute * lineA(), 1.0); }` });
  for (let i = 0; i < rp.length - 1; i++) routeL.set(i, [rp[i][0], 0.05, rp[i][1]], [rp[i + 1][0], 0.05, rp[i + 1][1]], [rp[i][0], 0, 0, 0], [rp[i + 1][0], 0, 0, 0], 0.5);
  routeL.done(); scene.add(routeL.mesh);
  /* ── 선 ③: 이동하는 데이터(배경의 작은 신호). 작은 선두와 짧은 잔광이 길을 따라 고른 속도로 간다. 길마다 속도와 박자가 다르고, 양 끝에서는 서서히 켜지고 꺼진다 ── */
  const NSK = mobile ? 12 : 30, streaks = [];
  for (let i = 0; i < NSK; i++) { const st = streets[Math.floor(R() * streets.length)], flip = R() < 0.5; streaks.push({ st, flip, len: Math.hypot(st[2] - st[0], st[3] - st[1]), speed: 9 + R() * 9, phase: R(), tail: 5 + R() * 4 }); }
  const streakL = fatLines(THREE, NSK, { px: [1.0, 2.4], frag: `vec4 shade() { float t = along(); return vec4((vec3(0.14, 0.42, 0.95) * t * t + vec3(0.6, 0.86, 1.0) * smoothstep(0.88, 1.0, t)) * vE.x * lineA(), 1.0); }` }); scene.add(streakL.mesh);
  /* ── 도트 ④: 위치(다른 버스의 작은 노드)와 차량의 등. 주인공의 정보 노드는 node.js 가 그린다 ── */
  const lightD = dots(THREE, nL * 4, { px: [1.6, 7] }); scene.add(lightD.mesh);
  const posD = dots(THREE, nL, { px: [3.5, 10], depthTest: false, order: 7 }); scene.add(posD.mesh);
  const stemL = fatLines(THREE, nL, { px: [0.8, 1.3], cap: 0, depthTest: false, frag: 'vec4 shade() { return vec4(vec3(0.08, 0.3, 0.8) * (0.3 + 0.7 * along()) * vE.x * lineA(), 1.0); }' }); scene.add(stemL.mesh);   // 다른 버스: 지붕에서 올라가는 짧고 어두운 선
  const order = lanes.map((_, i) => i);

  /* 주인공 버스 둘레: 접지 그림자, 차체 아래로 번지는 옅은 빛, 전조등이 비추는 노면 */
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 5.6), new THREE.MeshBasicMaterial({ map: radial(THREE, [[0, 'rgba(0,0,0,1)'], [0.5, 'rgba(0,0,0,0.92)'], [0.78, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; shadow.renderOrder = 2; scene.add(shadow);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(44, 30), new THREE.MeshBasicMaterial({ map: radial(THREE, [[0, 'rgba(70,112,180,0.2)'], [0.4, 'rgba(34,62,112,0.09)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.022; pool.renderOrder = 1; scene.add(pool);
  const bc = document.createElement('canvas'); bc.width = 256; bc.height = 128; const bg = bc.getContext('2d');
  for (const [cy, a] of [[40, 0.9], [88, 0.9]]) { const g2 = bg.createRadialGradient(18, cy, 2, 120, cy, 130); g2.addColorStop(0, `rgba(190,220,255,${a})`); g2.addColorStop(0.35, 'rgba(90,140,220,0.3)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); bg.globalCompositeOperation = 'lighter'; bg.fillStyle = g2; bg.fillRect(0, 0, 256, 128); }
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(34, 7.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); beam.rotation.x = -Math.PI / 2; beam.position.y = 0.026; beam.renderOrder = 1; scene.add(beam);

  const yAxis = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), gs = new THREE.Vector3(9.4, 1.1, 0.02), sm = (a, b, x) => smooth(a, b, x);
  /**
   * @param s { busX, busZ, dist, time, reveal(열린 반경 m), ahead, low, far, net, sig, head, pulseX·pulse, px, res([가로, 세로] px), routeK(선택 노선의 밝기), aheadK(앞쪽 노선), ping(위치 갱신 때 구간이 밝아지는 정도) }
   */
  world.update = (s) => {
    U.uBus.value.set(s.busX, s.reveal, s.ahead, s.low || 0); U.uT.value = s.time; U.uFar.value = s.far; U.uNet.value = s.net; U.uPx.value = s.px; U.uPulse.value.set(s.pulseX || 0, s.pulse || 0); U.uFog.value = 0.001 + 0.0013 * s.far;
    if (s.res) RES.value.set(s.res[0], s.res[1]);
    const bz = s.busZ || 0, revAt = (x, z) => 1 - sm(s.reveal * 0.55, s.reveal, Math.hypot((x - s.busX - s.ahead) * 0.6, z));
    shadow.position.set(s.busX, 0.03, bz); pool.position.set(s.busX, 0.022, bz); pool.material.opacity = 1 - 0.5 * s.net;
    beam.position.set(s.busX + 5.3 + 17, 0.026, bz); beam.material.opacity = 0.85 * s.head;
    lanes.forEach((l, i) => {
      at(l, s.dist, pa); const dx = l.b[0] - l.a[0], dz = l.b[1] - l.a[1], yaw = Math.atan2(-dz, dx);
      q.setFromAxisAngle(yAxis, yaw); m4.compose(v3.set(pa[0], 0, pa[1]), q, one); oBody.setMatrixAt(i, m4);
      m4.compose(v3.set(pa[0], 2.03, pa[1]), q, gs.set(9.3, 1.12, 2.52)); oGlass.setMatrixAt(i, m4);
      const cy = Math.cos(yaw), sy = Math.sin(yaw), rv = revAt(pa[0], pa[1]);
      [[5.5, 0.85, 0.85], [5.5, 0.85, -0.85], [-5.52, 1.4, 0.95], [-5.52, 1.4, -0.95]].forEach(([lx, ly, lz], k) => lightD.set(i * 4 + k, [pa[0] + lx * cy + lz * sy, ly, pa[1] - lx * sy + lz * cy], 0.5, k < 2 ? [0.8, 0.9, 1.0] : [0.75, 0.07, 0.09], rv, 0.34, 0.55));
      /* 위치 도트: 차례로 켜지고, 버스마다 다른 박자로 아주 천천히 숨쉰다 */
      const on = sm(order.indexOf(i) / nL, order.indexOf(i) / nL + 0.12, s.sig);
      /* 다른 버스의 노드: 작고 어둡다(주인공만 선명한 시안). 한꺼번에 깜빡이지 않는다 */
      const oa = on * (0.82 + 0.18 * Math.sin(s.time * 1.1 + i * 2.4));
      posD.set(i, [pa[0], 7.4, pa[1]], 1.7, [0.2, 0.46, 0.98], oa * 0.72, 0.26, 0.3);
      stemL.set(i, [pa[0], 3.4, pa[1]], [pa[0], 6.9, pa[1]], [oa * 0.55, 0, 0, 0], [oa * 0.55, 0, 0, 0], 0.12);
    });
    oBody.instanceMatrix.needsUpdate = oGlass.instanceMatrix.needsUpdate = true; lightD.done();
    posD.done(); stemL.done(); posD.mesh.visible = stemL.mesh.visible = s.sig > 0.002;
    routeU.uBusX.value = s.busX; routeU.uRoute.value = s.routeK ?? s.net; routeU.uAhead.value = s.aheadK ?? s.net; routeU.uPing.value = s.ping || 0;
    streakL.mesh.visible = s.net > 0.002;
    if (streakL.mesh.visible) {
      const edge = s.net * 230;
      streaks.forEach((k, i) => {
        const st = k.st, u = (((k.phase + (s.time * k.speed) / k.len) % 1) + 1) % 1, f = k.flip ? 1 - u : u, t0 = Math.max(0, u - k.tail / k.len), g0 = k.flip ? 1 - t0 : t0;
        const hx = st[0] + (st[2] - st[0]) * f, hz = st[1] + (st[3] - st[1]) * f, tx = st[0] + (st[2] - st[0]) * g0, tz = st[1] + (st[3] - st[1]) * g0;
        const a = sm(0, 0.1, u) * (1 - sm(0.88, 1, u)) * (1 - sm(edge - 6, edge, st[4] + (st[5] - st[4]) * f)) * s.net;
        streakL.set(i, [tx, 0.34, tz], [hx, 0.34, hz], [a, 0, 0, 0], [a, 0, 0, 0], 0.5);
      });
      streakL.done();
    }
  };
  return world;
}
