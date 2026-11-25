import { track } from '../lib/motion.js';
import { addScene } from '../lib/scroll-scene.js';

/**
 * 첫 장면: Figma 1:331(p=0) → 1:366(p≈0.72, 이후 잠시 머묾)
 * 모든 값은 1920×1080 시안 픽셀 단위. CSS 가 var(--u) 로 화면에 맞춰 키운다.
 */
const T = {
  bus: track([[0, 683], [0.72, -667]]),        // 1:333 top 683 → 1:369 top -667
  shadow: track([[0, 819], [0.72, -431]]),     // 1:332 top 819 → 1:368 top -431
  titleO: track([[0, 1], [0.2, 0]]),
  titleY: track([[0, 0], [0.2, -70]]),
  titleBlur: track([[0, 0], [0.2, 8]]),
  hintO: track([[0, 1], [0.1, 0]]),
  sideO: track([[0.3, 0], [0.52, 1]]),
  sideX: track([[0.3, 80], [0.55, 0]]),
  subO: track([[0.36, 0], [0.6, 1]]),
  subY: track([[0.36, 24], [0.6, 0]]),
  sumO: track([[0.46, 0], [0.7, 1]]),
  sumY: track([[0.46, 40], [0.7, 0]]),
};
export const INTRO_SETTLED = 0.72;

const set = (el, props) => { for (const k in props) el.style.setProperty(k, props[k]); };

export function initIntro(section, enabled) {
  const $ = (s) => section.querySelector(s);
  const bus = $('.intro__bus');
  const shadow = $('.intro__shadow');
  const title = $('.intro__title');
  const hint = $('.scroll-hint');
  const left = $('.intro__side--left');
  const right = $('.intro__side--right');
  const subs = section.querySelectorAll('.intro__sub');
  const summary = $('.intro__summary');

  const render = (p) => {
    set(bus, { '--ty': T.bus(p) - 683 });
    set(shadow, { '--ty': T.shadow(p) - 819 });
    set(title, { '--o': T.titleO(p), '--ty': T.titleY(p), '--blur': `${T.titleBlur(p)}px` });
    const ho = T.hintO(p);
    set(hint, { '--o': ho });
    hint.inert = ho < 0.05;
    const so = T.sideO(p), sx = T.sideX(p);
    set(left, { '--o': so, '--tx': -sx });
    set(right, { '--o': so, '--tx': sx });
    subs.forEach((s) => set(s, { '--o': T.subO(p), '--ty': T.subY(p) }));
    set(summary, { '--o': T.sumO(p), '--ty': T.sumY(p) });
    section.classList.toggle('is-moving', p > 0.005);
  };

  const scene = addScene(section, render, enabled);

  hint.addEventListener('click', () => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const top = enabled() ? scene.scrollYFor(INTRO_SETTLED) : section.querySelector('.intro__side').getBoundingClientRect().top + scrollY - 120;
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  });

  return scene;
}
