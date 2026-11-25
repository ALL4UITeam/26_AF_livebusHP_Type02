import { createMap, prefersReducedMotion } from '../lib/map.js';
import { LAYOUTS, ROUTE_NAME, ROUTE_HEADING, arrivals, describe } from '../data/route.js';

const CHEV = '<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>';

/**
 * 이용 경험: 휴대폰 화면 하나에서 세 단계가 바뀐다.
 * 왼쪽 단계(탭)를 고르거나, 화면 안의 정류장·버스를 직접 눌러 다음 단계로 간다.
 */
export function initExperience() {
  const tabs = [...document.querySelectorAll('.exp-tab')];
  const panel = document.querySelector('#exp-panel');
  const sheet = panel.querySelector('#phone-sheet');
  const svg = panel.querySelector('#phone-map');

  const map = createMap(svg, LAYOUTS.tall, { scale: 0.9, onStop: (i) => { state.stop = i; go(2, true); } });
  /* 버스 두 대의 예시 위치: 한 대는 운행 중, 한 대는 기점 부근 */
  const busTs = [(map.stopTs[0] + map.stopTs[1]) / 2, 0.1];
  const buses = busTs.map((t) => { const b = map.addBus({ label: ROUTE_NAME }); b.set(t); return b; });

  const state = { step: 1, stop: 2, bus: 0 };
  const list = () => arrivals(map.stops[state.stop].t, busTs, map.stopTs);

  const screens = {
    1: () => `
      <p class="sheet__title">정류장을 선택하세요</p>
      <ul class="sheet__list">
        ${map.stops.map((s) => `<li><button type="button" data-stop="${s.i}"><span class="sheet__dot"></span>${s.name}${CHEV}</button></li>`).join('')}
      </ul>`,
    2: () => `
      <p class="sheet__title"><b>${map.stops[state.stop].name}</b> 정류장 · 도착 예정 버스</p>
      <ul class="sheet__list sheet__list--bus">
        ${list().map((a) => { const d = describe(a); return `<li><button type="button" data-bus="${a.bus}"><span class="route-no">${ROUTE_NAME}</span><span class="sheet__dir">${ROUTE_HEADING}</span><span class="sheet__eta"><b>${d.eta}</b><i>${d.where}</i></span></button></li>`; }).join('')}
      </ul>
      <button type="button" class="sheet__back" data-go="1">정류장 다시 선택</button>`,
    3: () => {
      const a = list().find((x) => x.bus === state.bus) || list()[0];
      const d = describe(a);
      return `
      <p class="sheet__title"><span class="route-no">${ROUTE_NAME}</span> ${ROUTE_HEADING}</p>
      <p class="sheet__big">${d.eta} <small>${d.eta === '곧 도착' ? '' : '뒤 도착 예정'}</small></p>
      <p class="sheet__where"><b>${map.stops[state.stop].name}</b> 정류장 기준 · ${d.where}<br>지도에서 버스의 현재 위치를 확인합니다.</p>
      <button type="button" class="sheet__back" data-go="1">다른 정류장 보기</button>`;
    },
  };

  function paintMap(animate) {
    const stop = map.stops[state.stop];
    const full = map.contain([60, 30, 720, 770]);
    let cam = full;
    if (state.step === 1) {
      map.select(-1); map.highlight(null);
      buses.forEach((b) => b.g.classList.remove('is-tracked'));
    } else {
      const a = (state.step === 3 && list().find((x) => x.bus === state.bus)) || list()[0];
      map.select(state.stop, describe(a).eta);
      buses.forEach((b, i) => b.g.classList.toggle('is-tracked', state.step === 3 && i === a.bus));
      if (state.step === 3) {
        const from = a.waiting ? 0 : a.t;
        map.highlight(from, stop.t, a.waiting);
        const p = map.route.at(Math.max(from, 0.02));
        const x0 = Math.min(p.x, stop.at[0]), x1 = Math.max(p.x, stop.at[0]);
        const y0 = Math.min(p.y, stop.at[1]), y1 = Math.max(p.y, stop.at[1]);
        cam = map.contain([x0 - 200, y0 - 130, x1 - x0 + 330, y1 - y0 + 260]);
      } else {
        map.highlight(null);
      }
    }
    if (animate && !prefersReducedMotion()) map.tween(cam, 700); else map.apply(cam);
    map.resize();
  }

  function go(step, fromPhone = false) {
    const changed = state.step !== step;
    state.step = step;
    tabs.forEach((t, i) => {
      const on = i + 1 === step;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', `exp-tab-${step}`);
    sheet.innerHTML = screens[step]();
    paintMap(changed);
    if (fromPhone) panel.focus({ preventScroll: true }); // 누른 버튼이 사라지므로 화면 전체로 초점을 옮긴다
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => go(i + 1));
    tab.addEventListener('keydown', (e) => {
      const move = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      let to = null;
      if (move) to = (i + move + tabs.length) % tabs.length;
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = tabs.length - 1;
      if (to == null) return;
      e.preventDefault();
      go(to + 1);
      tabs[to].focus();
    });
  });

  sheet.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.stop != null) { state.stop = Number(btn.dataset.stop); go(2, true); }
    else if (btn.dataset.bus != null) { state.bus = Number(btn.dataset.bus); go(3, true); }
    else if (btn.dataset.go) go(Number(btn.dataset.go), true);
  });

  new ResizeObserver(() => paintMap(false)).observe(svg);
  go(1);
}
