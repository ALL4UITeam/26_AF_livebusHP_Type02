/**
 * 주인공 버스 — 최종 사용 모델(2026-11-26 확정). 한국형 저상 시내버스 참고 그림 두 장(전면·후면 3/4)의 비례와 구성을 옮겼다.
 *
 * 기준: 단위 1 = 1m. 원점은 차체 한가운데의 노면(y = 0). 앞 +x, 위 +y, 오른쪽(문 쪽) +z.
 * 크기: 길이 11.0 · 폭 2.5 · 차체 높이 3.2(지붕 설비 포함 3.32) · 축거 5.4(앞 오버행 2.7, 뒤 오버행 2.9) · 타이어 지름 0.96.
 *
 * 구조
 * - 차체: 단면(둥근 모서리의 상자)을 길이 방향으로 이어 붙인 한 장의 곡면. 앞뒤는 평면도에서 모서리가 둥글게 감긴다.
 * - 도색·유리·문·패널 선: 곡면을 '펼친 좌표(u, y)'에서 수식으로 그린다(shader). 덧붙인 판이 아니라서 반사가 한 면으로 이어지고, 가까이에서도 경계가 선명하다.
 *   유리 안쪽은 시선에 따라 어긋나 보이는 얕은 실내(천장등·좌석·기둥)로 암시한다. 실제 실내 모델은 아니다.
 * - 바퀴집: 차체를 실제로 뚫고 안쪽에 어두운 통을 넣었다. 바퀴는 차체와 분리된 네 개의 묶음(뒤는 복륜)이고 z 축으로 돈다.
 * - 따로 만든 부품: 전조등 렌즈, 후미등, 사이드미러, 와이퍼, 행선지 표시, 지붕 설비, 안테나, 바퀴집 테두리.
 */
export const BUS = { length: 11, width: 2.5, height: 3.32, wheelRadius: 0.48, axles: [2.8, -2.6] };
/** 위치 신호가 나가는 점(차체 기준 좌표): 지붕 앞쪽 안테나의 끝 */
export const SIGNAL = { x: 3.92, y: 3.36, z: 0.42 };

/* ── 차체 곡면의 수식 ── */
const W2 = 1.25, YB = 0.32, YT = 3.2, YC = (YB + YT) / 2, HH = (YT - YB) / 2;
const NT = 5.2, NB = 9;                                  // 단면 모서리: 지붕 쪽은 크게, 바닥 쪽은 작게 둥글다
const XF0 = 5.0, AF = 0.5, MF = 3.0, RTF = 0.22, RBF = 0.1;      // 앞: 평면도에서 둥글게 감기는 구간과 위·아래 모서리
const XR0 = -5.22, AR = 0.28, MR = 4.0, RTR = 0.2, RBR = 0.08;   // 뒤: 더 평평하다
const KE = 2.2;
const UF = XF0 + W2, UR = XR0 - W2;                      // 펼친 좌표에서 앞면·뒷면의 한가운데
const R = BUS.wheelRadius, ARCH = 0.66, [AXF, AXR] = BUS.axles;
const TRACK = 1.06;                                      // 바퀴 중심의 z

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const tumble = (y) => 1 - 0.035 * smooth(1.5, 3.2, y);                                   // 지붕 쪽으로 살짝 좁아지는 옆면
const rake = (x, y) => 0.2 * smooth(1.15, 3.1, y) * smooth(4.85, 5.2, x) - 0.07 * smooth(1.3, 3.1, y) * smooth(-4.5, -5.3, x);   // 뒤로 누운 앞유리, 살짝 선 뒷면
const edge = (xi, r) => r * (1 - (1 - xi ** KE) ** (1 / KE));
/** 길이 방향의 한 단면: rho = 1 은 몸통, 0 은 앞(뒤) 끝의 한가운데 */
const noseRing = (rho) => { const xi = (1 - rho ** MF) ** (1 / MF); return { x0: XF0 + AF * xi, hw: W2 * rho, yb: YB + edge(xi, RBF), yt: YT - edge(xi, RTF), u: XF0 + W2 * (1 - rho) }; };
const tailRing = (rho) => { const xi = (1 - rho ** MR) ** (1 / MR); return { x0: XR0 - AR * xi, hw: W2 * rho, yb: YB + edge(xi, RBR), yt: YT - edge(xi, RTR), u: XR0 - W2 * (1 - rho) }; };
const sideZ = (y) => { const a = Math.abs((y - YC) / HH), n = y >= YC ? NT : NB; return W2 * tumble(y) * (1 - Math.min(1, a) ** n) ** (1 / n); };
const roofY = (z) => YC + HH * (1 - Math.abs(z / W2) ** NT) ** (1 / NT);
/** 앞(뒤)면 위의 점: 높이 y, 좌우 z 에서 곡면의 x 를 찾는다 */
const endX = (ring, y, z) => {
  const out = (rho) => { const r = ring(rho), yc = (r.yt + r.yb) / 2, hh = (r.yt - r.yb) / 2, a = Math.abs(y - yc) / hh, n = y >= yc ? NT : NB; return a >= 1 ? 1 : Math.abs(z) - r.hw * tumble(y) * (1 - a ** n) ** (1 / n); };
  let lo = 1e-4, hi = 1;
  if (out(hi) > 0) return ring(1).x0 - rake(ring(1).x0, y);
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (out(m) > 0) lo = m; else hi = m; }
  const x0 = ring(hi).x0; return x0 - rake(x0, y);
};
const frontX = (y, z) => endX(noseRing, y, z);
const rearX = (y, z) => endX(tailRing, y, z);

/** 단면을 도는 각도 목록: 평평한 곳은 성기게, 모서리는 촘촘하게 */
function sectionAngles(seg) {
  const F = 1440, acc = [0]; let px = 0, py = 0, pa = 0;
  const pt = (t) => { const c = Math.cos(t), s = Math.sin(t), n = s >= 0 ? NT : NB; return [W2 * Math.sign(c) * Math.abs(c) ** (2 / n), HH * Math.sign(s) * Math.abs(s) ** (2 / n)]; };
  for (let i = 0; i <= F; i++) {
    const [x, y] = pt((i / F) * Math.PI * 2);
    if (i) { const dl = Math.hypot(x - px, y - py), a = Math.atan2(y - py, x - px); let da = i > 1 ? Math.abs(a - pa) : 0; if (da > Math.PI) da = Math.PI * 2 - da; acc.push(acc[i - 1] + dl + 0.85 * da); pa = a; }
    px = x; py = y;
  }
  const out = [];
  for (let j = 0, i = 0; j <= seg; j++) { const want = (acc[F] * j) / seg; while (i < F && acc[i + 1] < want) i++; const k = acc[i + 1] > acc[i] ? (want - acc[i]) / (acc[i + 1] - acc[i]) : 0; out.push(((i + clamp01(k)) / F) * Math.PI * 2 - Math.PI / 2); }   // 이음매는 바닥 한가운데
  out[seg] = out[0] + Math.PI * 2;
  return out;
}

/** 차체 곡면(뒤 끝 → 몸통 → 앞 끝). aU 는 도색을 그리는 '펼친 좌표'다. 다른 버스는 분할 수만 줄여 같은 모양을 쓴다 */
export function bodyGeometry(THREE, seg = 128, tube = 44) {
  const fine = seg >= 60, KN = fine ? 18 : 6, KT = fine ? 12 : 5;
  const rings = [];
  for (let k = 0; k <= KT; k++) rings.push(tailRing(Math.sin(((k / KT) * Math.PI) / 2)));          // k = 0 은 폭이 0 인 세로선: 뒷면 한가운데에서 좌우가 만난다
  for (let k = 1; k < tube; k++) { const x0 = XR0 + ((XF0 - XR0) * k) / tube; rings.push({ x0, hw: W2, yb: YB, yt: YT, u: x0 }); }
  for (let k = KN; k >= 0; k--) rings.push(noseRing(Math.sin(((k / KN) * Math.PI) / 2)));
  const ang = sectionAngles(seg), pos = [], au = [], idx = [];
  for (const r of rings) {
    const yc = (r.yt + r.yb) / 2, hh = (r.yt - r.yb) / 2;
    for (let j = 0; j <= seg; j++) {
      const c = Math.cos(ang[j]), s = Math.sin(ang[j]), n = s >= 0 ? NT : NB, y = yc + hh * Math.sign(s) * Math.abs(s) ** (2 / n);
      pos.push(r.x0 - rake(r.x0, y), y, r.hw * Math.sign(c) * Math.abs(c) ** (2 / n) * tumble(y)); au.push(r.u);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + seg + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aU', new THREE.Float32BufferAttribute(au, 1)); g.setIndex(idx); g.computeVertexNormals();
  const nrm = g.attributes.normal;                                                         // 이음매 양쪽의 법선을 맞춘다(반사가 끊기지 않게)
  for (let i = 0; i < rings.length; i++) { const a = i * (seg + 1), b = a + seg, x = nrm.getX(a) + nrm.getX(b), y = nrm.getY(a) + nrm.getY(b), z = nrm.getZ(a) + nrm.getZ(b), l = Math.hypot(x, y, z) || 1; nrm.setXYZ(a, x / l, y / l, z / l); nrm.setXYZ(b, x / l, y / l, z / l); }
  for (let j = 0; j <= seg; j++) { nrm.setXYZ(j, -1, 0, 0); nrm.setXYZ((rings.length - 1) * (seg + 1) + j, 1, 0, 0); }                    // 앞뒤 끝의 한가운데(접힌 단면)는 진행 방향을 본다
  return g;
}

/* ── 도색·유리·문: 펼친 좌표 (u, y) 에서의 배치. 문 쪽(z > 0)과 반대쪽(z < 0)이 다르다 ── */
const WIN = [1.38, 2.56];                                                                   // 옆 유리의 아래·위
const LAYOUT = {
  windshield: [UF, 1.85, 1.12, 0.65, 0.13],                                                 // [가운데 u, 가운데 y, 반너비, 반높이, 모서리]
  rearWindow: [UR, 2.33, 0.97, 0.38, 0.1],
  doors: [[3.6, 4.84], [-1.04, 0.34]],                                                      // 문 쪽에만: 앞문(앞바퀴 앞), 중간 승하차문
  windowsDoorSide: [[0.42, 1.9], [1.98, 3.5], [-2.6, -1.12], [-4.15, -2.68], [-5.0, -4.23]],
  windowsFarSide: [[2.18, 3.64], [0.64, 2.1], [-0.9, 0.56], [-2.44, -0.98], [-3.98, -2.52], [-5.0, -4.06]],
  driverWindow: [3.72, 4.84, 1.26, 2.56],
};
const f = (v) => { const s = (+v).toFixed(4); return s.includes('.') ? s : s + '.0'; };
const boxc = (cx, cy, hw, hh, r) => `sdB(p, vec2(${f(cx)}, ${f(cy)}), vec2(${f(hw)}, ${f(hh)}), ${f(r)})`;
const rect = (u0, u1, y0, y1, r = 0.05) => boxc((u0 + u1) / 2, (y0 + y1) / 2, (u1 - u0) / 2, (y1 - y0) / 2, r);
const seg2 = (a, b) => `sdS(p, vec2(${f(a[0])}, ${f(a[1])}), vec2(${f(b[0])}, ${f(b[1])}))`;
const mins = (list) => list.reduce((a, b) => `min(${a}, ${b})`);
const chain = (pts) => mins(pts.slice(1).map((q, i) => seg2(pts[i], q)));
const leaves = ([u0, u1]) => { const m = (u0 + u1) / 2; return [rect(u0 + 0.06, m - 0.02, 0.5, 2.54, 0.04), rect(m + 0.02, u1 - 0.06, 0.5, 2.54, 0.04)]; };

const LIVERY_HEAD = `
varying vec3 vLp; varying vec3 vLn; varying float vU;
uniform vec3 uCamL; uniform vec3 uAccent; uniform vec3 uDrl; uniform vec3 uTail;
float sdB(vec2 p, vec2 c, vec2 h, float r) { vec2 d = abs(p - c) - h + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
float sdS(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
float lineM(float d, float hw, float w) { return (1.0 - smoothstep(hw - w, hw + w, d)) * min(1.0, hw / w + 0.3); }
/* 유리 안쪽의 얕은 실내: 천장등, 좌석 등받이, 손잡이 기둥 */
float cabinSide(vec3 h) {
  float inside = smoothstep(-5.05, -4.8, h.x) * (1.0 - smoothstep(4.7, 4.95, h.x));
  float ceil = exp(-pow((h.y - 2.6) / 0.2, 2.0)) * 1.1 + 0.2 * smoothstep(0.6, 2.4, h.y);
  float sx = abs(fract(h.x / 0.82 + 0.5) - 0.5) * 0.82;
  float seat = (1.0 - smoothstep(0.18, 0.21, sx)) * (1.0 - smoothstep(1.46, 1.56, h.y + sx * sx * 2.2)) * smoothstep(0.7, 0.8, h.y);
  float px = abs(fract(h.x / 1.64 + 0.25) - 0.5) * 1.64;
  float pole = (1.0 - smoothstep(0.012, 0.024, px)) * (1.0 - smoothstep(2.5, 2.62, h.y)) * smoothstep(0.6, 0.75, h.y);
  float strap = (1.0 - smoothstep(0.012, 0.03, length(vec2(abs(fract(h.x / 0.41) - 0.5) * 0.41, h.y - 2.26)))) * 0.16;
  return inside * (ceil * (1.0 - 0.82 * seat) + 0.55 * pole + strap);
}
float cabinFront(vec3 h) {
  float ceil = exp(-pow((h.y - 2.5) / 0.22, 2.0)) * (1.0 - 0.45 * smoothstep(0.2, 0.9, abs(abs(h.z) - 0.45)));
  float dash = 1.0 - smoothstep(1.3, 1.36, h.y);
  float wheel = 1.0 - smoothstep(0.012, 0.03, abs(length(vec2(h.z + 0.62, (h.y - 1.42) * 1.25)) - 0.21));
  float seat = (1.0 - smoothstep(0.24, 0.28, abs(h.z + 0.62))) * (1.0 - smoothstep(1.76, 1.86, h.y));
  return (ceil + 0.12) * (1.0 - 0.9 * dash) * (1.0 - 0.6 * seat * (1.0 - dash)) + 0.16 * wheel * (1.0 - dash);
}`;

function liveryMain() {
  const L = LAYOUT, [wy0, wy1] = WIN;
  const win = (list) => mins(list.map(([a, b]) => rect(a, b, wy0, wy1, 0.06)));
  const doorLeaves = mins(L.doors.flatMap(leaves));
  const doorBox = mins(L.doors.map(([a, b]) => rect(a, b, 0.42, 2.62, 0.05)));
  const dw = L.driverWindow;
  const accentSide = chain([[-5.16, 2.8], [-5.04, 2.92], [-4.84, 2.965], [4.42, 2.965], [4.74, 2.99], [5.0, 3.06]]);
  const seamBoth = mins([seg2([-4.42, 0.42], [-4.42, 1.3]), seg2([-1.86, 0.42], [-1.86, 1.3]), seg2([2.06, 0.42], [2.06, 1.3]), seg2([3.53, 0.42], [3.53, 1.3])]);
  const seamFar = mins([seg2([0.25, 0.58], [0.95, 0.58]), seg2([0.95, 0.58], [0.95, 1.02]), seg2([0.95, 1.02], [0.25, 1.02]), seg2([0.25, 1.02], [0.25, 0.58]), seg2([-1.3, 0.42], [-1.3, 1.3]), seg2([4.9, 0.42], [4.9, 1.26])]);
  return `
  vec3 lvE = vec3(0.0); float lvCC = 1.0;
  {
  vec2 p = vec2(vU, vLp.y);
  float sd = vLp.z >= 0.0 ? 1.0 : -1.0;
  /* 바퀴집은 실제로 뚫는다(옆면과 그 아래 바닥) */
  { float da = min(length(vec2(vLp.x - ${f(AXF)}, vLp.y - ${f(R)})), length(vec2(vLp.x - ${f(AXR)}, vLp.y - ${f(R)})));
    if (da < ${f(ARCH)} && abs(vLp.z) > 0.56 && vU > ${f(XR0)} && vU < ${f(XF0)}) discard; }
  float w = max(fwidth(vU), fwidth(vLp.y)) * 0.75 + 0.0004;
  #define FILL(d) (1.0 - smoothstep(-w, w, d))

  /* 유리: 앞유리(모서리까지 감긴다), 뒷유리, 옆 유리, 문 유리 */
  float gEnds = min(${boxc(...L.windshield)}, ${boxc(...L.rearWindow)});
  float gWin = 1e3, gDoor = 1e3, dDoor = 1e3, dSeam = ${seamBoth};
  if (sd > 0.0) { gWin = ${win(L.windowsDoorSide)}; gDoor = ${doorLeaves}; dDoor = ${doorBox}; }
  else { gWin = min(${win(L.windowsFarSide)}, ${rect(dw[0], dw[1], dw[2], dw[3], 0.06)}); dSeam = min(dSeam, ${seamFar}); }
  float glass = FILL(min(gEnds, min(gWin, gDoor)));

  /* 검은 유광 면: 창 띠(앞뒤에서 지붕까지 올라간다), 문 둘레, 앞유리 아래, 뒷면 가운데, 전조등 자리 */
  float top = 2.93 + 0.6 * smoothstep(4.5, 5.1, p.x) + 0.6 * (1.0 - smoothstep(-5.3, -4.95, p.x));
  float dBlack = max(1.3 - p.y, p.y - top);
  dBlack = min(dBlack, min(dDoor, min(${boxc(UF, 1.13, 1.2, 0.17, 0.05)}, ${boxc(UR, 1.28, 0.84, 0.4, 0.08)})));
  vec2 ph = vec2(p.x + (p.y - 0.66) * 0.42, p.y);                                          // 비스듬한 전조등 자리
  float dLamp = sdB(ph, vec2(${f(UF - 0.9)}, 0.66), vec2(0.3, 0.2), 0.05);
  dBlack = min(dBlack, dLamp);
  float black = FILL(dBlack);

  /* 무광: 아랫단, 문틀, 통풍구, 번호판 자리, 패널 이음선 */
  float dGrille = ${rect(-5.08, -4.5, 0.6, 1.16, 0.03)};
  float dIntake = ${boxc(UF, 0.5, 0.5, 0.075, 0.03)};
  float dVent = ${boxc(UR, 0.98, 0.62, 0.07, 0.02)};
  float dPlate = min(${boxc(UF, 0.74, 0.27, 0.065, 0.012)}, ${boxc(UR, 0.6, 0.27, 0.065, 0.012)});
  float slat = smoothstep(0.35, 0.5, abs(fract(p.y * 34.0) - 0.5) * 2.0);
  float grille = max(FILL(dGrille), max(FILL(dIntake), FILL(dVent)));
  float satin = FILL(dDoor) * (1.0 - FILL(gDoor));
  float seam = lineM(dSeam, 0.0035, w) * (1.0 - black);
  seam = max(seam, lineM(abs(p.y - 2.07), 0.006, w) * FILL(gWin + 0.02));                  // 옆 유리의 위쪽 여닫이 선
  seam = max(seam, lineM(abs(dDoor), 0.006, w));                                           // 문 둘레의 고무
  float matte = max(max(1.0 - smoothstep(0.385, 0.395, p.y), grille), max(seam, FILL(dPlate)));

  /* 빛나는 선: 지붕 가장자리의 시안, 앞면의 가는 선, 뒷면 가운데의 세 줄, 주간등, 위쪽 표시등 */
  float acc = lineM(${accentSide}, 0.011, w);
  acc = max(acc, lineM(${chain([[5.06, 1.0], [5.5, 0.965], [UF, 0.965]])}, 0.008, w));
  { float zb = p.x - ${f(UR)}; float wv = min(abs(p.y - 1.2), min(abs(p.y - 1.28), abs(p.y - 1.36)));
    acc = max(acc, lineM(wv, 0.006, w) * (1.0 - smoothstep(0.4, 0.62, zb)) * 0.7); }
  float drl = FILL(sdB(ph, vec2(${f(UF - 0.9)}, 0.835), vec2(0.27, 0.011), 0.008));
  drl = max(drl, 0.6 * FILL(${boxc(UF - 0.86, 2.99, 0.075, 0.011, 0.008)}));
  float tailM = FILL(${boxc(UR + 0.86, 2.9, 0.11, 0.013, 0.008)});

  vec3 paint = diffuseColor.rgb;
  float roof = smoothstep(0.75, 0.95, vLn.y);
  diffuseColor.rgb = mix(paint, paint * 0.55, roof);                                        // 지붕은 한 단계 어둡게
  roughnessFactor = mix(roughnessFactor, 0.5, roof);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.006, 0.007, 0.010), black); roughnessFactor = mix(roughnessFactor, 0.17, black); metalnessFactor = mix(metalnessFactor, 0.0, black);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.0025, 0.0035, 0.006), glass); roughnessFactor = mix(roughnessFactor, 0.04, glass);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.006), satin); roughnessFactor = mix(roughnessFactor, 0.48, satin);
  float gs = grille * slat;
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.011), vec3(0.002), gs), matte); roughnessFactor = mix(roughnessFactor, 0.86, matte); metalnessFactor = mix(metalnessFactor, 0.0, matte);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.034, 0.042), FILL(dPlate + 0.012));  // 글자 없는 번호판 자리
  lvCC = (1.0 - matte) * (1.0 - 0.6 * satin) * (1.0 - 0.5 * roof);

  /* 실내: 유리 안쪽 0.5m 깊이의 면을 시선 방향으로 찾아가 그린다(움직이면 유리와 어긋나 깊이가 느껴진다) */
  if (glass > 0.01) {
    vec3 dir = normalize(vLp - uCamL), nl = normalize(vLn);
    vec3 hp = vLp + dir * (0.5 / max(dot(-dir, nl), 0.22));
    float it = vU > ${f(XF0 + 0.08)} ? cabinFront(hp) : (vU < ${f(XR0)} ? exp(-pow((hp.y - 2.55) / 0.22, 2.0)) * 0.7 + 0.08 : cabinSide(hp));
    lvE += vec3(0.42, 0.6, 1.0) * it * glass * 0.075 * (1.0 - seam);
  }
  lvE += uAccent * acc * 1.35 + uDrl * drl * 1.2 + uTail * tailM * 3.0;
  }
  `;
}

export function buildBus(THREE, shared) {
  const group = new THREE.Group();
  const uni = { uCamL: { value: new THREE.Vector3(20, 3, 12) }, uAccent: { value: null }, uDrl: { value: null }, uTail: { value: null } };

  /* 재질에 공통으로 넣는 것: 오프닝의 '빛이 지나간 곳부터 밝아짐', 가로등 빛, 커서가 닿은 작은 영역의 약한 반사광. 차체에는 도색(livery)도 넣는다 */
  const inject = (mat, livery = false) => {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uSweep: shared.sweep, uCur: shared.cur, uCurAmt: shared.curAmt, uLamp: shared.lamp }, livery ? uni : {});
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nvarying vec3 vWp;${livery ? '\nattribute float aU; varying vec3 vLp; varying vec3 vLn; varying float vU;' : ''}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;${livery ? '\nvLp = transformed; vLn = normal; vU = aU;' : ''}`);
      let fs = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWp;\nuniform vec4 uSweep;\nuniform vec3 uCur;\nuniform float uCurAmt;\nuniform vec3 uLamp;${livery ? LIVERY_HEAD : ''}`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float sw = exp(-pow((vWp.x - uSweep.x) / 0.16, 2.0)) * uSweep.y;
          float loc = (1.0 - smoothstep(0.0, 0.85, distance(vWp, uCur))) * uCurAmt;                      // 커서: 작은 영역의 약한 반사광(고리·왜곡 없음)
          float lampBand = exp(-pow((vWp.x - uLamp.x) / 1.7, 2.0)) * uLamp.y * smoothstep(0.6, 2.6, vWp.y);
          totalEmissiveRadiance += vec3(0.25, 0.74, 1.0) * sw * 1.7 + vec3(0.42, 0.62, 0.9) * loc * 0.055 + vec3(0.5, 0.62, 0.85) * lampBand * 0.11;${livery ? '\n          totalEmissiveRadiance += lvE;' : ''}`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          gl_FragColor.rgb *= mix(1.0, 0.16 + 0.84 * smoothstep(uSweep.x - 0.4, uSweep.x + 1.4, vWp.x), uSweep.w);`);
      if (livery) fs = fs.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${liveryMain()}`)
        .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef CLEARCOAT\n  material.clearcoat *= lvCC;\n#endif');
      sh.fragmentShader = fs;
    };
    return mat;
  };
  const M = {
    /* 도장 금속: 깊은 청색. 유리·검은 면·무광 부분은 같은 곡면 위에서 shader 가 재질을 바꾼다 */
    body: inject(new THREE.MeshPhysicalMaterial({ color: 0x08215c, metalness: 0.78, roughness: 0.27, clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1.5 }), true),
    paint: inject(new THREE.MeshPhysicalMaterial({ color: 0x061a48, metalness: 0.78, roughness: 0.36, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 1.1 })),
    trim: inject(new THREE.MeshStandardMaterial({ color: 0x04060a, metalness: 0.3, roughness: 0.62, envMapIntensity: 0.6 })),
    glass: inject(new THREE.MeshPhysicalMaterial({ color: 0x010204, metalness: 0.0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.9, reflectivity: 0.7 })),
    rubber: inject(new THREE.MeshStandardMaterial({ color: 0x060607, metalness: 0.0, roughness: 0.9, envMapIntensity: 0.28, side: THREE.DoubleSide })),
    rim: inject(new THREE.MeshStandardMaterial({ color: 0x6f7988, metalness: 0.95, roughness: 0.3, envMapIntensity: 1.25, side: THREE.DoubleSide })),
    hub: inject(new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: 0.9, roughness: 0.45, envMapIntensity: 0.9 })),
    dark: inject(new THREE.MeshStandardMaterial({ color: 0x010102, metalness: 0.0, roughness: 0.95, envMapIntensity: 0.05 })),
    well: inject(new THREE.MeshStandardMaterial({ color: 0x010102, metalness: 0.0, roughness: 0.95, envMapIntensity: 0.04, side: THREE.DoubleSide })),
    chrome: inject(new THREE.MeshStandardMaterial({ color: 0x8a94a6, metalness: 1, roughness: 0.16, envMapIntensity: 1.5 })),
    cyan: new THREE.MeshBasicMaterial({ color: 0x1f9bd8 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    drl: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    tail: new THREE.MeshBasicMaterial({ color: 0x1c0204 }),
    amber: new THREE.MeshBasicMaterial({ color: 0x4a2203 }),
    reverse: new THREE.MeshBasicMaterial({ color: 0x1b2026 }),
  };
  uni.uAccent.value = M.cyan.color; uni.uDrl.value = M.drl.color; uni.uTail.value = M.tail.color;   // 밝기는 main.js 가 재질의 색으로 조절한다
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  add(bodyGeometry(THREE), M.body);

  /* 앞·뒷면 위의 점과 바깥 방향 */
  const onEnd = (fx, dirX) => (z, y, off = 0) => {
    const e = 0.01, x = fx(y, z), n = V(dirX, -dirX * (fx(y + e, z) - fx(y - e, z)) / (2 * e), -dirX * (fx(y, z + e) - fx(y, z - e)) / (2 * e)).normalize();
    return { p: V(x, y, z).addScaledVector(n, off), n };
  };
  const onFront = onEnd(frontX, 1), onRear = onEnd(rearX, -1);
  const zAxis = V(0, 0, 1);
  const disc = (at, r, mat, ring = 0) => {                                                 // 곡면에 붙는 둥근 등: 렌즈와 금속 테
    const m = add(new THREE.CircleGeometry(r, 28), mat, at.p.x, at.p.y, at.p.z); m.quaternion.setFromUnitVectors(zAxis, at.n);
    if (ring) { const t = add(new THREE.TorusGeometry(r + ring * 0.6, ring, 8, 28), M.chrome, at.p.x, at.p.y, at.p.z); t.quaternion.copy(m.quaternion); }
    return m;
  };
  /* 곡면 위에 얹는 조각: fn(u, v) → [x, y, z] */
  const patch = (fn, u0, u1, v0, v1, mat, nu = 18, nv = 4) => {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { pos.push(...fn(u0 + ((u1 - u0) * i) / nu, v0 + ((v1 - v0) * j) / nv)); uv.push(i / nu, j / nv); }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + nu + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return add(g, mat);
  };
  const tube = (pts, r, mat, n = 16) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, r, 8), mat);
  const rr = (w, h, r) => { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
  const slab = (w, h, d, r, mat, bevel = 0.02) => new THREE.Mesh(new THREE.ExtrudeGeometry(rr(w, h, r), { depth: d, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3 }), mat);

  /* ── 앞면: 행선지 표시(유리 위쪽의 검은 띠 안), 전조등, 와이퍼 ── */
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 128;
  const sg = sc.getContext('2d'); sg.fillStyle = '#01030a'; sg.fillRect(0, 0, 512, 128); sg.fillStyle = '#bfeaff'; sg.font = '700 64px Arial, sans-serif'; sg.textBaseline = 'middle'; sg.fillText('01', 22, 68); sg.textAlign = 'right'; sg.fillText('LIVEBUS', 492, 68);
  const signTex = new THREE.CanvasTexture(sc); signTex.encoding = THREE.sRGBEncoding; signTex.anisotropy = 8;
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, color: 0x000000 });
  patch((z, y) => onFront(-z, y, 0.006).p.toArray(), -0.92, 0.92, 2.6, 2.9, signMat, 16, 3);

  /* 전조등 렌즈: 가운데가 가장 밝고 둘레로 갈수록 식는 빛. 둘레에는 옅은 빛무리를 둔다 */
  const lc = document.createElement('canvas'); lc.width = lc.height = 128; const lcg = lc.getContext('2d');
  const lgr = lcg.createRadialGradient(64, 64, 0, 64, 64, 64); lgr.addColorStop(0, '#ffffff'); lgr.addColorStop(0.22, '#f2f8ff'); lgr.addColorStop(0.5, '#9cc4f2'); lgr.addColorStop(0.8, '#38639e'); lgr.addColorStop(1, '#0c1830');
  lcg.fillStyle = lgr; lcg.fillRect(0, 0, 128, 128); lcg.strokeStyle = 'rgba(8,16,32,0.5)'; lcg.lineWidth = 2; for (const r of [26, 44]) { lcg.beginPath(); lcg.arc(64, 64, r, 0, 7); lcg.stroke(); }
  M.lamp.map = new THREE.CanvasTexture(lc); M.lamp.map.encoding = THREE.sRGBEncoding;
  const hc = document.createElement('canvas'); hc.width = hc.height = 128; const hcg = hc.getContext('2d');
  const hgr = hcg.createRadialGradient(64, 64, 0, 64, 64, 64); hgr.addColorStop(0, 'rgba(190,225,255,0.85)'); hgr.addColorStop(0.25, 'rgba(110,170,255,0.3)'); hgr.addColorStop(0.6, 'rgba(60,120,230,0.08)'); hgr.addColorStop(1, 'rgba(0,0,0,0)');
  hcg.fillStyle = hgr; hcg.fillRect(0, 0, 128, 128);
  const halo = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(hc), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const s of [1, -1]) {
    disc(onFront(s * 0.76, 0.655, 0.004), 0.066, M.lamp, 0.008);                            // 하향등
    disc(onFront(s * 0.955, 0.665, 0.004), 0.058, M.lamp, 0.007);                           // 상향등
    disc(onFront(s * 1.1, 0.68, 0.004), 0.03, M.amber, 0.005);                              // 방향지시등
    const gl = new THREE.Sprite(halo); gl.position.copy(onFront(s * 0.85, 0.66, 0.07).p); gl.scale.set(1.0, 0.62, 1); group.add(gl);
  }
  /* 와이퍼 두 개: 유리 아래쪽에 누워 있다(팔과 고무날) */
  for (const [zp, ze] of [[0.56, 0.12], [-0.3, -0.74]]) {
    tube([onFront(zp, 1.2, 0.02).p, onFront((zp + ze) / 2, 1.27, 0.04).p, onFront(ze, 1.35, 0.03).p], 0.011, M.trim, 10);
    const pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push(onFront(ze + 0.38 - 0.76 * t, 1.27 + 0.16 * t, 0.014).p); }
    tube(pts, 0.008, M.rubber, 14);
    add(new THREE.CylinderGeometry(0.022, 0.026, 0.03, 12), M.trim, ...onFront(zp, 1.2, 0.012).p.toArray()).rotation.z = Math.PI / 2;
  }

  /* ── 뒷면: 세로로 놓인 둥근 등(방향지시 · 제동 · 후진) ── */
  for (const s of [1, -1]) {
    disc(onRear(s * 1.05, 1.14, 0.004), 0.066, M.amber, 0.007);
    disc(onRear(s * 1.05, 0.95, 0.004), 0.07, M.tail, 0.007);
    disc(onRear(s * 1.05, 0.76, 0.004), 0.066, M.tail, 0.007);
    disc(onRear(s * 1.05, 0.57, 0.004), 0.05, M.reverse, 0.006);
  }

  /* ── 사이드미러: 지붕 앞 모서리에서 앞으로 뻗은 팔에 세로로 긴 거울이 매달린다 ── */
  for (const s of [1, -1]) {
    tube([V(4.98, 2.86, s * 1.14), V(5.34, 3.0, s * 1.34), V(5.56, 2.92, s * 1.47), V(5.6, 2.66, s * 1.5)], 0.021, M.trim, 18);
    const head = new THREE.Group(); head.position.set(5.6, 2.36, s * 1.5); head.rotation.y = Math.PI / 2 - s * 0.22; group.add(head);
    const shell = slab(0.2, 0.44, 0.07, 0.07, M.trim, 0.022); shell.position.z = -0.035; head.add(shell);
    const mg = add(new THREE.ShapeGeometry(rr(0.17, 0.4, 0.06), 8), M.chrome, 0, 0, -0.059, head); mg.rotation.y = Math.PI;      // 뒤를 향한 거울면
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 10), M.trim, 0, 0.26, 0, head);
  }

  /* ── 지붕 설비: 낮은 덮개, 환기구 두 개, 냉방 장치 ── */
  const pod = slab(7.9, 1.62, 0.03, 0.42, M.paint, 0.045); pod.rotation.x = -Math.PI / 2; pod.position.set(-0.75, YT - 0.035, 0); group.add(pod);
  for (const x of [1.7, -1.3]) { const h = slab(0.72, 0.62, 0.025, 0.08, M.trim, 0.012); h.rotation.x = -Math.PI / 2; h.position.set(x, YT + 0.045, 0); group.add(h); }
  const ac = slab(2.0, 1.5, 0.06, 0.16, M.trim, 0.03); ac.rotation.x = -Math.PI / 2; ac.position.set(-3.3, YT + 0.045, 0); group.add(ac);
  for (let k = 0; k < 7; k++) add(new THREE.BoxGeometry(0.035, 0.012, 1.16), M.dark, -4.05 + k * 0.25, YT + 0.142, 0);
  /* 지붕 앞쪽의 작은 안테나(위치 신호가 나가는 자리). 끝에만 시안색 점이 있다 */
  const fin = new THREE.Shape(); fin.moveTo(-0.17, 0); fin.lineTo(0.13, 0); fin.quadraticCurveTo(0.05, 0.13, -0.11, 0.15); fin.quadraticCurveTo(-0.16, 0.14, -0.17, 0);
  const finMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(fin, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 }), M.trim);
  finMesh.position.set(SIGNAL.x + 0.1, SIGNAL.y - 0.165, SIGNAL.z - 0.025); group.add(finMesh);
  add(new THREE.SphereGeometry(0.016, 10, 8), M.cyan, SIGNAL.x, SIGNAL.y - 0.012, SIGNAL.z);

  /* ── 바퀴집: 뚫린 자리 안쪽의 어두운 통(깊이 0.7m), 둘레의 테, 안쪽의 축 ── */
  for (const ax of BUS.axles) for (const s of [1, -1]) {
    const zOut = sideZ(R + 0.3), len = zOut - 0.5;
    const liner = add(new THREE.CylinderGeometry(ARCH + 0.012, ARCH + 0.012, len, 36, 1, true, 1.36, 3.563), M.well, ax, R, s * (0.5 + len / 2)); liner.rotation.x = Math.PI / 2;
    const cap = add(new THREE.CircleGeometry(ARCH + 0.012, 36, -0.21, Math.PI + 0.42), M.well, ax, R, s * 0.5); if (s < 0) cap.rotation.y = Math.PI;
    const lip = []; for (let k = 0; k <= 28; k++) { const a = -0.2 + ((Math.PI + 0.4) * k) / 28, y = R + (ARCH + 0.004) * Math.sin(a); lip.push(V(ax + (ARCH + 0.004) * Math.cos(a), y, s * (sideZ(y) + 0.003))); }
    tube(lip, 0.02, M.trim, 56);
    const axle = add(new THREE.CylinderGeometry(0.075, 0.075, 0.5, 12), M.hub, ax, R, s * 0.68); axle.rotation.x = Math.PI / 2;
  }

  /* ── 바퀴: 차체와 따로 도는 네 묶음. 두꺼운 타이어, 림, 허브, 너트, 통풍구. 뒤는 복륜(안쪽 타이어가 하나 더 있다) ── */
  const tirePts = [[0.286, -0.122], [0.302, -0.14], [0.36, -0.151], [0.42, -0.149], [0.456, -0.136], [0.474, -0.108], [0.48, -0.07], [0.48, 0.07], [0.474, 0.108], [0.456, 0.136], [0.42, 0.149], [0.36, 0.151], [0.302, 0.14], [0.286, 0.122]].map(([r, z]) => new THREE.Vector2(r, z));
  const tireGeo = new THREE.LatheGeometry(tirePts, 56); tireGeo.rotateX(Math.PI / 2);
  const rimProfile = {
    front: [[0.288, 0.112], [0.297, 0.126], [0.287, 0.136], [0.273, 0.118], [0.262, 0.088], [0.25, 0.066], [0.13, 0.066], [0.116, 0.078], [0.106, 0.128], [0.086, 0.15], [0, 0.156]],   // 볼록한 허브
    rear: [[0.288, 0.112], [0.297, 0.126], [0.287, 0.136], [0.273, 0.112], [0.258, 0.03], [0.242, -0.033], [0.135, -0.033], [0.124, -0.02], [0.118, 0.066], [0.1, 0.09], [0, 0.096]],     // 깊게 들어간 접시
  };
  const wheels = [];
  BUS.axles.forEach((ax, ai) => {
    for (const s of [1, -1]) {
      const wgrp = new THREE.Group(); wgrp.position.set(ax, R, s * TRACK); group.add(wgrp);
      const rear = ai === 1, zDisc = rear ? -0.033 : 0.066;
      for (const zo of rear ? [0, -0.33] : [0]) {
        const t = new THREE.Mesh(tireGeo, M.rubber); t.position.z = s * zo; wgrp.add(t);
        for (const zz of [-0.078, -0.027, 0.027, 0.078]) add(new THREE.TorusGeometry(0.4806, 0.0065, 6, 56), M.dark, 0, 0, s * zo + zz, wgrp);   // 트레드 홈
      }
      add(new THREE.TorusGeometry(0.405, 0.004, 6, 56), M.rubber, 0, 0, s * 0.1515, wgrp);                                                     // 옆면의 돋은 띠
      const rimGeo = new THREE.LatheGeometry(rimProfile[rear ? 'rear' : 'front'].map(([r, z]) => new THREE.Vector2(r, z)), 48); rimGeo.rotateX((s * Math.PI) / 2);
      wgrp.add(new THREE.Mesh(rimGeo, M.rim));
      const drum = add(new THREE.CylinderGeometry(0.245, 0.245, 0.16, 28), M.hub, 0, 0, s * (zDisc - 0.1), wgrp); drum.rotation.x = Math.PI / 2;  // 휠 안쪽의 드럼
      for (let k = 0; k < 10; k++) { const an = (k / 10) * Math.PI * 2; const b = add(new THREE.CylinderGeometry(0.012, 0.014, 0.03, 6), M.chrome, Math.cos(an) * 0.168, Math.sin(an) * 0.168, s * (zDisc + 0.018), wgrp); b.rotation.x = Math.PI / 2; }
      for (let k = 0; k < 8; k++) { const an = (k / 8) * Math.PI * 2 + 0.2; const h = add(new THREE.CircleGeometry(0.027, 14), M.dark, Math.cos(an) * 0.218, Math.sin(an) * 0.218, s * (zDisc + 0.004), wgrp); h.rotation.y = s === 1 ? 0 : Math.PI; }
      wheels.push(wgrp);
    }
  });

  const lamps = { head: M.lamp, drl: M.drl, sign: signMat, tail: M.tail, cyan: M.cyan, halo };
  const camL = uni.uCamL.value;
  return {
    group, wheels, lamps, materials: M,
    /** 유리 안쪽의 실내가 시선을 따라 어긋나 보이도록, 프레임마다 카메라의 위치를 차체 기준으로 알려 준다 */
    update(camera) { camL.copy(camera.position); group.worldToLocal(camL); },
  };
}
