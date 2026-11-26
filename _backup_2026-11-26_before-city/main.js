/**
 * LIVEBUS — 서비스 경험 페이지(4차): 첫 등장 → LIVEBUS → BMS → BIT → BIS → 도입 문의 제안
 *
 * 스크롤 진행률 하나가 버스 위치, 바퀴 회전, 카메라, 환경, 기기 화면, 문구를 모두 정한다.
 * 스크롤을 멈추면 주행도 멈추고, 올리면 그대로 되돌아간다. 첫 로드의 오프닝만 시간으로 흐른다.
 * three.js(r128)는 concept-b.html 의 <script> 로 불러온 전역 THREE 를 쓴다.
 */
import * as busNow from './bus.js';
import * as busV1 from './bus-v1.js';
import { buildEnvironment, buildWorld } from './world.js';
import { buildStop, TL } from './stop.js';

/* 버스 모델: 기본은 개선 모델. 주소에 ?bus=v1 을 붙이면 이전 모델로 바꿔 비교할 수 있다(바퀴 반지름과 기준점은 두 모델이 같다) */
const { buildBus, BUS, SIGNAL, bodyGeometry } = new URLSearchParams(window.location.search).get('bus') === 'v1' ? busV1 : busNow;

const $ = (s) => document.querySelector(s);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const root = document.documentElement;

export const G = 2.4;                                     // 전체 진행률의 끝. 0~1 은 2차부터 그대로인 구간이다

/* 카메라 구도: 기준점을 중심으로 한 방위각(0 = 정면, 90 = 문 쪽 측면, 180 = 뒤), 거리, 높이, 바라보는 점.
   기준점은 보통 버스이고, 정류장 구간(1.34~1.9)에서는 '정류장에 선 버스의 자리'에 고정된다(버스가 굴러 들어와 멈추는 모습이 보인다).
   shift 는 문구 자리를 비우려고 화면 속 장면을 옆으로 옮기는 비율, vs 는 아래로 내리는 비율이다.
   n 은 세로로 긴 화면에서 쓰는 값. 적지 않으면 가로 화면 구도에서 거리 2.15배, 높이 1.35배로 물러난다. */
const KEYS = [
  { p: 0.0, az: 37, r: 20, h: 2.3, lx: 0.2, ly: 1.5, lz: 0, fov: 30, shift: 0.15 },
  { p: 0.09, az: 37, r: 20, h: 2.3, lx: 0.2, ly: 1.5, lz: 0, fov: 30, shift: 0.15 },     // 첫 화면: 머무는 구간
  { p: 0.18, az: 46, r: 19, h: 2.0, lx: 1.4, ly: 1.45, lz: 0, fov: 31, shift: 0.1 },     // 출발 준비: 앞쪽 도로가 열린다
  { p: 0.34, az: 86, r: 19, h: 1.9, lx: 0.6, ly: 1.45, lz: 0, fov: 32, shift: 0.02 },    // 측면 주행
  { p: 0.47, az: 106, r: 21, h: 3.0, lx: 1.5, ly: 1.5, lz: 0, fov: 33, shift: 0.0 },
  { p: 0.6, az: 146, r: 27, h: 11.5, lx: 5, ly: 1.2, lz: -1, fov: 34, shift: 0.05 },     // 도시 진입: 뒤로, 위로
  { p: 0.76, az: 160, r: 64, h: 60, lx: 26, ly: 0, lz: -4, fov: 34, shift: 0.15, n: { vs: 0.066 } },   // BMS: 머무는 구간
  { p: 1.0, az: 164, r: 68, h: 64, lx: 30, ly: 0, lz: -4, fov: 34, shift: 0.15, n: { vs: 0.066 } },
  /* 여기부터 정류장 구간. 위의 구도와 진행률은 그대로다 */
  { p: 1.12, az: 150, r: 40, h: 30, lx: 14, ly: 0.5, lz: -1, fov: 34, shift: 0.1 },       // 버스의 위치 신호를 따라 내려간다(건물이 없는 문 쪽 상공으로)
  { p: 1.24, az: 92, r: 25, h: 8.5, lx: 4.5, ly: 1.4, lz: 1.5, fov: 32, shift: 0.06 },      // 안내기가 보이기 전에 거리와 시선을 먼저 정한다
  { p: 1.295, az: 54, r: 24.5, h: 3.6, lx: 7.2, ly: 1.8, lz: 1.7, fov: 31, shift: 0.05 },
  { p: 1.34, ...BIT_W(), n: BIT_N() },                                                    // BIT: 안내기는 전경, 버스는 중경, 도시는 배경
  { p: 1.54, ...BIT_W(), n: BIT_N() },
  { p: 1.66, ...BIS_W(), n: BIS_N() },                                                    // BIS: 물러나며 전경에 스마트폰이 올라온다. 안내기는 옆으로, 버스는 배경으로
  { p: 1.9, ...BIS_W(), n: BIS_N() },
  { p: 2.06, az: 58, r: 18, h: 2.6, lx: 1.5, ly: 1.5, lz: 0, fov: 31, shift: 0.08 },      // 다시 출발하는 같은 버스를 따라간다
  { p: 2.22, az: 37, r: 20, h: 2.3, lx: 0.2, ly: 1.5, lz: 0, fov: 30, shift: 0.15 },      // 도입 문의 제안: 안정적인 전면 3/4
  { p: G, az: 37, r: 20, h: 2.3, lx: 0.2, ly: 1.5, lz: 0, fov: 30, shift: 0.15 },
];
function BIT_W() { return { az: 29.6, r: 23.9, h: 1.75, lx: 10.96, ly: 1.9, lz: 1.82, fov: 30, shift: 0.04 }; }
function BIT_N() { return { az: 23.8, r: 26.0, h: 1.7, lx: 13.27, ly: 1.8, lz: 3.31, fov: 40, vs: 0.11 }; }
function BIS_W() { return { az: 40, r: 28, h: 1.7, lx: 8.2, ly: 1.85, lz: 3.02, fov: 32, shift: 0.02 }; }
function BIS_N() { return { az: 33.6, r: 30.15, h: 1.7, lx: 12.8, ly: 1.7, lz: 3.54, fov: 40, vs: -0.085 }; }
/* 첫 로드의 오프닝이 시작하는 구도: 앞머리 모서리·전조등·유리 일부가 화면 가까이 있다 */
const OPEN = { w: { az: 19, r: 7.7, h: 1.3, lx: 5.0, ly: 1.02, lz: 0.8, fov: 30, shift: 0, vs: 0 }, n: { az: 15, r: 9.8, h: 1.35, lx: 5.1, ly: 1.3, lz: 0.6, fov: 34, shift: 0, vs: 0.05 } };

const FIELDS = ['az', 'r', 'h', 'lx', 'ly', 'lz', 'fov', 'shift', 'vs'];
const WIDE = KEYS.map((k) => ({ vs: 0, ...k }));
const NARROW = KEYS.map((k) => ({ ...k, r: k.r * 2.15, h: k.h * 1.35, shift: 0, vs: 0.11, ...(k.n || {}) }));
/* 구도 사이를 속도가 끊기지 않게 잇는다(머무는 구간에서는 기울기 0) */
const tangents = (T) => Object.fromEntries(FIELDS.map((f) => {
  const d = T.slice(0, -1).map((k, i) => (T[i + 1][f] - k[f]) / (T[i + 1].p - k.p));
  return [f, T.map((_, i) => (i === 0 || i === T.length - 1 || d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i])))];
}));
const TAN_W = tangents(WIDE), TAN_N = tangents(NARROW);
function hermite(T, TAN, p) {
  let i = 0;
  while (i < T.length - 2 && p > T[i + 1].p) i++;
  const a = T[i], b = T[i + 1], h = b.p - a.p, t = clamp((p - a.p) / h, 0, 1), t2 = t * t, t3 = t2 * t, out = {};
  for (const f of FIELDS) out[f] = (2 * t3 - 3 * t2 + 1) * a[f] + (t3 - 2 * t2 + t) * h * TAN[f][i] + (-2 * t3 + 3 * t2) * b[f] + (t3 - t2) * h * TAN[f][i + 1];
  return out;
}
/** 화면 비율에 맞는 구도. narrow: 0 = 가로로 넓은 화면, 1 = 세로로 긴 화면 */
function cameraAt(p, narrow, aspect = 1.6) {
  if (window.__CAM) return { vs: 0, ...window.__CAM };                                    // 확인용: 구도를 직접 넣어 본다
  const w = hermite(WIDE, TAN_W, p);
  /* 가로 구도는 16:10 을 기준으로 잡았다. 그보다 덜 넓은 화면에서는 세로 화각을 넓혀 좌우에 담기는 범위를 지킨다(기기가 옆으로 잘리지 않게) */
  if (aspect < 1.6) w.fov = (Math.atan(Math.tan((w.fov * Math.PI) / 360) * Math.min(1.3, 1.6 / aspect)) * 360) / Math.PI;
  if (narrow < 0.001) return w;
  const n = hermite(NARROW, TAN_N, p); if (narrow > 0.999) return n;
  for (const f of FIELDS) w[f] = lerp(w[f], n[f], narrow);
  return w;
}
/* 이동 거리(m): 천천히 출발해 일정한 속도로 달리고, 정류장에 감속해 서고, 다시 출발한다 */
function distanceAt(p) {
  const t = clamp((p - 0.15) / 0.85, 0, 1), V = 410 / 0.85;
  let d = 410 * (t < 0.25 ? (t * t) / 0.5 : t - 0.125);                                     // 0~1: 2차와 같은 주행(359m)
  if (p > 1) d += V * (Math.min(p, 1.197) - 1);                                             // 같은 속도로 조금 더
  if (p > 1.197) { const T = 0.183, u = Math.min(p - 1.197, T); d += V * (u - (u * u) / (2 * T)); }   // 정류장까지 감속해 1.38 에 정차
  if (p > TL.depart) d += 400 * (p - TL.depart) ** 2;                                       // 다시 출발
  return d;
}
export const STOP = { x: distanceAt(1.5), z: 3.3, dist: distanceAt(1.5) };   // 정류장에 선 버스의 위치(약 497.9m 지점, 바깥 차로)
/* 차로: 정류장에 대려고 바깥 차로로 옮겼다가, 출발한 뒤 안쪽 차로로 돌아온다 */
const laneZ = (p) => STOP.z * smooth(1.04, 1.3, p) * (1 - smooth(TL.depart + 0.06, TL.depart + 0.28, p));
/* 카메라 기준점이 버스에서 정류장 자리로 옮겨 가는 정도(정차 직전에 고정, 출발하면 다시 버스를 따라간다) */
const stopHold = (p) => smooth(1.265, 1.35, p) * (1 - smooth(TL.depart, TL.depart + 0.08, p));
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/* 문구: 한 번에 하나만. 들어올 때는 글자마다 짧은 시간차, 나갈 때는 전체가 함께 */
function setupCopy() {
  const blocks = [...document.querySelectorAll('.copy')];
  blocks.forEach((el) => {
    let i = 0;
    el.querySelectorAll('[data-split]').forEach((node) => {
      const parts = [...node.childNodes].map((c) => (c.nodeName === 'BR' ? '\n' : c.textContent)).join('').split('\n').map((t) => t.trim());
      node.textContent = ''; node.setAttribute('aria-label', parts.join(' '));
      parts.forEach((line, li) => {
        if (li) node.appendChild(document.createElement('br'));
        for (const word of line.split(' ')) {
          const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
          for (const ch of word) { const c = document.createElement('span'); c.className = 'ch'; c.style.setProperty('--i', i++); c.textContent = ch; w.appendChild(c); }
          node.appendChild(w); node.appendChild(document.createTextNode(' '));
        }
      });
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

/* 페이지 사이를 오갈 때의 기억(이 탭 안에서만, 개인정보 없음): 마지막 3D 위치, 문의 페이지에서 돌아왔는지 */
const memory = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* 저장소를 쓸 수 없으면 기억하지 않는다 */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* 위와 같음 */ } },
};

function start() {
  const THREE = window.THREE;
  const canvas = $('#scene'), stage = $('.stage');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 600;
  if (!THREE) throw new Error('three.js 를 불러오지 못했습니다');

  /* 오프닝은 첫 로드에서 한 번만. 뒤로 가기로 돌아왔거나 문의 페이지의 링크로 돌아온 때, 중간 위치로 복원된 때에는 재생하지 않는다 */
  const navType = performance.getEntriesByType?.('navigation')[0]?.type || 'navigate';
  const fromContact = memory.get('lb:from-contact') === '1'; memory.del('lb:from-contact');
  const restoring = navType === 'back_forward' || navType === 'reload';
  const forceOpening = new URLSearchParams(window.location.search).has('opening');        // 확인용: ?opening 을 붙이면 다시 본다
  const playOpening = forceOpening || (!reduce && navType !== 'back_forward' && !fromContact && window.scrollY < window.innerHeight * 0.1);

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
  const world = buildWorld(THREE, scene, { mobile, bodyGeometry });
  const path = []; for (let g = 0.15; g <= G; g += 0.01) path.push([distanceAt(g), laneZ(g)]);
  const stop = buildStop(THREE, scene, bus.materials, STOP, path);
  const updateCopy = setupCopy();

  let W = 1, H = 1, dprCap = mobile ? 1.5 : 2, dpr = 1;
  const resize = () => { W = stage.clientWidth; H = stage.clientHeight; dpr = Math.min(window.devicePixelRatio || 1, dprCap); renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); };
  new ResizeObserver(resize).observe(stage); resize();
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

  /* 스크롤 → 진행률. 화면 높이의 5.8배가 진행률 1(2차부터 같은 길이) */
  const SPAN = () => 5.8 * window.innerHeight;
  let pTarget = 0, p = 0, snapUntil = restoring ? performance.now() + 900 : 0;
  const onScroll = () => { pTarget = clamp(window.scrollY / SPAN(), 0, G); };
  const ANCHORS = [0, 0.9, 1.45, 1.8, G], nearest = (v) => ANCHORS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  p = reduce ? nearest(pTarget) : pTarget;
  /* 마지막 3D 위치를 기억해 둔다. 브라우저가 뒤로 가기에서 스크롤을 되돌리지 못한 경우에만 쓴다 */
  const remember = () => memory.set('lb:journey-p', pTarget.toFixed(4));
  window.addEventListener('pagehide', remember);
  if (navType === 'back_forward') {
    const saved = parseFloat(memory.get('lb:journey-p'));
    if (saved > 0.01) setTimeout(() => { if (window.scrollY < 4) window.scrollTo(0, saved * SPAN()); }, 250);
  }
  window.addEventListener('pageshow', (e) => { if (e.persisted) { last = performance.now(); onScroll(); p = reduce ? nearest(pTarget) : pTarget; } });
  /* 아래 진행 내비게이션: 누르면 그 구간으로 간다. 마지막 버튼과 CTA 는 문의 페이지로 */
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => window.scrollTo({ top: Math.ceil(+b.dataset.go * SPAN()), behavior: reduce ? 'auto' : 'smooth' })));
  document.querySelectorAll('a[data-contact]').forEach((a) => a.addEventListener('click', remember));

  const ray = new THREE.Raycaster(), hit = new THREE.Vector3(), boxLocal = new THREE.Box3(new THREE.Vector3(-5.6, 0.2, -1.5), new THREE.Vector3(5.7, 3.4, 1.5)), boxW = new THREE.Box3();
  const railMark = $('.rail__mark'), railItems = [...document.querySelectorAll('.rail li')];
  const look = new THREE.Vector3(), signal = new THREE.Vector3();
  let last = performance.now(), born = 0, time = 0, slow = 0, frames = 0, fade = 1, fadeTarget = 1, cursorAmt = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!born) born = now;                                                                  // 오프닝의 시계는 첫 장면이 그려지는 순간부터 간다
    const sec = playOpening ? (window.__JOURNEY_SEC ?? (now - born) / 1000) : 99;           // __JOURNEY_SEC: 오프닝의 한 순간을 멈춰서 확인할 때
    time += reduce ? 0 : dt;
    if (sec > 4 && dprCap > 1 && window.__JOURNEY_LOCK !== true) { slow = dt > 0.026 ? slow + dt : Math.max(0, slow - dt * 0.5); if (slow > 1.2) { dprCap = Math.max(1, dprCap - 0.5); slow = 0; resize(); } }

    /* 진행률: 스크롤 위치를 부드럽게 따라간다. 동작 줄이기에서는 정해진 구도 사이를 짧은 페이드로 바꾼다 */
    if (reduce) {
      const want = nearest(pTarget);
      if (want !== p) { fadeTarget = 0; if (fade < 0.03) { p = want; fadeTarget = 1; } }
      fade += (fadeTarget - fade) * (1 - Math.exp(-dt * 12)); canvas.style.opacity = fade.toFixed(3);
    } else if (now < snapUntil) p = pTarget;                                               // 복원된 위치로는 달려가지 않고 바로 선다
    else p += (pTarget - p) * (1 - Math.exp(-dt * 6));

    /* ── 오프닝(시간 기준, 약 2.5초). 스크롤 구도 위에 얹는 변화라서, 도중에 스크롤하면 그만큼 옅어지며 스크롤 구도로 합류한다 ──
       0.0 앞머리 모서리와 전조등이 화면 가까이. 버스가 굴러 들어오고 카메라가 붙어 간다(차선이 스쳐 지나간다)
       0.25~1.45 가는 빛이 차체 곡면을 따라 앞에서 뒤로 → 0.6~2.2 카메라가 물러나며 전면과 측면이 드러난다
       1.2~2.2 빛이 노면을 따라 짧게 흐른다 → 1.45 로고, 1.75 헤드라인 → 2.5 스크롤 시작 구도에 정착 */
    const oJoin = 1 - smooth(0.015, 0.16, p);                                               // 스크롤로 떠나면 오프닝의 몫이 줄어든다
    const oCam = (1 - easeIO(clamp((sec - 0.1) / 2.4, 0, 1))) * oJoin;
    const oRoll = -10 * (1 - clamp(sec / 1.85, 0, 1)) ** 2.2 * oJoin;                       // 멈추기 전 마지막 10m 를 굴러 들어온다
    const oSweep = easeIO(clamp((sec - 0.25) / 1.2, 0, 1));
    const oHead = 0.82 + 0.18 * smooth(0, 0.6, sec) + 0.16 * Math.exp(-(((sec - 0.9) / 0.22) ** 2));
    const oLit = (1 - smooth(1.2, 1.75, sec)) * oJoin;
    const oPulse = clamp((sec - 1.2) / 1.0, 0, 1);
    const oOpen = smooth(1.1, 2.3, sec);                                                    // 도시의 시작점이 드러나는 정도

    const dist = distanceAt(p) + oRoll, busX = dist, busZ = laneZ(p);
    const ddx = distanceAt(p + 0.004) - distanceAt(p - 0.004), ddz = laneZ(p + 0.004) - laneZ(p - 0.004);
    const roadIn = smooth(0.08, 0.2, p);

    /* 버스: 이동 거리만큼만 바퀴가 돈다(미끄러짐 없음) */
    bus.group.position.set(busX, 0, busZ); bus.group.rotation.y = ddx > 0.02 ? -Math.atan2(ddz, ddx) : 0;   // 차로를 옮길 때 차체가 살짝 돈다
    for (const w of bus.wheels) w.rotation.z = -dist / BUS.wheelRadius;
    bus.group.updateMatrixWorld(true);
    signal.set(SIGNAL.x, SIGNAL.y, SIGNAL.z).applyMatrix4(bus.group.matrixWorld);
    const headK = oHead * (0.6 + 0.4 * smooth(0.05, 0.16, p));
    bus.lamps.head.color.setRGB(0.9 * headK, 0.97 * headK, headK); bus.lamps.drl.color.setRGB(0.6 * headK, 0.86 * headK, headK);
    bus.lamps.sign.color.setScalar(Math.min(1, oHead)); bus.lamps.cyan.color.setRGB(0.12 * oHead, 0.6 * oHead, 0.85 * oHead);
    bus.lamps.tail.color.setRGB(0.1 + 0.32 * Math.min(1, oHead), 0.012, 0.02);
    bus.lamps.halo.opacity = 0.55 * Math.min(1.1, headK);

    /* 카메라 */
    const aspect = W / H, narrow = smooth(1.25, 0.6, aspect), c = cameraAt(p, narrow, aspect);
    if (oCam > 0.0005) { const o = OPEN.w, on = OPEN.n; for (const f of FIELDS) c[f] = lerp(c[f], lerp(o[f], on[f], narrow), oCam); }
    ptr.sx += ((ptr.on ? ptr.x : 0) - ptr.sx) * (1 - Math.exp(-dt * 3)); ptr.sy += ((ptr.on ? ptr.y : 0) - ptr.sy) * (1 - Math.exp(-dt * 3));
    const leave = smooth(1.02, 1.3, p), end = smooth(TL.depart + 0.04, 2.22, p);         // 도시 구도를 떠나는 정도, 마지막 장면으로 정리되는 정도
    const hold = stopHold(p);
    const far = Math.max((0.16 + 0.3 * (1 - smooth(1.5, 2.6, sec)) * oJoin) * (1 - leave), smooth(0.14, 0.36, p)) * (1 - 0.72 * end), net = smooth(0.64, 0.84, p) * (1 - leave), sig = smooth(0.52, 0.74, p) * (1 - leave), high = smooth(0.5, 0.74, p) * (1 - leave);
    const par = reduce ? 0 : (1 - 0.6 * high) * (1 - 0.86 * hold) * (1 - oCam);          // 정류장 구간에서는 전경의 기기가 흔들리지 않게 시선 반응을 줄인다
    const ax = lerp(busX, STOP.x, hold), az0 = lerp(busZ, STOP.z, hold);
    const az = ((c.az - ptr.sx * 2.6 * par) * Math.PI) / 180, h = c.h + ptr.sy * 0.45 * par;
    camera.position.set(ax + Math.cos(az) * c.r, Math.max(0.45, h), az0 + Math.sin(az) * c.r);
    look.set(ax + c.lx, c.ly, az0 + c.lz); camera.lookAt(look);
    camera.fov = c.fov; camera.aspect = aspect;
    camera.setViewOffset(W, H, -W * c.shift * (1 - narrow), -H * c.vs, W, H);             // 가로 화면: 문구는 왼쪽, 장면은 오른쪽 / 세로 화면: 문구는 위, 장면은 아래
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    bus.update?.(camera);                                                                   // 유리 안쪽 실내의 시차
    /* 스마트폰이 설 화면 속 자리: 가로 화면은 오른쪽(버스와 안내기 사이), 세로 화면은 가운데 아래 */
    const slot = { nx: lerp(0.385, 0.0, narrow) - 2 * c.shift * (1 - narrow), ny: lerp(-0.05, -0.26, narrow) + 2 * c.vs, size: lerp(0.52, 0.42, narrow), side: narrow > 0.5 ? 0 : -1 };

    /* 조명은 버스를 따라간다. 오프닝에서는 빛이 지나간 곳부터 차체가 밝아진다(지나가기 전에도 형태는 보인다) */
    const { key, rim, glow } = world.lights;
    key.position.set(busX + 9, 12, busZ + 8); key.target.position.set(busX, 1, busZ);
    rim.position.set(busX - 10, 6, busZ - 9); rim.target.position.set(busX, 1.5, busZ);
    glow.position.set(busX + 7.5, 3.4, busZ + 6.5); glow.intensity = 0.7 * (1 - 0.5 * high) * (1 - 0.7 * smooth(1.2, 1.38, p) * (1 - end));   // 정류장 시설이 가까운 조명에 하얗게 뜨지 않게
    shared.sweep.value.set(busX + lerp(3.5, -7.6, oSweep), sec < 99 && oSweep > 0 && oSweep < 1 ? Math.sin(Math.PI * oSweep) ** 0.6 * oJoin : 0, time, oLit);
    shared.lamp.value.set(Math.round((busX + 80) / 32) * 32 - 80, roadIn * (1 - high), 0);    // 가까운 가로등 아래를 지날 때 차체에 스치는 빛

    /* 커서가 차체에 닿으면 그 작은 영역에만 약한 반사광이 돈다 */
    let near = 0;
    if (ptr.on && !reduce && sec > 2.5) {
      ray.setFromCamera({ x: ptr.x, y: ptr.y }, camera);
      boxW.copy(boxLocal).translate(bus.group.position);
      if (ray.ray.intersectBox(boxW, hit)) { shared.cur.value.copy(hit); near = (1 - 0.8 * high) * (1 - 0.7 * hold); }
    }
    cursorAmt += (near - cursorAmt) * (1 - Math.exp(-dt * 5)); shared.curAmt.value = cursorAmt;

    /* 세계는 버스에서 가까운 곳부터 열린다: 버스 주변 → 앞쪽 도로 → 길가 → 도시 전체 */
    const reveal = (20 + 8 * oOpen + 60 * smooth(0.07, 0.2, p) + 130 * smooth(0.2, 0.46, p) + 500 * smooth(0.44, 0.7, p) * (1 - 0.5 * leave)) * (1 - 0.6 * end);
    world.update({ busX, busZ, dist: distanceAt(p), time, reveal, low: 1 - smooth(0.06, 0.2, p), ahead: 9 * (1 - high), far, net, sig, head: headK * (1 - 0.6 * high) * (1 - 0.45 * leave) * (1 - 0.6 * hold), px: dpr * (H / 900),
      pulseX: busX + 8 + 95 * easeIO(oPulse), pulse: sec < 99 ? Math.sin(Math.PI * oPulse) ** 0.8 * 0.55 * oJoin : 0 });
    /* 정류장 구간: 기기 화면과 정보의 빛. 상태는 모두 진행률로 정해진다 */
    stop.update({ g: p, time, busX, dist, signal, trailK: 0.42 * end, px: dpr * (H / 900), camera, slot });
    renderer.render(scene, camera);

    updateCopy(sec < 1.75 && p < 0.02 ? -9 : p);
    root.classList.toggle('is-intro', sec < 1.45 && p < 0.02);
    railMark.style.transform = `scaleX(${(p / G).toFixed(4)})`;
    const sceneNow = p < 0.5 ? 0 : p < 1.2 ? 1 : p < 1.6 ? 2 : p < 2.02 ? 3 : 4;
    railItems.forEach((li, i) => li.classList.toggle('is-now', i === sceneNow));
    root.classList.toggle('at-start', p < 0.03 && sec > 2.4);

    if (fine) { const k = 1 - Math.exp(-dt * 16); ringPos.x += (ptr.px - ringPos.x) * k; ringPos.y += (ptr.py - ringPos.y) * k; ring.style.transform = `translate3d(${ringPos.x.toFixed(1)}px, ${ringPos.y.toFixed(1)}px, 0)`; }
    if (++frames === 2) root.classList.add('is-ready');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__journey = { stop, G, TL, playOpening, minGap: world.minGap, get p() { return p; }, get frames() { return frames; }, get dist() { return distanceAt(p); }, set born(v) { born = v; }, bus, camera, renderer, signal };
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
