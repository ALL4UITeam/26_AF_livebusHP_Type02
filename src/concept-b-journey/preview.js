/**
 * 버스 모델 확인용 화면(bus-preview.html). 홈페이지와 같은 재질·환경 반사에 조명만 밝게 해서 모델을 살핀다.
 * ?bus=v1 이전 모델, ?view=front|side|far|rear|top|close|wheel 구도. 배포 빌드에는 들어가지 않는다.
 */
import * as busNow from './bus.js';
import * as busV1 from './bus-v1.js';
import { buildEnvironment } from './world.js';

const THREE = window.THREE, q = new URLSearchParams(window.location.search), old = q.get('bus') === 'v1';
const { buildBus, BUS } = old ? busV1 : busNow;
const VIEWS = {   // 방위각(0 = 정면, 90 = 문 쪽), 거리, 높이, 바라보는 점
  front: { az: 37, r: 13, h: 2.3, look: [0.2, 1.6, 0] }, side: { az: 90, r: 15, h: 1.9, look: [0, 1.65, 0] }, far: { az: -90, r: 15, h: 1.9, look: [0, 1.65, 0] },
  rear: { az: 146, r: 13, h: 2.6, look: [-0.2, 1.6, 0] }, top: { az: 160, r: 22, h: 13, look: [0, 1, 0] }, close: { az: 19, r: 7.7, h: 1.3, look: [5.0, 1.02, 0.8] }, wheel: { az: 72, r: 5.2, h: 0.9, look: [2.8, 0.6, 1.0] },
};
const canvas = document.querySelector('#view');
const renderer = new (q.get('gl') === '1' ? THREE.WebGL1Renderer : THREE.WebGLRenderer)({ canvas, antialias: true });   // ?gl=1: WebGL1 에서도 그려지는지 확인할 때
renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25; renderer.setClearColor(0x05080f, 1);
const scene = new THREE.Scene(); scene.environment = buildEnvironment(THREE, renderer);
scene.add(new THREE.HemisphereLight(0x9ab8f5, 0x0a0d14, 0.5));
const key = new THREE.DirectionalLight(0xe6f0ff, 1.7); key.position.set(9, 12, 8); scene.add(key);
const rim = new THREE.DirectionalLight(0x5cc4ff, 1.3); rim.position.set(-10, 6, -9); scene.add(rim);
const fill = new THREE.DirectionalLight(0xbfd2ff, 0.7); fill.position.set(-6, 5, 10); scene.add(fill);
/* 바닥: 1m 눈금(접지와 크기를 보기 위한 것) */
const gc = document.createElement('canvas'); gc.width = gc.height = 256; const g = gc.getContext('2d');
g.fillStyle = '#070b13'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(120,160,230,0.22)'; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256);
const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(60, 60); gt.anisotropy = 8; gt.encoding = THREE.sRGBEncoding;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: gt })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
const sc = document.createElement('canvas'); sc.width = sc.height = 128; const sg = sc.getContext('2d'), gr = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
gr.addColorStop(0, 'rgba(0,0,0,0.95)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 128, 128);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(14.5, 4.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; scene.add(shadow);

const shared = { sweep: { value: new THREE.Vector4(99, 0, 0, 0) }, cur: { value: new THREE.Vector3(0, -50, 0) }, curAmt: { value: 0 }, lamp: { value: new THREE.Vector3(0, 0, 0) } };
const bus = buildBus(THREE, shared); scene.add(bus.group);
bus.lamps.head.color.setRGB(0.9, 0.97, 1); bus.lamps.drl.color.setRGB(0.6, 0.86, 1); bus.lamps.sign.color.setScalar(1); bus.lamps.cyan.color.setRGB(0.12, 0.6, 0.85); bus.lamps.tail.color.setRGB(0.42, 0.012, 0.02);
if (bus.lamps.halo) bus.lamps.halo.opacity = 0.5;

const camera = new THREE.PerspectiveCamera(30, 1, 0.2, 400), cam = { ...VIEWS.front, look: [...VIEWS.front.look] };
const setView = (name) => { const v = VIEWS[name] || VIEWS.front; Object.assign(cam, v, { look: [...v.look] }); document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name))); };
setView(q.get('view') || 'front');
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
document.querySelector('#which').textContent = old ? '이전 모델(v1)' : `개선 모델 · 길이 ${BUS.length}m, 폭 ${BUS.width}m, 축거 ${(BUS.axles[0] - BUS.axles[1]).toFixed(1)}m, 바퀴 지름 ${(BUS.wheelRadius * 2).toFixed(2)}m`;
const swap = document.querySelector('#swap'); swap.textContent = old ? '개선 모델 보기' : '이전 모델 보기';
swap.addEventListener('click', () => { const n = new URLSearchParams(window.location.search); if (old) n.delete('bus'); else n.set('bus', 'v1'); window.location.search = n.toString(); });
const spinBtn = document.querySelector('#spin'); let spin = q.has('spin');
spinBtn.setAttribute('aria-pressed', String(spin)); spinBtn.addEventListener('click', () => { spin = !spin; spinBtn.setAttribute('aria-pressed', String(spin)); });
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, az: cam.az, h: cam.h }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (!drag) return; cam.az = drag.az - (e.clientX - drag.x) * 0.3; cam.h = Math.max(0.3, drag.h + (e.clientY - drag.y) * 0.03); });
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.r = Math.min(60, Math.max(3, cam.r * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });

let dist = 0, last = performance.now(), frames = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (canvas.width !== Math.round(W * renderer.getPixelRatio()) || canvas.height !== Math.round(H * renderer.getPixelRatio())) { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(W, H, false); }
  if (spin) dist += dt * 2.2;                                                              // 바퀴만 돌려 본다(이동 거리 ÷ 반지름)
  for (const w of bus.wheels) w.rotation.z = -dist / BUS.wheelRadius;
  const a = (cam.az * Math.PI) / 180;
  camera.position.set(Math.cos(a) * cam.r, cam.h, Math.sin(a) * cam.r); camera.lookAt(cam.look[0], cam.look[1], cam.look[2]);
  camera.aspect = W / H; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  bus.update?.(camera);
  renderer.render(scene, camera);
  frames++; requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__preview = { get frames() { return frames; }, bus, camera, renderer, cam, setView };
