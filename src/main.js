import './style.css';
import { initHeader } from './sections/header.js';
import { initHero } from './sections/hero.js';
import { initJourney } from './sections/journey.js';
import { initExperience } from './sections/experience.js';
import { initInquiry } from './sections/inquiry.js';

/* 한 구간이 실패해도 나머지는 동작하도록 따로 실행한다 */
for (const init of [initHeader, initHero, initJourney, initExperience, initInquiry]) {
  try { init(); } catch (err) { console.error(err); }
}

/* 처음 보일 때 한 번만 살짝 떠오르기. 내용은 스크립트 없이도 그대로 읽힌다 */
const targets = document.querySelectorAll('.sec-head, .exp__tabs, .exp__device, .access__item, .chain__item, .case__sign, .facts, .ask, .memo, .closing h2, .closing__cta');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  targets.forEach((t) => { t.classList.add('reveal'); io.observe(t); });
}
