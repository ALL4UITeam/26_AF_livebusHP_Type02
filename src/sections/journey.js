import { createMap, el, prefersReducedMotion } from '../lib/map.js';
import { LAYOUTS, ROUTE_NAME, arrivals, describe } from '../data/route.js';

const STOP = 2; // 장면의 기준 정류장: 도서관 앞

/* 스캔되지 않는 QR 안내 그림: 모서리 표식 세 개만 그린다 */
const QR_MARK = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <rect x="6" y="6" width="30" height="30" rx="4"/><rect x="64" y="6" width="30" height="30" rx="4"/><rect x="6" y="64" width="30" height="30" rx="4"/>
  <path d="M52 10v18M52 44h-8M64 52h30M52 60v34M70 70v24M88 70v6M88 88v6"/></svg>`;

const overlays = (eta, where, stopName) => `
  <p class="flag viz__flag">예시 화면</p>

  <div class="ov ov-a">
    <div class="sign">
      <p class="sign__head">${stopName}<small>정류장</small></p>
      <div class="sign__qr">${QR_MARK}</div>
      <p class="sign__cap">정류장 QR 안내<small>안내용 그림 · 스캔되지 않음</small></p>
    </div>
    <span class="ov-a__arrow"></span>
    <div class="webcard">
      <p class="webcard__bar">휴대폰 웹 · 설치 없음</p>
      <div class="webcard__body">
        <span class="route-no">${ROUTE_NAME}</span>
        <p class="webcard__eta">${eta}</p>
        <p class="webcard__where">${where}<span class="webcard__more"> · 지도에서 위치 확인</span></p>
      </div>
    </div>
  </div>

  <div class="ov ov-b">
    <svg class="flowlines" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path d="M42 12.5 C50 12.5 50 50 58 50"/><path d="M42 37.5 C50 37.5 50 50 58 50"/>
      <path d="M42 62.5 C50 62.5 50 50 58 50"/><path d="M42 87.5 C50 87.5 50 50 58 50"/>
      <path d="M56 50 H72"/>
    </svg>
    <ul class="inputs">
      <li><b>위치정보</b><span>RTK 기반 초정밀</span></li>
      <li><b>교통상황</b></li>
      <li><b>날씨</b></li>
      <li><b>운행 데이터</b></li>
    </ul>
    <p class="node">AI<br>분석</p>
    <p class="output"><span>도착 정보</span><b>${eta}</b><small>${stopName} 기준 · 예시</small></p>
  </div>

  <div class="ov ov-c">
    <dl class="ops">
      <div><dt>운행 현황</dt><dd><b>3대</b>운행 중</dd></div>
      <div class="is-warn"><dt>단말 유지보수</dt><dd><b>1건</b>점검 필요</dd></div>
      <div><dt>운행 통계</dt><dd class="bars"><i style="--h:46%"></i><i style="--h:72%"></i><i style="--h:58%"></i><i style="--h:88%"></i><i style="--h:64%"></i><i style="--h:100%"></i><i style="--h:38%"></i></dd></div>
    </dl>
  </div>`;

/** 지도 한 장을 만들고, 장면(a·b·c)에 따라 시점을 옮긴다 */
function createViz(root) {
  const svg = el('svg');
  root.appendChild(svg);
  const map = createMap(svg, LAYOUTS.wide);
  const stop = map.stops[STOP];

  /* 버스: 기준 정류장의 한 정류장 앞 구간에 있다 */
  const busT = (map.stopTs[STOP - 1] + stop.t) / 2 + 0.01;
  const next = arrivals(stop.t, [busT], map.stopTs)[0];
  const text = describe(next);
  const bus = map.addBus({ label: ROUTE_NAME });
  const busAt = bus.set(busT);
  root.insertAdjacentHTML('beforeend', overlays(text.eta, text.where, stop.name));

  /* A: 내가 서 있는 정류장 */
  const a = map.mark(map.under, stop.at[0], stop.at[1], 'sc sc-a');
  el('circle', { class: 'sc-here', r: 30 }, a);

  /* B: 위치 신호 */
  const b = map.mark(map.under, busAt.x, busAt.y, 'sc sc-b');
  el('circle', { class: 'sc-reticle sc-reticle--ring', r: 46 }, b);
  el('circle', { class: 'sc-reticle', r: 30 }, b);
  el('path', { class: 'sc-reticle', d: 'M-58 0H-36M36 0H58M0 -58V-36M0 36V58' }, b);
  [0.022, 0.04, 0.056].forEach((back, i) => {
    const p = map.route.at(busT - back);
    const dot = map.mark(map.under, p.x, p.y, 'sc sc-b');
    el('circle', { class: 'sc-trail', r: 4 - i, opacity: 0.9 - i * 0.25 }, dot);
  });

  /* C: 다른 버스들과 정류장 단말 */
  const extra = [0.2, 0.86].map((t) => { const x = map.addBus({ cls: 'sc sc-c' }); x.set(t); return x; });
  map.stops.forEach((s, i) => {
    const g = map.mark(map.over, s.at[0], s.at[1], `sc sc-c sc-device${i === 3 ? ' is-warn' : ''}`);
    el('rect', { x: 12, y: -30, width: 16, height: 18, rx: 3 }, g);
    el('path', { d: 'M16 -24h8M16 -19h5' }, g);
  });

  const cameras = {
    a: () => map.frame({ p: stop.at, at: [0.58, 0.27], span: 560 }),
    b: () => map.frame({ p: [busAt.x, busAt.y], at: [0.5, 0.21], span: 600 }),
    c: () => map.contain([0, 110, 1560, 760], [0.5, 0.12]),
  };

  let scene = root.dataset.scene || 'a';
  const set = (name, animate) => {
    scene = name;
    root.dataset.scene = name;
    if (name === 'c') { map.select(-1); map.highlight(null); }
    else { map.select(STOP, text.eta); map.highlight(busT, stop.t); }
    bus.g.classList.toggle('is-tracked', name !== 'c');
    const cam = cameras[name]();
    if (animate && !prefersReducedMotion()) map.tween(cam, 1000); else map.apply(cam);
  };

  new ResizeObserver(() => { if (svg.clientWidth) { map.apply(cameras[scene]()); map.resize(); } }).observe(root);
  set(scene, false);
  return { set, extra };
}

export function initJourney() {
  const section = document.querySelector('.journey');
  const stage = section.querySelector('#journey-viz');
  const steps = [...section.querySelectorAll('.step')];
  const index = [...section.querySelectorAll('.journey__index li')];
  const desktop = window.matchMedia('(min-width: 1100px)');
  let main = null;
  let inlineDone = false;

  const activate = (name) => {
    steps.forEach((s) => s.classList.toggle('is-active', s.dataset.scene === name));
    index.forEach((li) => li.classList.toggle('is-active', li.dataset.scene === name));
    if (main && stage.dataset.scene !== name) main.set(name, true);
  };

  /* 넓은 화면: 지도는 화면에 머물고, 글을 읽어 내려가면 시점이 바뀐다(스크롤은 건드리지 않는다) */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) activate(e.target.dataset.scene);
  }, { rootMargin: '-45% 0px -45% 0px' });

  const setup = () => {
    if (desktop.matches) {
      if (!main) { main = createViz(stage); steps.forEach((s) => io.observe(s)); activate(stage.dataset.scene); }
    } else if (!inlineDone) {
      inlineDone = true;
      /* 좁은 화면: 장면마다 그림을 따로 두어 차례로 읽는다 */
      section.querySelectorAll('.viz--inline').forEach((v) => createViz(v));
    }
  };
  setup();
  desktop.addEventListener('change', setup);
}
