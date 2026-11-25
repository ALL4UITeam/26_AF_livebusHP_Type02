import { createMap, prefersReducedMotion } from '../lib/map.js';
import { LAYOUTS, ROUTE_NAME, arrivals, describe } from '../data/route.js';

const TRIP_SECONDS = 84; // 화면에서 버스가 기점 → 종점까지 가는 시간(예시 연출)

/**
 * 첫 화면의 서비스 체험.
 * 버스 두 대가 노선을 따라 움직이고, 정류장을 고르면 가장 먼저 도착할 버스까지의 구간과 도착 정보가 바뀐다.
 * 모든 값은 버스의 화면 속 위치로 계산한 예시다.
 */
export function initHero() {
  const hero = document.querySelector('.hero');
  const svg = hero.querySelector('#hero-map');
  const list = hero.querySelector('#demo-stops');
  const line = hero.querySelector('.demo__line');
  const lineBus = hero.querySelector('.demo__bus');
  const live = hero.querySelector('#demo-live');
  const pauseBtn = hero.querySelector('#demo-pause');
  const wide = window.matchMedia('(min-width: 1200px)');

  let map, buses, layoutKey;
  let selected = 2;
  let busTs = [0.3, 0.8];
  let lastKey = '';
  let rowY = [];
  let paused = prefersReducedMotion();
  let inView = true;
  let raf = 0, prev = 0;

  /* 정류장 선택 버튼(키보드·터치용). 지도 위 정류장을 눌러도 같은 동작을 한다 */
  list.innerHTML = LAYOUTS.wide.stops
    .map((s, i) => `<li><button type="button" class="demo-stop" data-i="${i}" aria-pressed="false"><span class="demo-stop__name">${s.name}</span><span class="demo-stop__eta"><b></b><i></i></span></button></li>`)
    .join('');
  const rows = [...list.querySelectorAll('.demo-stop')];
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.demo-stop');
    if (btn) select(Number(btn.dataset.i), true);
  });

  function build() {
    layoutKey = wide.matches ? 'wide' : 'tall';
    map = createMap(svg, LAYOUTS[layoutKey], {
      fade: layoutKey === 'wide' ? [240, 180, 980, 740, 0.34] : null,
      onStop: (i) => select(i, true),
    });
    buses = busTs.map(() => map.addBus({ label: ROUTE_NAME }));
    camera();
    lastKey = '';
    render();
  }

  function camera() {
    const w = svg.clientWidth, h = svg.clientHeight;
    if (!w || !h) return;
    if (layoutKey === 'wide') {
      const s = h / 900; // 높이를 기준으로 맞추고, 남는 폭은 오른쪽 지도로 채운다
      map.apply({ x: 0, y: 0, w: w / s, h: 900 });
    } else {
      map.apply(map.contain([0, 0, 800, 820]));
    }
    map.resize();
    measureRows();
  }

  function measureRows() {
    rowY = rows.map((r) => r.offsetTop + r.offsetHeight / 2); // .demo__line 기준
  }

  /** 패널의 세로 노선도에서 버스 위치 */
  function lineY(t) {
    const ts = [0, ...map.stopTs, 1];
    const ys = [rowY[0] - 26, ...rowY, rowY[rowY.length - 1] + 26];
    for (let i = 1; i < ts.length; i++) {
      if (t <= ts[i]) return ys[i - 1] + ((t - ts[i - 1]) / (ts[i] - ts[i - 1] || 1)) * (ys[i] - ys[i - 1]);
    }
    return ys[ys.length - 1];
  }

  function render() {
    busTs.forEach((t, i) => buses[i].set(t));
    const stop = map.stops[selected];
    const next = arrivals(stop.t, busTs, map.stopTs)[0];
    const text = describe(next);

    if (next.waiting) map.highlight(0, stop.t, true);
    else map.highlight(next.t, stop.t, false);
    buses.forEach((b, i) => b.g.classList.toggle('is-tracked', i === next.bus));
    lineBus.style.transform = `translateY(${lineY(next.t).toFixed(1)}px)`;

    const key = `${layoutKey}|${selected}|${text.eta}|${text.where}`;
    if (key === lastKey) return;
    lastKey = key;
    map.select(selected, text.eta);
    rows.forEach((row, i) => {
      const on = i === selected;
      row.setAttribute('aria-pressed', String(on));
      row.classList.toggle('is-soon', on && text.soon);
      if (on) {
        row.querySelector('b').textContent = text.eta;
        row.querySelector('i').textContent = text.where;
      }
    });
    measureRows();
  }

  function select(i, announce) {
    selected = i;
    lastKey = '';
    render();
    if (announce) {
      const stop = map.stops[i];
      const text = describe(arrivals(stop.t, busTs, map.stopTs)[0]);
      live.textContent = `${stop.name} 정류장, ${ROUTE_NAME} ${text.eta}, ${text.where}. 예시 데이터입니다.`;
    }
  }

  function tick(now) {
    const dt = Math.min(0.1, (now - prev) / 1000);
    prev = now;
    busTs = busTs.map((t) => (t + dt / TRIP_SECONDS) % 1);
    render();
    raf = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(raf);
    if (!paused && inView && !document.hidden) { prev = performance.now(); raf = requestAnimationFrame(tick); }
  }

  /* 움직임 멈춤·재생 */
  pauseBtn.hidden = false;
  const paintPause = () => {
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.querySelector('.demo__pause-label').textContent = paused ? '재생' : '멈춤';
    pauseBtn.setAttribute('aria-label', paused ? '버스 움직임 재생' : '버스 움직임 멈춤');
  };
  pauseBtn.addEventListener('click', () => { paused = !paused; paintPause(); sync(); });
  paintPause();

  build();
  wide.addEventListener('change', build);
  new ResizeObserver(() => { camera(); lastKey = ''; render(); }).observe(svg);
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }).observe(hero);
  document.addEventListener('visibilitychange', sync);
  document.fonts?.ready.then(() => { map.resize(); measureRows(); });
  sync();
}
