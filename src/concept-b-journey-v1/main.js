/**
 * LIVEBUS B안 — 한 대의 버스와 함께 이어지는 여정 (1차: 첫 만남 → 출발 → BMS)
 *
 * 스크롤 진행률 하나가 버스 위치, 바퀴 회전, 카메라, 환경, 문구를 모두 정한다.
 * 스크롤을 멈추면 주행도 멈추고, 올리면 그대로 되돌아간다.
 * three.js(r128)는 concept-b.html 의 <script> 로 불러온 전역 THREE 를 쓴다.
 */
import { buildBus, BUS } from './bus.js';
import { buildEnvironment, buildWorld } from './world.js';

const $ = (s) => document.querySelector(s);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const root = document.documentElement;

/* 카메라 구도: 버스를 중심으로 한 방위각(0 = 정면, 90 = 문 쪽 측면, 180 = 뒤), 거리, 높이, 바라보는 점.
   shift 는 문구 자리를 비우기 위해 화면 속 버스를 옆으로 옮기는 비율이다. */
const KEYS = [
  { p: 0.0, az: 37, r: 20, h: 2.3, look: [0.2, 1.5, 0], fov: 30, shift: 0.15 },
  { p: 0.11, az: 37, r: 20, h: 2.3, look: [0.2, 1.5, 0], fov: 30, shift: 0.15 },
  { p: 0.33, az: 88, r: 19, h: 1.9, look: [0.6, 1.45, 0], fov: 32, shift: 0.02 },
  { p: 0.55, az: 148, r: 22, h: 8.5, look: [4, 1.2, 0], fov: 34, shift: 0.05 },
  { p: 0.74, az: 160, r: 62, h: 58, look: [24, 0, -4], fov: 34, shift: 0.15 },
  { p: 1.0, az: 164, r: 66, h: 62, look: [28, 0, -4], fov: 34, shift: 0.15 },
];
function cameraAt(p) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = smooth(a.p, b.p, p);
  return { az: lerp(a.az, b.az, t), r: lerp(a.r, b.r, t), h: lerp(a.h, b.h, t), fov: lerp(a.fov, b.fov, t), shift: lerp(a.shift, b.shift, t), look: a.look.map((v, k) => lerp(v, b.look[k], t)) };
}
/* 이동 거리(m): 천천히 출발해 일정한 속도로 달린다 */
function distanceAt(p) {
  const t = clamp((p - 0.13) / 0.87, 0, 1);
  return 330 * (t < 0.3 ? (t * t) / 0.6 : t - 0.15);
}

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
  scene.fog = new THREE.FogExp2(0x000105, 0);
  scene.environment = buildEnvironment(THREE, renderer);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.3, 900);

  const shared = { sweep: { value: new THREE.Vector3(99, 0, 0) }, cur: { value: new THREE.Vector3(0, -50, 0) }, curAmt: { value: 0 } };
  const bus = buildBus(THREE, shared);
  scene.add(bus.group);
  const world = buildWorld(THREE, scene, { mobile });
  const updateCopy = setupCopy();

  let W = 1, H = 1, dprCap = mobile ? 1.5 : 2, dpr = 1;
  const resize = () => {
    W = stage.clientWidth; H = stage.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
  };
  new ResizeObserver(resize).observe(stage); resize();

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
  const onScroll = () => { const max = root.scrollHeight - window.innerHeight; pTarget = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0; };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if (reduce) p = pTarget > 0.5 ? 1 : 0; else p = pTarget;

  const ray = new THREE.Raycaster(), hit = new THREE.Vector3(), boxLocal = new THREE.Box3(new THREE.Vector3(-5.6, 0.2, -1.5), new THREE.Vector3(5.7, 3.3, 1.5)), boxW = new THREE.Box3();
  const railMark = $('.rail__mark'), railItems = [...document.querySelectorAll('.rail li')];
  const look = new THREE.Vector3();
  let last = performance.now(), born = last, time = 0, slow = 0, frames = 0, fade = 1, fadeTarget = 1, cursorAmt = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const sec = (now - born) / 1000;
    time += reduce ? 0 : dt;
    if (sec > 3 && dprCap > 1 && window.__JOURNEY_LOCK !== true) { slow = dt > 0.026 ? slow + dt : Math.max(0, slow - dt * 0.5); if (slow > 1.2) { dprCap = Math.max(1, dprCap - 0.5); slow = 0; resize(); } }

    /* 진행률: 스크롤 위치를 부드럽게 따라간다. 동작 줄이기에서는 두 구도 사이를 짧은 페이드로 바꾼다 */
    if (reduce) {
      const want = pTarget > 0.5 ? 1 : 0;
      if (want !== p) { fadeTarget = 0; if (fade < 0.03) { p = want; fadeTarget = 1; } }
      fade += (fadeTarget - fade) * (1 - Math.exp(-dt * 12)); canvas.style.opacity = fade.toFixed(3);
    } else p += (pTarget - p) * (1 - Math.exp(-dt * 6.5));

    const dist = distanceAt(p), busX = dist;
    const roadIn = smooth(0.1, 0.24, p), cityIn = smooth(0.4, 0.66, p);

    /* 버스: 이동 거리만큼만 바퀴가 돈다(미끄러짐 없음) */
    bus.group.position.x = busX;
    for (const w of bus.wheels) w.rotation.z = -dist / BUS.wheelRadius;
    bus.edges.material.opacity = 0.2 + 0.25 * cityIn;

    /* 카메라 */
    const c = cameraAt(p), aspect = W / H, narrow = smooth(1.25, 0.6, aspect);
    ptr.sx += ((ptr.on ? ptr.x : 0) - ptr.sx) * (1 - Math.exp(-dt * 3)); ptr.sy += ((ptr.on ? ptr.y : 0) - ptr.sy) * (1 - Math.exp(-dt * 3));
    const par = reduce ? 0 : 1 - 0.6 * cityIn;
    const az = ((c.az - ptr.sx * 2.6 * par) * Math.PI) / 180, r = c.r * (1 + narrow * 1.15), h = c.h * (1 + narrow * 0.35) + ptr.sy * 0.45 * par;
    camera.position.set(busX + Math.cos(az) * r, Math.max(0.5, h), Math.sin(az) * r);
    look.set(busX + c.look[0], c.look[1], c.look[2]); camera.lookAt(look);
    camera.fov = c.fov; camera.aspect = aspect;
    if (narrow > 0.5) camera.setViewOffset(W, H, 0, -H * 0.11 * (1 - cityIn * 0.4), W, H);      // 세로 화면: 문구는 위, 버스는 아래
    else camera.setViewOffset(W, H, -W * c.shift, 0, W, H);                                     // 가로 화면: 문구는 왼쪽, 버스는 오른쪽
    camera.updateProjectionMatrix();
    scene.fog.density = 0.0035 * cityIn;

    /* 조명은 버스를 따라간다 */
    const intro = reduce ? 1 : smooth(0.0, 0.9, sec);
    const { key, rim, glow } = world.lights;
    glow.position.set(busX + 7.5, 3.4, 6.5); glow.intensity = 0.7 * intro * (1 - 0.5 * cityIn);
    key.position.set(busX + 9, 12, 8); key.target.position.set(busX, 1, 0); key.intensity = 1.25 * (0.25 + 0.75 * intro);
    rim.position.set(busX - 10, 6, -9); rim.target.position.set(busX, 1.5, 0);

    /* 차체를 훑는 얇은 빛(등장 때 한 번) */
    const sw = reduce ? 2 : clamp((sec - 0.2) / 1.25, 0, 1);
    shared.sweep.value.set(busX + lerp(6.6, -6.6, sw), sw > 0 && sw < 1 ? Math.sin(Math.PI * sw) ** 0.5 : 0, time);

    /* 커서가 차체 가까이 오면 그 주변에만 얇은 고리가 번진다 */
    let near = 0;
    if (ptr.on && !reduce) {
      ray.setFromCamera({ x: ptr.x, y: ptr.y }, camera);
      boxW.copy(boxLocal).translate(bus.group.position);
      if (ray.ray.intersectBox(boxW, hit)) { shared.cur.value.copy(hit); near = 1 - 0.7 * cityIn; }
    }
    cursorAmt += (near - cursorAmt) * (1 - Math.exp(-dt * 5)); shared.curAmt.value = cursorAmt;

    world.update({ busX, dist, time, roadIn, cityIn, px: dpr * (H / 900) });
    renderer.render(scene, camera);

    updateCopy(p);
    railMark.style.transform = `scaleX(${(p * 0.25).toFixed(4)})`;   // 다섯 구간 중 첫 두 구간(전체의 1/4 지점까지)
    railItems.forEach((li, i) => li.classList.toggle('is-now', (i === 0 && p < 0.4) || (i === 1 && p >= 0.4)));
    root.classList.toggle('is-moving', Math.abs(pTarget - p) > 0.004);
    root.classList.toggle('at-start', p < 0.03);

    if (fine) { const k = 1 - Math.exp(-dt * 16); ringPos.x += (ptr.px - ringPos.x) * k; ringPos.y += (ptr.py - ringPos.y) * k; ring.style.transform = `translate3d(${ringPos.x.toFixed(1)}px, ${ringPos.y.toFixed(1)}px, 0) scale(${(1 + cursorAmt * 0.35).toFixed(3)})`; }
    if (++frames === 2) root.classList.add('is-ready');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__journey = { get p() { return p; }, get frames() { return frames; }, get dist() { return distanceAt(p); }, bus, camera, renderer };
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
