import { clamp, damp, reducedMotion } from './motion.js';

/**
 * 스크롤 고정(sticky) 장면 엔진.
 * section 의 스크롤 구간을 0→1 progress 로 바꿔 render(p) 에 넘긴다.
 * 손으로 굴린 스크롤을 살짝 따라오게(관성) 감쇠하고, 다 따라오면 rAF 를 멈춘다.
 * reduced-motion 이면 감쇠 없이 바로 맞춘다.
 */
const scenes = new Set();
let raf = 0;
let last = 0;
const TAU = 110; // ms. 클수록 묵직하게 따라온다

function measure(scene) {
  const r = scene.el.getBoundingClientRect();
  const range = scene.el.offsetHeight - window.innerHeight;
  scene.target = range > 0 ? clamp(-r.top / range) : 0;
}

function frame(now) {
  const dt = Math.min(64, now - (last || now));
  last = now;
  let moving = false;
  for (const s of scenes) {
    if (!s.enabled()) continue;
    const next = reducedMotion.matches ? s.target : damp(s.p, s.target, TAU, dt);
    const settled = Math.abs(next - s.target) < 0.0002;
    s.p = settled ? s.target : next;
    if (s.p !== s.drawn) { s.render(s.p); s.drawn = s.p; }
    if (!settled) moving = true;
  }
  raf = moving ? requestAnimationFrame(frame) : 0;
  if (!raf) last = 0;
}

export function kick() {
  for (const s of scenes) if (s.enabled()) measure(s);
  if (!raf) raf = requestAnimationFrame(frame);
}

export function addScene(el, render, enabled = () => true) {
  const s = { el, render, enabled, p: 0, target: 0, drawn: -1 };
  scenes.add(s);
  measure(s);
  s.p = s.target; // 새로고침 위치에서 바로 맞춰 시작
  render(s.p);
  s.drawn = s.p;
  return {
    /** 이 장면의 progress p 가 되는 문서 스크롤 위치 */
    scrollYFor(p) {
      const top = el.getBoundingClientRect().top + window.scrollY;
      return top + p * (el.offsetHeight - window.innerHeight);
    },
    refresh() { s.drawn = -1; measure(s); s.p = s.target; render(s.p); s.drawn = s.p; },
  };
}

window.addEventListener('scroll', kick, { passive: true });
window.addEventListener('resize', kick);
