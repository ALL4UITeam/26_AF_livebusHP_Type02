/**
 * LIVEBUS B안 — 한 대의 버스와 함께 이어지는 여정 (3차: LIVEBUS → 출발 → BMS → BIT → BIS → 마무리)
 *
 * 스크롤 진행률 하나가 버스 위치, 바퀴 회전, 카메라, 환경, 문구를 모두 정한다.
 * 스크롤을 멈추면 주행도 멈추고, 올리면 그대로 되돌아간다.
 * three.js(r128)는 concept-b.html 의 <script> 로 불러온 전역 THREE 를 쓴다.
 */
import { buildBus, BUS } from './bus.js';
import { buildEnvironment, buildWorld } from './world.js';
import { buildStop } from './stop.js';

const $ = (s) => document.querySelector(s);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const root = document.documentElement;

/* 카메라 구도: 버스를 중심으로 한 방위각(0 = 정면, 90 = 문 쪽 측면, 180 = 뒤), 거리, 높이, 바라보는 점.
   shift 는 문구 자리를 비우기 위해 화면 속 버스를 옆으로 옮기는 비율이다. */
const KEYS = [
  { p: 0.0, az: 37, r: 20, h: 2.3, lx: 0.2, ly: 1.5, lz: 0, fov: 30, shift: 0.15 },
  { p: 0.09, az: 37, r: 20, h: 2.3, lx: 0.2, ly: 1.5, lz: 0, fov: 30, shift: 0.15 },     // 첫 화면: 머무는 구간
  { p: 0.18, az: 46, r: 19, h: 2.0, lx: 1.4, ly: 1.45, lz: 0, fov: 31, shift: 0.1 },     // 출발 준비: 앞쪽 도로가 열린다
  { p: 0.34, az: 86, r: 19, h: 1.9, lx: 0.6, ly: 1.45, lz: 0, fov: 32, shift: 0.02 },    // 측면 주행
  { p: 0.47, az: 106, r: 21, h: 3.0, lx: 1.5, ly: 1.5, lz: 0, fov: 33, shift: 0.0 },
  { p: 0.6, az: 146, r: 27, h: 11.5, lx: 5, ly: 1.2, lz: -1, fov: 34, shift: 0.05 },     // 도시 진입: 뒤로, 위로
  { p: 0.76, az: 160, r: 64, h: 60, lx: 26, ly: 0, lz: -4, fov: 34, shift: 0.15 },       // BMS: 머무는 구간
  { p: 1.0, az: 164, r: 68, h: 64, lx: 30, ly: 0, lz: -4, fov: 34, shift: 0.15 },
  /* 여기부터 3차에 더한 구간. 위의 구도와 진행률은 그대로다 */
  { p: 1.12, az: 150, r: 40, h: 30, lx: 14, ly: 0.5, lz: -1, fov: 34, shift: 0.1 },       // 버스의 위치 신호를 따라 내려간다(건물이 없는 문 쪽 상공으로)
  { p: 1.24, az: 108, r: 22, h: 8, lx: 5, ly: 1.3, lz: 1, fov: 32, shift: 0.06 },
  { p: 1.38, az: 42.6, r: 13.6, h: 2.0, lx: 3.5, ly: 1.95, lz: 1.9, fov: 30, shift: 0.03 }, // BIT: 버스와 안내기가 함께 보이는 구도
  { p: 1.52, az: 42.6, r: 13.6, h: 2.0, lx: 3.5, ly: 1.95, lz: 1.9, fov: 30, shift: 0.03 },
  { p: 1.62, az: 36.6, r: 13.8, h: 2.0, lx: 4.47, ly: 1.95, lz: 1.04, fov: 30, shift: 0.03 }, // BIS: 옆으로 조금 옮기면 전경의 스마트폰이 들어온다
  { p: 1.84, az: 36.6, r: 13.8, h: 2.0, lx: 4.47, ly: 1.95, lz: 1.04, fov: 30, shift: 0.03 },
  { p: 2.0, az: 60, r: 17, h: 2.6, lx: 1.5, ly: 1.5, lz: 0, fov: 31, shift: 0.08 },        // 다시 출발하는 버스를 따라간다
  { p: 2.16, az: 37, r: 20, h: 2.3, lx: 0.2, ly: 1.5, lz: 0, fov: 30, shift: 0.15 },       // 마무리: 처음과 닮은 전면 3/4
  { p: 2.3, az: 37, r: 20, h: 2.3, lx: 0.2, ly: 1.5, lz: 0, fov: 30, shift: 0.15 },
];
export const G = 2.3;                                     // 전체 진행률의 끝. 0~1 은 2차와 똑같은 구간이다
export const STOP = { x: 498.16, z: 3.3, dist: 498.16 };  // 정류장에 선 버스의 위치
/* 구도 사이를 속도가 끊기지 않게 잇는다(머무는 구간에서는 기울기 0) */
const FIELDS = ['az', 'r', 'h', 'lx', 'ly', 'lz', 'fov', 'shift'];
const TAN = Object.fromEntries(FIELDS.map((f) => {
  const d = KEYS.slice(0, -1).map((k, i) => (KEYS[i + 1][f] - k[f]) / (KEYS[i + 1].p - k.p));
  return [f, KEYS.map((_, i) => (i === 0 || i === KEYS.length - 1 || d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i])))];
}));
function cameraAt(p) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
  const a = KEYS[i], b = KEYS[i + 1], h = b.p - a.p, t = clamp((p - a.p) / h, 0, 1), t2 = t * t, t3 = t2 * t, out = {};
  for (const f of FIELDS) out[f] = (2 * t3 - 3 * t2 + 1) * a[f] + (t3 - 2 * t2 + t) * h * TAN[f][i] + (-2 * t3 + 3 * t2) * b[f] + (t3 - t2) * h * TAN[f][i + 1];
  return out;
}
/* 이동 거리(m): 천천히 출발해 일정한 속도로 달린다 */
function distanceAt(p) {
  const t = clamp((p - 0.15) / 0.85, 0, 1), V = 410 / 0.85;
  let d = 410 * (t < 0.25 ? (t * t) / 0.5 : t - 0.125);                                     // 0~1: 2차와 같은 주행(359m)
  if (p > 1) d += V * (Math.min(p, 1.197) - 1);                                             // 같은 속도로 조금 더
  if (p > 1.197) { const T = 0.183, u = Math.min(p - 1.197, T); d += V * (u - (u * u) / (2 * T)); }   // 정류장까지 감속해 1.38 에 정차
  if (p > 1.86) d += 400 * (p - 1.86) ** 2;                                                 // 1.86 부터 다시 출발
  return d;
}
/* 차로: 정류장에 대려고 바깥 차로로 옮겼다가, 출발한 뒤 안쪽 차로로 돌아온다 */
const laneZ = (p) => STOP.z * smooth(1.04, 1.3, p) * (1 - smooth(1.92, 2.14, p));
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/* 문구: 한 번에 하나만. 들어올 때는 글자마다 짧은 시간차, 나갈 때는 전체가 함께 */
function setupCopy() {
  const blocks = [...document.querySelectorAll('.copy')];
  blocks.forEach((el) => {
    let i = 0;
    el.querySelectorAll('[data-split]').forEach((node) => {
      const text = node.textContent; node.textContent = ''; node.setAttribute('aria-label', text);
      for (const word of text.split(' ')) {
        const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
        for (const ch of word) { const s = document.createElement('span'); s.className = 'ch'; s.style.setProperty('--i', i++); s.textContent = ch; w.appendChild(s); }
        node.appendChild(w); node.appendChild(document.createTextNode(' '));
      }
    });
    el.style.setProperty('--n', i);
  });
  const timers = new Map();
  return (p) => {
    for (const el of blocks) {
      const on = p >= +el.dataset.from && p <= +el.dataset.to;
      if (on && !el.classList.contains('is-on')) { clearTimeout(timers.get(el)); el.classList.remove('is-out'); el.classList.add('is-on'); }
      else if (!on && el.classList.contains('is-on')) { el.classList.remove('is-on'); el.classList.add('is-out'); timers.set(el, setTimeout(() => el.classList.remove('is-out'), 300)); }
    }
  };
}

function start() {
  const THREE = window.THREE;
  const canvas = $('#scene'), stage = $('.stage');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 600;
  if (!THREE) throw new Error('three.js 를 불러오지 못했습니다');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000105, 1);
  const scene = new THREE.Scene();
  scene.environment = buildEnvironment(THREE, renderer);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.3, 1800);

  const shared = { sweep: { value: new THREE.Vector4(99, 0, 0, 0) }, cur: { value: new THREE.Vector3(0, -50, 0) }, curAmt: { value: 0 }, lamp: { value: new THREE.Vector3(0, 0, 0) } };
  const bus = buildBus(THREE, shared);
  scene.add(bus.group);
  const world = buildWorld(THREE, scene, { mobile });
  const path = []; for (let g = 0.15; g <= G; g += 0.01) path.push([distanceAt(g), laneZ(g)]);
  const stop = buildStop(THREE, scene, bus.materials, STOP, path);
  const updateCopy = setupCopy();
  /* 흔들림·오프닝을 뺀 순수한 스크롤 구도 */
  const poseAt = (g, narrow) => { const c = cameraAt(g), bx = distanceAt(g), bz = laneZ(g), az = (c.az * Math.PI) / 180, r = c.r * (1 + narrow * 1.15), h = c.h * (1 + narrow * 0.35);
    return { pos: new THREE.Vector3(bx + Math.cos(az) * r, Math.max(0.45, h), bz + Math.sin(az) * r), look: new THREE.Vector3(bx + c.lx, c.ly, bz + c.lz) }; };
  /* 스마트폰은 BIT 구도에서는 화면 오른쪽 밖에 서 있다가, 카메라가 BIS 구도로 옮겨 가면 전경에 들어온다 */
  const placePhone = () => { const narrow = smooth(1.25, 0.6, stage.clientWidth / stage.clientHeight), A = poseAt(1.45, narrow), B = poseAt(1.74, narrow);
    const f = B.look.clone().sub(B.pos).normalize(), right = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
    const pos = B.pos.clone().addScaledVector(f, 1.55).addScaledVector(right, lerp(0.36, 0.0, narrow)); pos.y -= lerp(0.06, 0.1, narrow);   // BIS 구도 기준: 가로 화면은 오른쪽, 세로 화면은 가운데 아래
    stop.placePhone(pos, B.pos, lerp(3.2, 1.7, narrow));
    const fa = A.look.clone().sub(A.pos).normalize(), ra = new THREE.Vector3().crossVectors(fa, new THREE.Vector3(0, 1, 0)), rel = pos.clone().sub(A.pos);
    window.__phoneOutsideBit = Math.abs(rel.dot(ra)) / Math.max(0.01, rel.dot(fa));   // 확인용: BIT 구도에서 스마트폰이 화면 밖인지(값이 클수록 바깥)
  };

  let W = 1, H = 1, dprCap = mobile ? 1.5 : 2, dpr = 1;
  const resize = () => { W = stage.clientWidth; H = stage.clientHeight; dpr = Math.min(window.devicePixelRatio || 1, dprCap); renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); };
  new ResizeObserver(() => { resize(); placePhone(); }).observe(stage); resize(); placePhone();
  document.fonts?.ready.then(() => stop.redraw());

  /* 입력 */
  const ptr = { x: 0, y: 0, sx: 0, sy: 0, px: -100, py: -100, on: false };
  const dot = $('.cursor__dot'), ring = $('.cursor__ring'), ringPos = { x: -100, y: -100 };
  if (fine) root.classList.add('has-cursor');
  window.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1; ptr.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    ptr.px = e.clientX; ptr.py = e.clientY; ptr.on = e.pointerType !== 'touch';
    if (fine) dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
  }, { passive: true });
  root.addEventListener('pointerleave', () => { ptr.on = false; });

  let pTarget = 0, p = 0;
  const onScroll = () => { pTarget = clamp(window.scrollY / (5.8 * window.innerHeight), 0, G); };   // 화면 높이의 5.8배가 진행률 1(2차와 같은 길이)
  const ANCHORS = [0, 1, 1.45, 1.74, G], nearest = (v) => ANCHORS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  p = reduce ? nearest(pTarget) : pTarget;

  const ray = new THREE.Raycaster(), hit = new THREE.Vector3(), boxLocal = new THREE.Box3(new THREE.Vector3(-5.6, 0.2, -1.5), new THREE.Vector3(5.7, 3.3, 1.5)), boxW = new THREE.Box3();
  const railMark = $('.rail__mark'), railItems = [...document.querySelectorAll('.rail li')];
  const look = new THREE.Vector3();
  let last = performance.now(), born = last, time = 0, slow = 0, frames = 0, fade = 1, fadeTarget = 1, cursorAmt = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const sec = reduce ? 99 : (window.__JOURNEY_SEC ?? (now - born) / 1000);   // __JOURNEY_SEC: 오프닝의 한 순간을 멈춰서 확인할 때
    time += reduce ? 0 : dt;
    if (sec > 4 && dprCap > 1 && window.__JOURNEY_LOCK !== true) { slow = dt > 0.026 ? slow + dt : Math.max(0, slow - dt * 0.5); if (slow > 1.2) { dprCap = Math.max(1, dprCap - 0.5); slow = 0; resize(); } }

    /* 진행률: 스크롤 위치를 부드럽게 따라간다. 동작 줄이기에서는 두 구도 사이를 짧은 페이드로 바꾼다 */
    if (reduce) {
      const want = nearest(pTarget);
      if (want !== p) { fadeTarget = 0; if (fade < 0.03) { p = want; fadeTarget = 1; } }
      fade += (fadeTarget - fade) * (1 - Math.exp(-dt * 12)); canvas.style.opacity = fade.toFixed(3);
    } else p += (pTarget - p) * (1 - Math.exp(-dt * 6));

    /* ── 오프닝(시간 기준, 약 2.3초). 스크롤 구도 위에 '덧붙는 변화'라서 도중에 스크롤해도 그대로 이어진다 ──
       0.0 어둠 속 실루엣 → 0.55 전조등 → 0.6~1.6 빛이 앞에서 뒤로 훑는다 → 1.1 파동, 카메라가 가장 빠르게 물러나는 순간 → 2.3 정착 */
    const oCam = 1 - easeIO(clamp((sec - 0.3) / 1.6, 0, 1));
    const oSweep = easeIO(clamp((sec - 0.6) / 1.0, 0, 1));
    const oHead = smooth(0.5, 0.62, sec) * (1 + 0.3 * Math.exp(-(((sec - 0.72) / 0.14) ** 2)));
    const oLit = 1 - smooth(1.55, 1.95, sec);
    const oRipple = sec > 1.1 && sec < 2.3 ? (sec - 1.1) / 1.2 : -1;
    const oBump = Math.exp(-(((sec - 1.55) / 0.5) ** 2));

    const dist = distanceAt(p), busX = dist, busZ = laneZ(p);
    const ddx = distanceAt(p + 0.004) - distanceAt(p - 0.004), ddz = laneZ(p + 0.004) - laneZ(p - 0.004);
    const roadIn = smooth(0.08, 0.2, p);

    /* 버스: 이동 거리만큼만 바퀴가 돈다(미끄러짐 없음) */
    bus.group.position.set(busX, 0, busZ); bus.group.rotation.y = ddx > 0.02 ? -Math.atan2(ddz, ddx) : 0;   // 차로를 옮길 때 차체가 살짝 돈다
    for (const w of bus.wheels) w.rotation.z = -dist / BUS.wheelRadius;
    const headK = oHead * (0.6 + 0.4 * smooth(0.05, 0.16, p));
    bus.lamps.head.color.setRGB(0.9 * headK, 0.97 * headK, headK); bus.lamps.drl.color.setRGB(0.6 * headK, 0.86 * headK, headK);
    bus.lamps.sign.color.setScalar(Math.min(1, oHead)); bus.lamps.cyan.color.setRGB(0.12 * oHead, 0.6 * oHead, 0.85 * oHead);
    bus.lamps.tail.color.setRGB(0.1 + 0.32 * Math.min(1, oHead), 0.012, 0.02);

    /* 카메라 */
    const c = cameraAt(p), aspect = W / H, narrow = smooth(1.25, 0.6, aspect);
    ptr.sx += ((ptr.on ? ptr.x : 0) - ptr.sx) * (1 - Math.exp(-dt * 3)); ptr.sy += ((ptr.on ? ptr.y : 0) - ptr.sy) * (1 - Math.exp(-dt * 3));
    const leave = smooth(1.02, 1.3, p), end = smooth(1.9, 2.16, p);                      // 도시 구도를 떠나는 정도, 마무리로 정리되는 정도
    const far = smooth(0.14, 0.36, p) * (1 - 0.72 * end), net = smooth(0.64, 0.84, p) * (1 - 0.82 * leave) * (1 - end), sig = smooth(0.52, 0.74, p) * (1 - 0.8 * leave) * (1 - end), high = smooth(0.5, 0.74, p) * (1 - leave);
    const par = reduce ? 0 : 1 - 0.6 * high;
    const az = ((c.az - 11 * oCam - ptr.sx * 2.6 * par) * Math.PI) / 180, r = c.r * (1 - 0.36 * oCam) * (1 + narrow * 1.15), h = (c.h - 0.8 * oCam) * (1 + narrow * 0.35) + ptr.sy * 0.45 * par;
    camera.position.set(busX + Math.cos(az) * r, Math.max(0.45, h), busZ + Math.sin(az) * r);
    look.set(busX + c.lx + 0.8 * oCam, c.ly - 0.25 * oCam, busZ + c.lz); camera.lookAt(look);
    camera.fov = c.fov; camera.aspect = aspect;
    if (narrow > 0.5) camera.setViewOffset(W, H, 0, -H * 0.11 * (1 - high * 0.4), W, H);      // 세로 화면: 문구는 위, 버스는 아래
    else camera.setViewOffset(W, H, -W * c.shift * (1 - 0.55 * oCam), 0, W, H);               // 가로 화면: 문구는 왼쪽, 버스는 오른쪽
    camera.updateProjectionMatrix();

    /* 조명은 버스를 따라간다. 오프닝에서는 빛이 지나간 곳부터 차체가 드러난다 */
    const { key, rim, glow } = world.lights;
    key.position.set(busX + 9, 12, busZ + 8); key.target.position.set(busX, 1, busZ);
    rim.position.set(busX - 10, 6, busZ - 9); rim.target.position.set(busX, 1.5, busZ);
    glow.position.set(busX + 7.5, 3.4, busZ + 6.5); glow.intensity = 0.7 * (1 - 0.5 * high) * (1 - 0.7 * smooth(1.2, 1.38, p) * (1 - end));   // 정류장 시설이 가까운 조명에 하얗게 뜨지 않게
    shared.sweep.value.set(busX + lerp(7.4, -7.6, oSweep), oSweep > 0 && oSweep < 1 ? Math.sin(Math.PI * oSweep) ** 0.6 : 0, time, oLit);
    shared.lamp.value.set(Math.round((busX + 80) / 32) * 32 - 80, roadIn * (1 - high), 0);    // 가까운 가로등 아래를 지날 때 차체에 스치는 빛

    /* 커서가 차체 가까이 오면 그 주변에만 얇은 고리가 번진다 */
    let near = 0;
    if (ptr.on && !reduce && sec > 2) {
      ray.setFromCamera({ x: ptr.x, y: ptr.y }, camera);
      boxW.copy(boxLocal).translate(bus.group.position);
      if (ray.ray.intersectBox(boxW, hit)) { shared.cur.value.copy(hit); near = 1 - 0.8 * high; }
    }
    cursorAmt += (near - cursorAmt) * (1 - Math.exp(-dt * 5)); shared.curAmt.value = cursorAmt;

    /* 세계는 버스에서 가까운 곳부터 열린다: 버스 주변 → 앞쪽 도로 → 길가 → 도시 전체 */
    const reveal = (15 * oHead + 20 * oBump + 60 * smooth(0.07, 0.2, p) + 130 * smooth(0.2, 0.46, p) + 500 * smooth(0.44, 0.7, p) * (1 - 0.5 * leave)) * (1 - 0.6 * end);
    world.update({ busX, busZ, dist, time, reveal, ahead: 9 * (1 - high), far, net, sig, head: headK * (1 - 0.6 * high), ripple: oRipple, px: dpr * (H / 900) });
    /* 정류장 구간: 버스의 신호가 안내기로, 같은 정보가 스마트폰 화면으로 이어진다. 상태는 모두 진행률로 정해진다 */
    stop.update({ g: p, time, busX, busZ, dist, toBit: smooth(1.05, 1.15, p), toPhone: smooth(1.5, 1.62, p), flowK: smooth(1.04, 1.1, p) * (1 - smooth(1.86, 1.96, p)), trailK: 0.9 * end + 0.3 * leave * (1 - end), ringK: smooth(1.0, 1.1, p) * (1 - smooth(1.3, 1.4, p)) });
    renderer.render(scene, camera);

    updateCopy(sec < 1.75 && p < 0.02 ? -9 : p);
    railMark.style.transform = `scaleX(${(p / G).toFixed(4)})`;
    const sceneNow = p < 0.5 ? 0 : p < 1.2 ? 1 : p < 1.56 ? 2 : p < 2.0 ? 3 : 4;
    railItems.forEach((li, i) => li.classList.toggle("is-now", i === sceneNow));
    root.classList.toggle('at-start', p < 0.03 && sec > 2);

    if (fine) { const k = 1 - Math.exp(-dt * 16); ringPos.x += (ptr.px - ringPos.x) * k; ringPos.y += (ptr.py - ringPos.y) * k; ring.style.transform = `translate3d(${ringPos.x.toFixed(1)}px, ${ringPos.y.toFixed(1)}px, 0) scale(${(1 + cursorAmt * 0.35).toFixed(3)})`; }
    if (++frames === 2) root.classList.add('is-ready');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__journey = { stop, G, minGap: world.minGap, get p() { return p; }, get frames() { return frames; }, get dist() { return distanceAt(p); }, set born(v) { born = v; }, bus, camera, renderer };
}

/* 글꼴이 실제로 불러와졌는지 확인해 화면에 알린다 */
function reportFonts() {
  if (!document.fonts) return;
  document.fonts.ready.then(() => {
    const loaded = (re) => [...document.fonts].some((f) => re.test(f.family) && f.status === 'loaded');
    const termina = loaded(/termina/i), free = loaded(/freesentation/i);
    root.dataset.termina = termina ? 'loaded' : 'fallback'; root.dataset.freesentation = free ? 'loaded' : 'fallback';
    const note = $('.status__fonts');
    if (note && (!termina || !free)) note.textContent = `대체 서체 표시 중(${[!termina && 'Termina', !free && 'Freesentation'].filter(Boolean).join(', ')} 미적용)`;
  });
}

try { start(); } catch (err) { console.error(err); root.classList.add('no-gl', 'is-ready'); }
reportFonts();
