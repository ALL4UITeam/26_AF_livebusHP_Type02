/**
 * LIVE FIELD — 입자의 목표 형태.
 *
 * 입자마다 두 개의 자리를 가진다.
 *   A : 비대칭 리본과 곡면으로 이루어진 조형물(첫 화면)
 *   B : 버스(스크롤 중간의 절정)
 * 입자는 무작위로 뿌리지 않는다. 모두 어떤 리본의 '선' 위에 있고(u = 선을 따라간 위치),
 * 같은 선의 이웃은 버스에서도 이웃이라 변형 중에 흩어지지 않는다.
 *
 * P = [u, 선의 위상, 등장 순서(0~1), kind]
 * kind : 0 면을 이루는 결(선), 1 가장자리, 2 안쪽 구조(A 에서는 리본 속 심선, B 에서는 윤곽선), 3 미세 입자
 */

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (a, b = 0, c = 0) => {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

/* ── 리본: 공간 곡선 + 폭 + 비틀림 + 단면의 휨 ───────────────────────── */
function makeRibbon(ctrl, { width, twist, curl, up = [0, 1, 0] }) {
  const M = 520;
  const C = new Float32Array((M + 1) * 3), N = new Float32Array((M + 1) * 3), B = new Float32Array((M + 1) * 3);
  const n = ctrl.length;
  const get = (i) => ctrl[clamp(i, 0, n - 1)];
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i <= M; i++) {
    const f = (i / M) * (n - 1), k = Math.min(n - 2, Math.floor(f)), t = f - k;
    for (let a = 0; a < 3; a++) C[i * 3 + a] = cr(get(k - 1)[a], get(k)[a], get(k + 1)[a], get(k + 2)[a], t);
  }
  /* 뒤집힘 없는 틀: 앞 지점의 법선을 다음 접선에 수직이 되도록 옮겨 간다 */
  let nx = up[0], ny = up[1], nz = up[2];
  for (let i = 0; i <= M; i++) {
    const a = Math.max(0, i - 1), b = Math.min(M, i + 1);
    let tx = C[b * 3] - C[a * 3], ty = C[b * 3 + 1] - C[a * 3 + 1], tz = C[b * 3 + 2] - C[a * 3 + 2];
    const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    const d = nx * tx + ny * ty + nz * tz;
    nx -= d * tx; ny -= d * ty; nz -= d * tz;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    N[i * 3] = nx; N[i * 3 + 1] = ny; N[i * 3 + 2] = nz;
    B[i * 3] = ty * nz - tz * ny; B[i * 3 + 1] = tz * nx - tx * nz; B[i * 3 + 2] = tx * ny - ty * nx;
  }
  /** u: 길이 방향 0~1, v: 폭 방향 -1~1, lift: 면에서 뜬 정도, side: 중심에서 옆으로 */
  const at = (u, v, lift = 0, side = 0) => {
    const f = clamp(u, 0, 1) * M, i = Math.min(M - 1, Math.floor(f)), t = f - i, j = i + 1;
    const th = twist(u), w = width(u), cs = Math.cos(th), sn = Math.sin(th);
    const off = v * w + side, bulge = curl(u) * w * (1 - v * v) + lift;
    const out = [0, 0, 0];
    for (let a = 0; a < 3; a++) {
      const c = lerp(C[i * 3 + a], C[j * 3 + a], t), nn = lerp(N[i * 3 + a], N[j * 3 + a], t), bb = lerp(B[i * 3 + a], B[j * 3 + a], t);
      out[a] = c + (nn * cs + bb * sn) * off + (-nn * sn + bb * cs) * bulge;
    }
    return out;
  };
  return { at };
}

/* 조형물 A
   주 리본은 오른쪽 위 먼 곳에서 가늘게 시작해 왼쪽에서 크게 접히고, 가운데를 가로질러 오른쪽 앞으로 빠져나간다.
   접힌 두 팔 사이로 두 번째 리본이 지나가고, 아래에는 가는 선 다발(도로의 흐름)이 길게 깔린다. 뒤에는 넓고 옅은 곡면. */
const RIBBONS = [
  { // 0 주 리본
    ctrl: [[14.5, 5.6, -13.5], [8.6, 3.4, -7.2], [5.0, 2.35, -3.9], [1.7, 1.7, -1.6], [-1.5, 1.3, 0.0], [-3.55, 0.45, 0.85], [-3.45, -0.75, 0.75], [-1.7, -1.1, 0.0], [0.7, -0.62, -0.45], [2.8, -0.3, 0.2], [4.7, -0.8, 1.7], [7.4, -2.0, 4.2], [10.8, -3.6, 7.4]],
    width: (u) => 0.08 + 0.7 * Math.sin(Math.PI * clamp((u - 0.1) / 0.8, 0, 1)) ** 0.85,
    twist: (u) => 0.35 + 5.6 * u,
    curl: () => 0.45,
    lines: 64, per: 720,
  },
  { // 1 두 팔 사이를 지나는 리본
    ctrl: [[-13.5, -4.2, -7.5], [-8.4, -3.0, -4.6], [-5.0, -2.25, -2.9], [-2.2, -0.75, -1.7], [0.2, 0.3, -1.0], [2.3, 0.9, -0.3], [4.3, 0.95, 0.8], [7.4, 0.35, 2.8], [11.5, -0.6, 5.4]],
    width: (u) => 0.1 + 0.42 * Math.sin(Math.PI * clamp((u - 0.1) / 0.8, 0, 1)),
    twist: (u) => 1.3 - 3.3 * u,
    curl: () => -0.4,
    lines: 30, per: 760,
  },
  { // 2 가는 선 다발
    ctrl: [[-13, 2.2, 4.4], [-8.2, 0.3, 2.4], [-5.2, -1.15, 1.5], [-2.3, -1.85, 0.5], [0.8, -1.5, -0.1], [3.5, -1.05, -0.8], [6.2, -0.1, -2.6], [9.6, 1.5, -5.6], [15, 4.2, -11]],
    width: (u) => 0.045 + 0.085 * Math.sin(Math.PI * u),
    twist: (u) => 7.5 * u,
    curl: () => 0,
    lines: 8, per: 1500,
  },
  { // 3 뒤쪽의 넓은 곡면
    ctrl: [[-5.6, 2.9, -4.2], [-3.4, 1.2, -3.0], [-1.0, 0.0, -2.8], [1.6, -0.25, -3.2], [4.0, 0.7, -4.2], [6.2, 2.3, -5.6]],
    width: (u) => 0.5 + 0.9 * Math.sin(Math.PI * clamp(u * 0.92 + 0.05, 0, 1)),
    twist: (u) => 0.4 + 1.0 * u,
    curl: () => 0.7,
    lines: 40, per: 520,
  },
];

/* 조형물을 화면 안에 놓는 크기와 위치(둘레에 검은 여백이 남도록) */
const SCALE_A = 0.64, OFFSET_A = [0.3, 0.04];

/* ── 버스(B) ─────────────────────────────────────────────────────────
   버스 좌표: x 길이(앞이 +), y 높이(바닥 0), z 폭(보이는 옆면이 +) */
const L2 = 2.7, Y0 = 0.3, Y1 = 1.98, W2 = 0.65;
const WHEEL_R = 0.37, ARCH_R = 0.46, WHEEL_Y = 0.37;
const WHEELS = [-1.62, 1.12];
const WINDOWS = [ // [x0, x1, y0, y1, 문 여부]
  [-2.46, -1.84, 1.04, 1.7, 0], [-1.76, -1.02, 1.04, 1.7, 0], [-0.94, -0.42, 1.04, 1.7, 0],
  [-0.34, 0.26, 0.42, 1.7, 1],
  [0.34, 1.0, 1.04, 1.7, 0], [1.08, 1.56, 1.04, 1.7, 0],
  [1.66, 2.16, 0.42, 1.7, 1],
  [2.24, 2.5, 1.04, 1.7, 0],
];
const FRONT_HOLES = [ // 앞면: [z0, z1, y0, y1]
  [-0.55, 0.55, 1.02, 1.8], [-0.42, 0.42, 1.845, 1.93], [0.3, 0.56, 0.5, 0.64], [-0.56, -0.3, 0.5, 0.64],
];

const cornerInset = (y) => {
  let inset = 0;
  const rt = 0.17, rb = 0.08;
  if (y > Y1 - rt) inset = rt - Math.sqrt(Math.max(0, rt * rt - (y - (Y1 - rt)) ** 2));
  else if (y < Y0 + rb) inset = rb - Math.sqrt(Math.max(0, rb * rb - (Y0 + rb - y) ** 2));
  return inset;
};
const xFront = (y) => L2 - cornerInset(y) - (y > 1.0 ? 0.11 * ((y - 1.0) / 0.98) ** 1.5 : 0);
const xRear = (y) => -L2 + cornerInset(y);

/** 창·문 안쪽에 떨어진 입자는 틀로 보내고(안은 어둡게 비운다), 바퀴 자리의 입자는 바퀴의 고리로 보낸다 */
function carveSide(x, y, h) {
  for (const [x0, x1, y0, y1, door] of WINDOWS) {
    if (x > x0 && x < x1 && y > y0 && y < y1) {
      if (door && h < 0.13) return [(x0 + x1) / 2, y, 0.5];
      const inset = h > 0.62 ? 0.034 : 0;
      const dl = x - x0, dr = x1 - x, db = y - y0, dt = y1 - y, m = Math.min(dl, dr, db, dt);
      if (m === dl) return [x0 + inset, clamp(y, y0 + inset, y1 - inset), 0.4];
      if (m === dr) return [x1 - inset, clamp(y, y0 + inset, y1 - inset), 0.4];
      if (m === db) return [clamp(x, x0 + inset, x1 - inset), y0 + inset, 0.4];
      return [clamp(x, x0 + inset, x1 - inset), y1 - inset, 0.4];
    }
  }
  for (const cx of WHEELS) {
    const dx = x - cx, dy = y - WHEEL_Y, d = Math.hypot(dx, dy);
    if (d < ARCH_R) {
      const ang = Math.atan2(dy, dx) * 2 - Math.PI / 2; // 위쪽 반원에 있던 입자를 한 바퀴로 편다
      let r, a = ang, b = 0.75;
      if (h < 0.36) r = WHEEL_R;
      else if (h < 0.48) r = WHEEL_R - 0.045;
      else if (h < 0.72) r = 0.22;
      else if (h < 0.8) r = 0.06;
      else { r = lerp(0.06, 0.22, (h - 0.8) / 0.2); a = Math.round((ang / TAU) * 5) * (TAU / 5) + 0.3; b = 0.5; }
      return [cx + Math.cos(a) * r, WHEEL_Y + Math.sin(a) * r, b];
    }
  }
  return [x, y, 0.5];
}

function carveFront(z, y, h) {
  for (const [z0, z1, y0, y1] of FRONT_HOLES) {
    if (z > z0 && z < z1 && y > y0 && y < y1) {
      const inset = h > 0.6 ? 0.03 : 0;
      const dl = z - z0, dr = z1 - z, db = y - y0, dt = y1 - y, m = Math.min(dl, dr, db, dt);
      if (m === dl) return [z0 + inset, y, 0.45];
      if (m === dr) return [z1 - inset, y, 0.45];
      if (m === db) return [z, y0 + inset, 0.45];
      return [z, y1 - inset, 0.45];
    }
  }
  return [z, y, 0.5];
}

/* 버스를 세워 놓는 자세: 앞이 오른쪽·앞쪽으로 살짝 돌아 부피가 보인다 */
const YAW = -0.5, PITCH = 0.085;
const cyw = Math.cos(YAW), syw = Math.sin(YAW), cpt = Math.cos(PITCH), spt = Math.sin(PITCH);
function busWorld(x, y, z) {
  y -= 1.02; x -= 0.05;
  const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
  const y2 = y * cpt - z1 * spt, z2 = y * spt + z1 * cpt;
  return [x1 * 0.92, y2 * 0.92 - 0.02, z2 * 0.92];
}

function sidePanel(s, t, z, h, gain) {
  const y = lerp(Y0 + 0.012, Y1 - 0.012, t);
  const x = lerp(xRear(y) + 0.012, xFront(y) - 0.012, s);
  const [cx, cy, b] = carveSide(x, y, h);
  return { p: busWorld(cx, cy, z), b: b * gain };
}

/** 리본의 결이 버스의 어느 면이 되는지 */
function busSurface(r, u, t, h) {
  if (r === 0) return sidePanel(u, t, W2, h, 1);
  if (r === 1) return sidePanel(u, t, -W2, h, 0.34);
  if (r === 2) { // 지붕의 결
    const z = lerp(-W2 + 0.09, W2 - 0.09, t);
    return { p: busWorld(lerp(xRear(Y1) + 0.05, xFront(Y1) - 0.03, u), Y1, z), b: 0.26 };
  }
  // 3: 앞면, 뒷면, 그리고 바퀴 아래로 길게 뻗는 도로의 결
  if (t < 0.36) {
    const y = lerp(Y0 + 0.02, Y1 - 0.02, t / 0.36);
    const [z, cy, b] = carveFront(lerp(W2, -W2, u), y, h);
    return { p: busWorld(xFront(cy) + 0.035 * Math.cos((z / W2) * 1.5), cy, z), b: b * 1.1 };
  }
  if (t < 0.52) {
    const y = lerp(Y0 + 0.02, Y1 - 0.02, (t - 0.36) / 0.16);
    return { p: busWorld(xRear(y), y, lerp(W2, -W2, u)), b: 0.2 };
  }
  const k = (t - 0.52) / 0.48;
  return { p: busWorld(lerp(-11.5, 11.5, u), 0, lerp(-2.3, 2.9, k)), b: 0.2 + 0.2 * (1 - Math.abs(k - 0.45)) };
}

/* 버스의 윤곽선들(안쪽 구조 입자가 이 선 위에 놓인다) */
function busPaths() {
  const paths = [];
  const add = (pts, weight, bright) => {
    let len = 0;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) { len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); cum.push(len); }
    if (len > 0) paths.push({ pts, cum, len, share: len * weight, bright });
  };
  const arc = (cx, cy, r, a0, a1, z, nSeg = 48) => Array.from({ length: nSeg + 1 }, (_, i) => { const a = lerp(a0, a1, i / nSeg); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]; });
  const rect = (x0, x1, y0, y1, z) => [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [x0, y0, z]];
  const rectZ = (z0, z1, y0, y1, dx = 0.012) => [[z0, y0], [z1, y0], [z1, y1], [z0, y1], [z0, y0]].map(([z, y]) => [xFront(y) + dx, y, z]);

  const silhouette = (z) => {
    const pts = [];
    const a = Math.asin((WHEEL_Y - Y0) / ARCH_R); // 바닥선과 바퀴집이 만나는 각
    pts.push([xRear(Y0), Y0, z]);
    for (const cx of WHEELS) pts.push(...arc(cx, WHEEL_Y, ARCH_R, Math.PI + a, -a, z, 40));
    pts.push([xFront(Y0), Y0, z]);
    for (let i = 0; i <= 60; i++) { const y = lerp(Y0, Y1, i / 60); pts.push([xFront(y), y, z]); }
    for (let i = 60; i >= 0; i--) { const y = lerp(Y0, Y1, i / 60); pts.push([xRear(y), y, z]); }
    return pts;
  };
  add(silhouette(W2), 2.4, 1);
  add(silhouette(-W2), 0.8, 0.36);

  for (const [x0, x1, y0, y1, door] of WINDOWS) {
    add(rect(x0, x1, y0, y1, W2), 1.5, 0.95);
    add(rect(x0, x1, y0, y1, -W2), 0.35, 0.28);
    if (door) add([[(x0 + x1) / 2, y0, W2], [(x0 + x1) / 2, y1, W2]], 1.2, 0.8);
  }
  for (const cx of WHEELS) {
    add(arc(cx, WHEEL_Y, WHEEL_R, 0, TAU, W2, 72), 2.2, 1);
    add(arc(cx, WHEEL_Y, WHEEL_R - 0.05, 0, TAU, W2, 72), 1, 0.6);
    add(arc(cx, WHEEL_Y, 0.22, 0, TAU, W2, 56), 1.6, 0.9);
    add(arc(cx, WHEEL_Y, 0.06, 0, TAU, W2, 24), 2, 0.9);
    for (let k = 0; k < 5; k++) { const an = (k / 5) * TAU + 0.3; add([[cx + Math.cos(an) * 0.06, WHEEL_Y + Math.sin(an) * 0.06, W2], [cx + Math.cos(an) * 0.22, WHEEL_Y + Math.sin(an) * 0.22, W2]], 1.2, 0.7); }
    add(arc(cx, WHEEL_Y, WHEEL_R, 0, TAU, -W2, 72), 0.6, 0.3);
    add(arc(cx, WHEEL_Y, 0.22, 0, TAU, -W2, 48), 0.4, 0.26);
  }
  /* 허리선과 아랫단 */
  const belt = (y, cuts) => { let x = xRear(y); for (const [c0, c1] of cuts) { add([[x, y, W2], [c0, y, W2]], 0.9, 0.7); x = c1; } add([[x, y, W2], [xFront(y), y, W2]], 0.9, 0.7); };
  belt(0.97, [[-0.34, 0.26], [1.66, 2.16]]);
  belt(0.56, [[-2.04, -1.2], [-0.34, 0.26], [0.7, 1.54], [1.66, 2.16]]);
  /* 앞면 */
  add([[xFront(Y1), Y1, W2], [xFront(Y1), Y1, -W2]], 1.2, 0.9);
  add([[xFront(Y0), Y0, W2], [xFront(Y0), Y0, -W2]], 1.2, 0.8);
  add([[xRear(Y1), Y1, W2], [xRear(Y1), Y1, -W2]], 0.8, 0.5);
  add([[xRear(Y0), Y0, W2], [xRear(Y0), Y0, -W2]], 0.6, 0.35);
  for (const [z0, z1, y0, y1] of FRONT_HOLES) add(rectZ(z0, z1, y0, y1), 1.7, 1);
  add([[xFront(0.42) + 0.012, 0.42, W2], [xFront(0.42) + 0.012, 0.42, -W2]], 1.1, 0.75);
  add(rectZ(-0.2, 0.2, 0.34, 0.4), 1, 0.6);
  /* 거울 */
  add([[2.52, 1.74, W2], [2.52, 1.74, W2 + 0.07], [2.52, 1.74, W2 + 0.2], [2.52, 1.46, W2 + 0.2], [2.52, 1.46, W2 + 0.07], [2.52, 1.74, W2 + 0.07]], 1.4, 0.85);
  /* 지붕 위 설비 */
  const top = Y1 + 0.07;
  add([[-1.3, top, -0.4], [0.3, top, -0.4], [0.3, top, 0.4], [-1.3, top, 0.4], [-1.3, top, -0.4]], 0.7, 0.6);
  for (const [x, z] of [[-1.3, 0.4], [0.3, 0.4], [0.3, -0.4], [-1.3, -0.4]]) add([[x, Y1, z], [x, top, z]], 0.7, 0.5);

  const total = paths.reduce((s, p) => s + p.share, 0);
  let acc = 0;
  for (const p of paths) { p.g0 = acc / total; acc += p.share; p.g1 = acc / total; }
  /** g: 0~1 → 윤곽선 위의 점 */
  return (g) => {
    let lo = 0, hi = paths.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (paths[mid].g1 <= g) lo = mid + 1; else hi = mid; }
    const p = paths[lo], target = clamp((g - p.g0) / (p.g1 - p.g0), 0, 1) * p.len;
    let i = 1;
    while (i < p.cum.length - 1 && p.cum[i] < target) i++;
    const t = (target - p.cum[i - 1]) / (p.cum[i] - p.cum[i - 1] || 1), a = p.pts[i - 1], b = p.pts[i];
    return { p: busWorld(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)), b: p.bright };
  };
}

/**
 * @param {number} total 입자 수(대략)
 * @returns {{ count:number, A:Float32Array, B:Float32Array, P:Float32Array, Br:Float32Array, signal:(u:number)=>number[] }}
 */
export function buildParticles(total = 150000) {
  const q = total / 150000;
  const A = [], Bp = [], P = [], Br = [];
  const push = (a, b, u, phase, rnd, kind, brA, brB) => {
    A.push(a[0] * SCALE_A + OFFSET_A[0], a[1] * SCALE_A + OFFSET_A[1], a[2] * SCALE_A); Bp.push(b[0], b[1], b[2]); P.push(u, phase, rnd, kind); Br.push(brA, brB);
  };
  const ribbons = RIBBONS.map((r) => ({ ...r, at: makeRibbon(r.ctrl, r).at }));

  /* 결과 가장자리 */
  ribbons.forEach((rib, r) => {
    const K = rib.lines;
    for (let k = 0; k < K; k++) {
      const x = (k / (K - 1)) * 2 - 1;
      const edge = k === 0 || k === K - 1;
      const v = Math.sign(x) * Math.abs(x) ** 0.72; // 가장자리 쪽으로 선이 모인다
      const accent = hash(r, k) > 0.8;
      const brA = edge ? 1 : r === 2 ? 0.85 : r === 3 ? 0.1 + 0.14 * hash(k, r, 3) : accent ? 0.6 : 0.16 + 0.2 * hash(k, r, 1);
      const count = Math.round(rib.per * q * (edge ? 1.35 : 1));
      const phase = hash(r * 7.3, k * 1.7);
      for (let i = 0; i < count; i++) {
        const u = (i + hash(i, k, r)) / count;
        const h = hash(i * 0.731, k * 3.1, r + 5);
        const b = busSurface(r, u, k / (K - 1), h);
        push(rib.at(u, v), b.p, u, phase, h, edge ? 1 : 0, brA, b.b);
      }
    }
  });

  /* 면을 채우는 미세 입자 */
  const dust = Math.round(17000 * q);
  for (let i = 0; i < dust; i++) {
    const r = [0, 0, 1, 3][i % 4], rib = ribbons[r];
    const u = hash(i, 11), v = hash(i, 23) * 2 - 1, h = hash(i, 37);
    const a = rib.at(u, v, (hash(i, 41) - 0.5) * 0.05);
    let b;
    if (i % 2) b = { p: busWorld(lerp(-10, 10, hash(i, 53)), 0, lerp(-2.4, 3, hash(i, 59))), b: 0.2 };
    else { b = sidePanel(u, hash(i, 61), W2, h, 0.5); }
    push(a, b.p, u, hash(i, 67), h, 3, r === 3 ? 0.14 : 0.24, b.b);
  }

  /* 안쪽 구조: 리본 속을 지나는 심선과 마디(정류장처럼 보이는 작은 고리). 버스에서는 윤곽선이 된다 */
  const pathAt = busPaths();
  const inner = [];
  for (const r of [0, 1]) {
    const rib = ribbons[r], J = 6;
    for (let j = 0; j < J; j++) {
      const count = Math.round(1700 * q);
      for (let i = 0; i < count; i++) {
        const u = 0.04 + 0.92 * ((i + 0.5) / count);
        const ang = (j / J) * TAU + u * 9, rad = 0.05 + 0.05 * Math.sin(u * 21 + j);
        inner.push({ a: rib.at(u, 0, 0.16 * rib.width(u) + Math.sin(ang) * rad, Math.cos(ang) * rad), u, phase: hash(r, j, 9), br: 0.7 });
      }
    }
    for (let k = 1; k < 11; k++) {
      const u = k / 11, count = Math.round(64 * q) + 8;
      for (let i = 0; i < count; i++) {
        const an = (i / count) * TAU;
        inner.push({ a: rib.at(u, 0, 0.16 * rib.width(u) + Math.sin(an) * 0.085, Math.cos(an) * 0.085), u, phase: hash(r, k, 13), br: 1 });
      }
    }
  }
  inner.forEach((p, i) => {
    const b = pathAt((i + 0.5) / inner.length);
    push(p.a, b.p, p.u, p.phase, hash(i, 71), 2, p.br, b.b);
  });

  /* 등장 순서: 주 리본의 중심선에서 가장 가까운 지점이 신호가 지나가는 때다 */
  const SAMPLES = 96, cl = new Float32Array(SAMPLES * 3);
  for (let i = 0; i < SAMPLES; i++) { const c = ribbons[0].at(i / (SAMPLES - 1), 0); cl.set([c[0] * SCALE_A + OFFSET_A[0], c[1] * SCALE_A + OFFSET_A[1], c[2] * SCALE_A], i * 3); }
  for (let i = 0, n = A.length / 3; i < n; i++) {
    let best = 0, bd = Infinity;
    const x = A[i * 3], y = A[i * 3 + 1], z = A[i * 3 + 2];
    for (let k = 0; k < SAMPLES; k++) { const d = (cl[k * 3] - x) ** 2 + (cl[k * 3 + 1] - y) ** 2 + (cl[k * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = k; } }
    P[i * 4 + 2] = clamp(best / (SAMPLES - 1) + (hash(i, 91) - 0.5) * 0.03 + Math.sqrt(bd) * 0.03, 0, 1);
  }

  /* 그리는 양을 줄여도 고르게 옅어지도록 순서를 섞는다(한 번만) */
  const count = A.length / 3;
  const order = Array.from({ length: count }, (_, i) => i);
  let seed = 20261125;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = count - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const pack = (src, n) => { const out = new Float32Array(count * n); for (let i = 0; i < count; i++) for (let a = 0; a < n; a++) out[i * n + a] = src[order[i] * n + a]; return out; };

  return {
    count,
    A: pack(A, 3), B: pack(Bp, 3), P: pack(P, 4), Br: pack(Br, 2),
    /** 등장 신호가 지나가는 길(주 리본의 중심선) */
    signal: (u) => { const c = ribbons[0].at(u, 0, 0.3 * ribbons[0].width(u)); return [c[0] * SCALE_A + OFFSET_A[0], c[1] * SCALE_A + OFFSET_A[1], c[2] * SCALE_A]; },
  };
}
