import { track, reducedMotion } from '../lib/motion.js';
import { addScene } from '../lib/scroll-scene.js';
import { serviceCard, bindCardMedia } from '../components/service-card.js';

/**
 * 도로 장면: Figma 1:180(p=0) → 1:187(K1) → 1:230(K2) → 1:279(K3, 이후 잠시 머묾)
 * 0→K1 은 화면 전체가 한 번 스크롤되듯 같은 거리(926px)만큼 올라가고,
 * 그다음부터 버스는 도로를 따라 내려가고 카드는 열마다 다른 속도로 올라간다.
 */
const K1 = 0.26, K2 = 0.58, K3 = 0.9;
const LIFT = 926;           // 1:180 버스 top 764.68 → 1:187 top -162.27
const GAP = 390;            // 카드 간격(240 + 150)

const lift = track([[0, LIFT], [K1, 0]]);
const T = {
  flowO: track([[0, 1], [0.14, 0]]),
  bus: track([[K1, -162.27], [K2, 237.73], [K3, 917.73]]),
  shadowOff: track([[K1, 17.69], [K2, 8.8]]),
  left: track([[K1, 350], [K2, 100], [K3, -490]]),
  right: track([[K1, 600], [K2, 275], [K3, 150]]),
  roadO: track([[0.02, 0], [0.2, 1]]),
  gra: track([[0, 0], [K1, 1], [K2, 0]]),
  black: track([[K1, 0], [K2, 1]]),
  topGra: track([[K2, 0], [K3, 1]]),
};

const set = (el, props) => { for (const k in props) el.style.setProperty(k, props[k]); };

/** 장면 상태 계산(렌더와 포커스 이동이 같이 씀) */
function state(p) {
  if (p < K1) {
    const l = lift(p); // LIFT → 0
    return { lift: l, bus: -162.27 + l, left: 350 + l, right: 600 + l };
  }
  return { lift: 0, bus: T.bus(p), left: T.left(p), right: T.right(p) };
}

export async function initDrive(section, enabled, loadServices) {
  const $ = (s) => section.querySelector(s);
  const sticky = $('.sticky');
  const flow = $('.flow');
  const bus = $('.road-bus');
  const road = $('.road');
  const cards = $('.cards');

  const render = (p) => {
    const s = state(p);
    set(flow, { '--o': T.flowO(p), '--ty': s.lift - LIFT });
    set(bus, { '--ty': s.bus - 764.68, '--shadow': T.shadowOff(p) });
    set(road, { '--o': T.roadO(p), '--ty': s.lift });
    set(sticky, { '--gra': T.gra(p), '--black': T.black(p), '--topgra': T.topGra(p) });
    set(cards, { '--yl': s.left, '--yr': s.right });
    flow.inert = p > 0.2;
  };

  const scene = addScene(section, render, enabled);

  // 좁은 화면: 도로가 소개 문구 아래에서부터 서서히 나타나도록 시작 위치를 알려 준다
  const placeRoad = () => {
    const start = flow.getBoundingClientRect().bottom - sticky.getBoundingClientRect().top;
    road.style.setProperty('--road-start', `${Math.max(0, Math.round(start - 24))}px`);
  };
  new ResizeObserver(placeRoad).observe(flow);

  // ── 카드 목록: 로딩 → (빈 목록 | 오류 | 카드) ──
  const stateMsg = cards.querySelector('.cards__state');
  try {
    const list = await loadServices();
    if (!list.length) {
      stateMsg.dataset.state = 'empty';
      stateMsg.textContent = '등록된 서비스가 없습니다.';
    } else {
      // 화면에 나타나는 순서(위→아래)대로 DOM 을 놓아 Tab 순서가 자연스럽게
      const ordered = [...list].sort((a, b) =>
        (a.index * GAP + (a.column === 'left' ? 350 : 600)) - (b.index * GAP + (b.column === 'left' ? 350 : 600)));
      cards.innerHTML = ordered.map((it, i) => serviceCard(it, i)).join('');
      bindCardMedia(cards);
    }
  } catch (err) {
    console.error(err);
    stateMsg.dataset.state = 'error';
    stateMsg.innerHTML = '서비스 목록을 불러오지 못했습니다. <button type="button" class="link-btn">다시 시도</button>';
    stateMsg.querySelector('button').addEventListener('click', () => location.reload());
  }
  cards.classList.add('is-ready');

  // ── 키보드: 고정 장면 안 카드에 포커스가 가면 그 카드가 화면 가운데 오는 지점으로 스크롤 ──
  cards.addEventListener('focusin', (e) => {
    const card = e.target.closest('.card');
    if (!card || !enabled()) return;
    const i = Number(card.style.getPropertyValue('--i'));
    const col = card.dataset.col;
    const want = 540 - 120; // 카드(240) 중앙이 화면(1080) 중앙
    let best = K1, bestD = Infinity;
    for (let p = K1; p <= K3; p += 0.004) {
      const y = state(p)[col] + i * GAP;
      const d = Math.abs(y - want);
      if (d < bestD) { bestD = d; best = p; }
    }
    window.scrollTo({ top: scene.scrollYFor(best), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  });

  return scene;
}
