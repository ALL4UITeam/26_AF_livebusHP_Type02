/**
 * LIVEBUS — 서비스 경험 페이지(6차): 첫 등장 → LIVEBUS → BMS → BIT → BIS → 도입 문의 제안
 *
 * BMS 에서 버스 위에 나타난 '정보 노드'가 정류장까지 함께 가고, 같은 노드에서 BIT 와 BIS 로 정보가 전해진다(node.js, stop.js).
 * 스크롤 진행률 하나가 버스 위치, 바퀴 회전, 카메라, 환경, 정보 전달, 기기 화면, 문구를 모두 정한다.
 * 스크롤을 멈추면 주행도 멈추고, 올리면 그대로 되돌아간다. 첫 로드의 오프닝만 시간으로 흐른다.
 * three.js(r128)는 concept-b.html 의 <script> 로 불러온 전역 THREE 를 쓴다.
 */
import * as busNow from './bus.js';
import * as busV1 from './bus-v1.js';
import * as worldNow from './world.js';
import * as worldV1 from './world-v1.js';
import * as stopNow from './stop.js';
import * as stopV1 from './stop-v1.js';
import * as stopV2 from './stop-v2.js';
import * as stopV3 from './stop-v3.js';
import { TL, ROUTE, transferU, nodeEmph } from './stop.js';
import { buildNode } from './node.js';

/* 버스 모델: 기본은 개선 모델. 주소에 ?bus=v1 을 붙이면 이전 모델로 바꿔 비교할 수 있다(바퀴 반지름과 기준점은 두 모델이 같다) */
const { buildBus, BUS, SIGNAL, bodyGeometry } = new URLSearchParams(window.location.search).get('bus') === 'v1' ? busV1 : busNow;
/* 도시 배경과 선·도트: 기본은 개선판. ?city=v1 을 붙이면 이전 배경으로 같은 장면을 본다 */
const CITY_V1 = new URLSearchParams(window.location.search).get('city') === 'v1';
const FX_OLD = new URLSearchParams(window.location.search).get('fx');
const { buildEnvironment, buildWorld } = CITY_V1 ? worldV1 : worldNow, { buildStop } = CITY_V1 ? stopV1 : FX_OLD === 'v2' ? stopV2 : FX_OLD === 'v3' ? stopV3 : stopNow;   // ?fx=v2, ?fx=v3: 이전 전달 연출(지붕의 신호점에서 출발. v3 는 시간으로 재생)

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
function BIS_N() { return { az: 33.6, r: 30.15, h: 1.7, lx: 12.1, ly: 1.7, lz: 3.54, fov: 43, vs: -0.068 }; }   // 세로 화면: 버스 위의 노드와 안내기가 함께 들어오도록 조금 넓게 본다
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
const gauss = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));

/* 스크롤 거리 ↔ 진행률. 진행률의 값(구도, 문구, 주행)은 그대로 두고, 정보가 전달되는 두 구간에만 스크롤을 더 길게 배정한다.
   [이 진행률부터, 진행률 1 에 드는 스크롤(화면 높이 5.8배가 1)] — BIT 전달 구간은 1.9배, BIS 전달 구간은 1.45배 */
const CUTS = [[0, 1], [TL.bit[0], 1.9], [TL.bit[1], 1], [TL.bis[0], 1.45], [TL.bis[1], 1], [G, 0]];
export const toS = (p) => { let s = 0; for (let i = 0; i < CUTS.length - 1; i++) s += (clamp(p, CUTS[i][0], CUTS[i + 1][0]) - CUTS[i][0]) * CUTS[i][1]; return s; };
export const toP = (s) => { let p = 0; for (let i = 0; i < CUTS.length - 1; i++) { const len = (CUTS[i + 1][0] - CUTS[i][0]) * CUTS[i][1]; p += clamp(s, 0, len) / CUTS[i][1]; s -= len; } return p; };
/* 정보 노드의 높이(m): BMS 에서는 도시 위로 높이, 정류장에서는 버스 지붕 가까이. [가로 화면, 세로 화면] */
const NODE_Y = { city: 13.6, bit: [5.1, 5.6], bis: [5.1, 4.2] };   // 세로 화면의 BIS 에서는 위쪽 문구와 겹치지 않게 지붕 가까이 내린다

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
  const path = []; for (let g = 0.15; g <= G; g += 0.01) path.push([distanceAt(g), laneZ(g)]);
  const world = buildWorld(THREE, scene, { mobile, bodyGeometry, path });
  const stop = buildStop(THREE, scene, bus.materials, STOP, path);
  const node = CITY_V1 ? null : buildNode(THREE, scene);                                    // 이전 도시(?city=v1)는 자기 표식을 그대로 쓴다
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

  /* 스크롤 → 진행률. 화면 높이의 5.8배가 진행률 1(2차부터 같은 길이). 전달 구간만 toP 로 늘려 놓았다 */
  const SPAN = () => 5.8 * window.innerHeight;
  let pTarget = 0, p = 0, snapUntil = restoring ? performance.now() + 900 : 0;
  const onScroll = () => { pTarget = clamp(toP(window.scrollY / SPAN()), 0, G); };
  const ANCHORS = [0, 0.9, 1.52, 1.85, G], nearest = (v) => ANCHORS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  p = reduce ? nearest(pTarget) : pTarget;
  /* 마지막 3D 위치를 기억해 둔다. 브라우저가 뒤로 가기에서 스크롤을 되돌리지 못한 경우에만 쓴다 */
  const remember = () => memory.set('lb:journey-p', pTarget.toFixed(4));
  window.addEventListener('pagehide', remember);
  if (navType === 'back_forward') {
    const saved = parseFloat(memory.get('lb:journey-p'));
    if (saved > 0.01) setTimeout(() => { if (window.scrollY < 4) window.scrollTo(0, toS(saved) * SPAN()); }, 250);
  }
  window.addEventListener('pageshow', (e) => { if (e.persisted) { last = performance.now(); onScroll(); p = reduce ? nearest(pTarget) : pTarget; } });
  /* 아래 진행 내비게이션: 누르면 그 구간으로 간다. 마지막 버튼과 CTA 는 문의 페이지로 */
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => window.scrollTo({ top: Math.ceil(toS(+b.dataset.go) * SPAN()), behavior: reduce ? 'auto' : 'smooth' })));
  document.querySelectorAll('a[data-contact]').forEach((a) => a.addEventListener('click', remember));

  const ray = new THREE.Raycaster(), hit = new THREE.Vector3(), boxLocal = new THREE.Box3(new THREE.Vector3(-5.6, 0.2, -1.5), new THREE.Vector3(5.7, 3.4, 1.5)), boxW = new THREE.Box3();
  const railMark = $('.rail__mark'), railItems = [...document.querySelectorAll('.rail li')];
  const look = new THREE.Vector3(), signal = new THREE.Vector3(), nodeAt = new THREE.Vector3(), pr = new THREE.Vector3(), boxHot = new THREE.Box3();

  /* 정보 노드의 표지(노선번호·운행 상태)와 선택: 버스나 노드에 올리기·키보드 초점·탭 → 노드·링크 선·노선이 함께 강조되고 짧은 정보가 펼쳐진다 */
  const tag = $('.node-tag'), tagNo = $('.node-tag__no'), tagSt = $('.node-tag__st'), tagDest = $('.node-tag__dest'), tagNext = $('.node-tag__next');
  const sel = { pinned: false, over: false, focus: false, bus: false, s: 0, w: 0, h: 0, text: '', shown: false, hot: false };
  if (tag) {
    tagNo.textContent = ROUTE.no; tagDest.textContent = `${ROUTE.no}번 · ${ROUTE.dest}`;
    tag.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') sel.over = true; });
    tag.addEventListener('pointerleave', () => { sel.over = false; });
    tag.addEventListener('focus', () => { sel.focus = tag.matches(':focus-visible'); });
    tag.addEventListener('blur', () => { sel.focus = false; });
    tag.addEventListener('click', () => { sel.pinned = !sel.pinned; });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { sel.pinned = false; sel.focus = false; } });
    /* 탭: 버스를 누르면 선택, 다른 곳을 누르면 해제(끌어서 스크롤한 것은 탭으로 보지 않는다) */
    let down = null;
    window.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });
    window.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10 || performance.now() - down.t > 600 || e.target.closest?.('.node-tag, a, button')) return;
      const r = stage.getBoundingClientRect();
      ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1) }, camera);
      const onBus = sel.shown && !!ray.ray.intersectBox(boxHot, hit);
      sel.pinned = e.pointerType === 'touch' ? (onBus ? !sel.pinned : false) : onBus ? sel.pinned : false;
    }, { passive: true });
  }
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
       1.2~2.2 빛이 노면을 따라 짧게 흐른다 → 1.45 헤더 로고, 1.75 헤드라인 → 2.5 스크롤 시작 구도에 정착
       (첫 로드의 중앙 로고는 이 오프닝보다 앞, 불러오는 동안의 검정 화면에 있다: concept-b.html 의 .loader) */
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
    boxW.copy(boxLocal).translate(bus.group.position); boxHot.copy(boxW).expandByScalar(0.4 + 2.2 * high);   // 멀리서는 작은 버스를 가리키기 쉽게 조금 넉넉히
    sel.bus = false;
    if (ptr.on && sec > 2.5) {
      ray.setFromCamera({ x: ptr.x, y: ptr.y }, camera);
      sel.bus = !!ray.ray.intersectBox(boxHot, hit);
      if (!reduce && ray.ray.intersectBox(boxW, hit)) { shared.cur.value.copy(hit); near = (1 - 0.8 * high) * (1 - 0.7 * hold); }
    }
    cursorAmt += (near - cursorAmt) * (1 - Math.exp(-dt * 5)); shared.curAmt.value = cursorAmt;

    /* ── 정보 노드: BMS 에서 나타나 정류장까지 같은 모습으로 버스와 함께 간다. 버스가 다시 떠날 때 물러난다 ──
       높이와 크기만 카메라가 다가오는 흐름에 맞춰 바뀐다(색·형태·노선번호는 그대로). 화면에서의 크기는 거의 일정하다 */
    const nodeK = node ? smooth(0.64, 0.84, p) * (1 - smooth(TL.depart + 0.02, TL.depart + 0.14, p)) : 0;
    const nearY = lerp(lerp(NODE_Y.bit[0], NODE_Y.bit[1], narrow), lerp(NODE_Y.bis[0], NODE_Y.bis[1], narrow), smooth(TL.bit[1], TL.bis[0], p));
    nodeAt.set(signal.x, lerp(NODE_Y.city, nearY, smooth(1.04, 1.3, p)), signal.z);
    const nodePx = lerp(8.5, 12, leave) * clamp(H / 900, 0.85, 1.2), nodeR = (nodePx * camera.position.distanceTo(nodeAt) * Math.tan((c.fov * Math.PI) / 360)) / (H / 2);
    const hotWant = nodeK > 0.5 && (sel.pinned || sel.over || sel.focus || sel.bus);
    sel.s += ((hotWant ? 1 : 0) - sel.s) * (1 - Math.exp(-dt * 9));
    const [uBit, uBis] = transferU(p), emph = reduce ? 0 : Math.max(nodeEmph(uBit), nodeEmph(uBis));
    /* 위치 갱신(BMS 에서만, 3.6초에 한 번): 지붕의 작은 신호 → 링크 선을 따라 올라가는 빛 → 노드의 반응 → 이 차량의 노선 일부가 잠깐 밝아진다 */
    const amb = reduce ? 0 : net, ph = time % 3.6;
    const upd = { roof: amb * gauss(ph, 0.16, 0.13), blip: amb > 0.01 && ph > 0.2 && ph < 0.95 ? (ph - 0.2) / 0.75 : -1, react: amb * gauss(ph, 1.04, 0.2), ping: amb * smooth(0.98, 1.22, ph) * (1 - smooth(1.5, 2.5, ph)) };
    node?.update({ node: nodeAt, base: signal, k: nodeK, rad: nodeR, hot: sel.s, emph, roof: upd.roof, blip: upd.blip, react: upd.react, spin: dist * 0.012 + time * 0.22 });

    /* 세계는 버스에서 가까운 곳부터 열린다: 버스 주변 → 앞쪽 도로 → 길가 → 도시 전체 */
    const reveal = (20 + 8 * oOpen + 60 * smooth(0.07, 0.2, p) + 130 * smooth(0.2, 0.46, p) + 500 * smooth(0.44, 0.7, p) * (1 - 0.5 * leave)) * (1 - 0.6 * end);
    world.update({ busX, busZ, dist: distanceAt(p), time, reveal, low: 1 - smooth(0.06, 0.2, p), ahead: 9 * (1 - high), far, net, sig, head: headK * (1 - 0.6 * high) * (1 - 0.45 * leave) * (1 - 0.6 * hold), px: dpr * (H / 900), res: [W * dpr, H * dpr], routeK: Math.max(net, 0.5 * end, 0.85 * sel.s * nodeK) * (1 + 0.4 * sel.s), aheadK: Math.max(net, sel.s * nodeK), ping: upd.ping,
      pulseX: busX + 8 + 95 * easeIO(oPulse), pulse: sec < 99 ? Math.sin(Math.PI * oPulse) ** 0.8 * 0.55 * oJoin : 0 });
    /* 정류장 구간: 기기 화면과 정보의 빛. 상태는 모두 진행률로 정해진다 */
    stop.update({ g: p, time, busX, dist, signal, node: nodeAt, nodeR, trailK: 0.42 * end, px: dpr * (H / 900), camera, slot, reduce, settled: Math.abs(pTarget - p) < 0.004 });
    renderer.render(scene, camera);

    /* 노드의 표지: 3D 노드의 화면 위치 옆에 붙는다. 화면 밖이거나 스마트폰에 가려지는 자리에서는 숨긴다 */
    if (tag) {
      const stopped = p >= 1.38 && p < TL.depart, text = `${stopped ? '도착' : '운행 중'}|${ROUTE.stops[ROUTE.here + (stopped ? 1 : 0)]}`;
      if (text !== sel.text) { sel.text = text; tagSt.textContent = stopped ? '도착' : '운행 중'; tagNext.innerHTML = `다음 정류장 <b>${ROUTE.stops[ROUTE.here + (stopped ? 1 : 0)]}</b>`; sel.w = 0;
        tag.setAttribute('aria-label', `${ROUTE.no}번 버스 정보(시연용 예시): ${stopped ? '도착' : '운행 중'}, ${ROUTE.dest}, 다음 정류장 ${ROUTE.stops[ROUTE.here + (stopped ? 1 : 0)]}`); }
      if (hotWant !== sel.hot) { sel.hot = hotWant; tag.classList.toggle('is-hot', hotWant); tag.setAttribute('aria-expanded', hotWant ? 'true' : 'false'); sel.w = 0; }
      pr.copy(nodeAt).project(camera);
      const sx = (pr.x * 0.5 + 0.5) * W, sy = (-pr.y * 0.5 + 0.5) * H;
      let show = nodeK > 0.5 && pr.z < 1 && sx > 4 && sx < W - 4 && sy > 28 && sy < H - 28;
      if (show && stop.phone.visible) {                                                     // 스마트폰의 화면 속 자리와 겹치면 표지를 내린다(3D 노드는 깊이 판정으로 가려진다)
        const hh = slot.size * H * 0.5, hw = hh * 0.474; pr.copy(stop.phone.position).project(camera);
        const cx = (pr.x * 0.5 + 0.5) * W, cy = (-pr.y * 0.5 + 0.5) * H;
        if (sx > cx - hw - 6 && sx < cx + hw + 6 && sy > cy - hh - 6 && sy < cy + hh + 6) show = false;
      }
      if (show !== sel.shown) { sel.shown = show; tag.classList.toggle('is-on', show); tag.tabIndex = show ? 0 : -1; if (!show) { sel.pinned = false; if (document.activeElement === tag) tag.blur(); } }
      if (show) {
        if (!sel.w) { sel.w = tag.offsetWidth; sel.h = tag.offsetHeight; }
        const gap = nodePx + 2, right = sx + gap + sel.w < W - 6;                           // 기본은 노드 오른쪽. 자리가 없으면 왼쪽
        const rise = lerp(17, 28 + nodePx * 0.5 * (1 - narrow), leave);                                    // 정류장에서는 표지를 노드 위쪽으로 올려, 노드에서 떠나는 빛의 경로가 글자를 지나지 않게 한다
        tag.style.transform = `translate3d(${(right ? sx + gap : sx - gap - sel.w).toFixed(1)}px, ${clamp(sy - rise, 6, H - sel.h - 6).toFixed(1)}px, 0)`;
      }
    }

    updateCopy(sec < 1.75 && p < 0.02 ? -9 : p);
    root.classList.toggle('is-intro', sec < 1.45 && p < 0.02);                             // 헤더 로고는 차체가 드러난 뒤에 들어온다
    railMark.style.transform = `scaleX(${(p / G).toFixed(4)})`;
    const sceneNow = p < 0.5 ? 0 : p < 1.2 ? 1 : p < 1.6 ? 2 : p < 2.02 ? 3 : 4;
    railItems.forEach((li, i) => li.classList.toggle('is-now', i === sceneNow));
    root.classList.toggle('at-start', p < 0.03 && sec > 2.4);

    if (fine) { const k = 1 - Math.exp(-dt * 16); ringPos.x += (ptr.px - ringPos.x) * k; ringPos.y += (ptr.py - ringPos.y) * k; ring.style.transform = `translate3d(${ringPos.x.toFixed(1)}px, ${ringPos.y.toFixed(1)}px, 0)`; }
    if (++frames === 2) root.classList.add('is-ready');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__journey = { stop, G, TL, toS, toP, transferU, sel, nodeAt, playOpening, minGap: world.minGap, get p() { return p; }, get frames() { return frames; }, get dist() { return distanceAt(p); }, set born(v) { born = v; }, bus, camera, renderer, signal };
}

/* 글꼴이 실제로 불러와졌는지 확인해 화면에 알린다 */
function reportFonts() {
  if (!document.fonts) return;
  document.fonts.ready.then(() => {
    const loaded = (re) => [...document.fonts].some((f) => re.test(f.family) && f.status === 'loaded');
    const termina = loaded(/termina/i), free = loaded(/freesentation/i);
    root.dataset.termina = termina ? 'loaded' : 'fallback'; root.dataset.freesentation = free ? 'loaded' : 'fallback';
    const note = $('.fontnote');
    if (note && (!termina || !free)) note.textContent = `대체 서체 표시 중(${[!termina && 'Termina', !free && 'Freesentation'].filter(Boolean).join(', ')} 미적용)`;
  });
}

try { start(); } catch (err) { console.error(err); root.classList.add('no-gl', 'is-ready'); }
reportFonts();
