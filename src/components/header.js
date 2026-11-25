import { navLeft, navRight } from '../data/nav.js';
import logoUrl from '../assets/icons/logo.svg';

const link = ({ label, href }) =>
  href
    ? `<a class="nav-link" href="${href}">${label}</a>`
    : `<a class="nav-link" href="#" data-pending="${label}">${label}</a>`;

/**
 * 고정 헤더 (Figma 1:334)
 * - 맨 위에서는 시안 그대로 투명 배경.
 * - 내려가면 숨고(1:366 처럼 헤더 없음), 위로 올리면 반투명 배경으로 다시 나타난다.
 * - 아래 장면 색에 맞춰 글자색이 바뀐다(data-theme: light | dark).
 */
export function mountHeader(el) {
  el.innerHTML = `
    <nav class="nav nav--left" aria-label="제품 메뉴">${navLeft.map(link).join('')}</nav>
    <a class="brand" href="#top" aria-label="AI LIVEBUS 처음으로"><img src="${logoUrl}" alt="" width="109.501" height="30"></a>
    <nav class="nav nav--right" aria-label="고객 메뉴">${navRight.map(link).join('')}</nav>`;

  el.querySelector('.brand').addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    el.querySelector('.brand').blur();
  });

  let lastY = window.scrollY;
  let ticking = false;
  const themeTargets = [...document.querySelectorAll('[data-header-theme]')];

  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const dy = y - lastY;
    const atTop = y < 8;
    el.classList.toggle('is-scrolled', !atTop);
    // 6px 이상 움직였을 때만 방향을 바꿔 떨림 방지. 포커스가 헤더 안에 있으면 숨기지 않는다.
    if (atTop) el.classList.remove('is-hidden');
    else if (dy > 6 && !el.contains(document.activeElement)) el.classList.add('is-hidden');
    else if (dy < -6) el.classList.remove('is-hidden');
    if (Math.abs(dy) > 6 || atTop) lastY = y;

    // 헤더 높이 중앙 아래에 있는 장면의 테마를 따른다
    const probe = el.offsetHeight / 2;
    let theme = 'light';
    for (const t of themeTargets) {
      const r = t.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) theme = t.dataset.headerThemeNow || t.dataset.headerTheme;
    }
    el.dataset.theme = theme;
  };

  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  el.addEventListener('focusin', () => el.classList.remove('is-hidden'));
  update();
  return { update };
}
