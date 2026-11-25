import './style.css';
import { mountHeader } from './components/header.js';
import { bindPendingLinks } from './components/toast.js';
import { initIntro } from './scenes/intro.js';
import { initDrive } from './scenes/drive.js';
import { fetchServices } from './data/services.js';
import { kick } from './lib/scroll-scene.js';

// 데스크톱(1200px 이상)에서만 스크롤 고정 연출. 그보다 좁으면 세로로 쌓인 레이아웃 + 등장 효과.
const desktop = window.matchMedia('(min-width: 1200px)');
const enabled = () => desktop.matches;

const root = document.documentElement;
const header = mountHeader(document.querySelector('.site-header'));
bindPendingLinks();

const intro = initIntro(document.querySelector('.intro'), enabled);
const drivePromise = initDrive(document.querySelector('.drive'), enabled, fetchServices);

// 좁은 화면: 처음 보일 때 한 번만 살짝 떠오르기
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -10% 0px' });
const observeReveal = () => document.querySelectorAll('[data-reveal], .card').forEach((el) => io.observe(el));
drivePromise.then((drive) => {
  observeReveal();
  desktop.addEventListener('change', () => { intro.refresh(); drive.refresh(); header.update(); kick(); });
});

// 첫 로드: 이미지·글꼴이 준비되면 헤더 → 제목 → SCROLL → 버스 순으로 등장. 실패해도 1.2초 뒤엔 무조건 보여 준다.
const heroImg = document.querySelector('.intro__bus img');
const ready = Promise.race([
  Promise.all([
    heroImg.decode ? heroImg.decode().catch(() => {}) : Promise.resolve(),
    document.fonts ? document.fonts.ready : Promise.resolve(),
  ]),
  new Promise((r) => setTimeout(r, 1200)),
]);
ready.then(() => {
  requestAnimationFrame(() => {
    root.classList.add('intro-play');
    root.classList.remove('intro-pending');
    setTimeout(() => root.classList.remove('intro-play'), 1800);
  });
});
