import { REGIONS } from '../data/site.js';

const EXT = '<svg class="ext" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2h6v6M10 2 2.5 9.5" /></svg>';

/** 헤더: 스크롤 배경, '버스 위치 확인' 지역 목록, 모바일 메뉴, 현재 구간 표시 */
export function initHeader() {
  const header = document.querySelector('.site-header');
  const gnb = header.querySelector('.gnb');
  const menuBtn = header.querySelector('.menu-btn');
  const regionBtn = header.querySelector('.region__btn');
  const regionMenu = header.querySelector('.region__menu');

  /* 스크롤하면 배경을 채운다 */
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* 지역 목록은 data/site.js 의 REGIONS 로 채운다 */
  regionMenu.querySelector('.region__list').innerHTML = REGIONS.map(
    (r) => `<li><a href="${r.url}" target="_blank" rel="noopener"><strong>${r.name}</strong><span>${r.host}</span>${EXT}<span class="sr-only">(새 창)</span></a></li>`,
  ).join('');

  const setRegion = (open, focusBtn = false) => {
    regionBtn.setAttribute('aria-expanded', String(open));
    regionMenu.hidden = !open;
    if (open) setMenu(false);
    if (!open && focusBtn) regionBtn.focus();
  };
  regionBtn.addEventListener('click', () => {
    const open = regionBtn.getAttribute('aria-expanded') !== 'true';
    setRegion(open);
    if (open) regionMenu.querySelector('a')?.focus({ preventScroll: true });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.region')) setRegion(false);
  });
  header.querySelector('.region').addEventListener('focusout', (e) => {
    if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setRegion(false);
  });

  /* 모바일 메뉴 */
  const setMenu = (open) => {
    header.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    document.documentElement.style.overflow = open ? 'hidden' : '';
  };
  menuBtn.addEventListener('click', () => {
    const open = menuBtn.getAttribute('aria-expanded') !== 'true';
    if (open) setRegion(false);
    setMenu(open);
  });
  gnb.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  window.matchMedia('(min-width: 900px)').addEventListener('change', () => setMenu(false));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (regionBtn.getAttribute('aria-expanded') === 'true') setRegion(false, true);
    else if (menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); }
  });

  /* 지금 보고 있는 구간을 메뉴에 표시 */
  const links = [...gnb.querySelectorAll('a')];
  const targets = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
      const current = targets.find((t) => visible.has(t));
      links.forEach((a) => {
        if (current && a.getAttribute('href') === `#${current.id}`) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach((t) => io.observe(t));
  }
}
