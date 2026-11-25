/**
 * SVG 노선 지도 그리기.
 * 같은 노선 데이터(src/data/route.js)를 첫 화면, '세 가지 시점', 휴대폰 체험이 함께 쓴다.
 *
 * - 도로·노선의 굵기는 지도 단위(확대하면 함께 굵어진다).
 * - 정류장·버스·글자는 화면 px 기준. 각 요소를 scale(var(--k)) 로 그려 확대·축소해도 크기가 같다.
 *   --k = 지도 단위 / 화면 1px
 */

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

export function el(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

const r1 = (n) => Math.round(n * 10) / 10;

function catmull(p0, p1, p2, p3, u) {
  const u2 = u * u, u3 = u2 * u;
  const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

/** 점들을 부드러운 곡선으로 잇고, 길이 비율(0~1)로 위치를 찾을 수 있게 한다. */
export function spline(points, { per = 18, closed = false } = {}) {
  const P = points, n = P.length, pts = [];
  const get = (i) => (closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < per; j++) pts.push(catmull(get(i - 1), get(i), get(i + 1), get(i + 2), j / per));
  }
  pts.push(closed ? pts[0] : P[n - 1]);

  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];

  const locate = (t) => {
    const target = Math.max(0, Math.min(1, t)) * total;
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= target) lo = mid; else hi = mid; }
    const span = cum[hi] - cum[lo] || 1;
    return { i: lo, f: (target - cum[lo]) / span };
  };
  const at = (t) => {
    const { i, f } = locate(t);
    const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)];
    return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
  };
  const d = (t0 = 0, t1 = 1) => {
    if (t1 <= t0) return '';
    const a = locate(t0), b = locate(t1), s = at(t0), e = at(t1);
    let out = `M${r1(s.x)} ${r1(s.y)}`;
    for (let i = a.i + 1; i <= b.i; i++) out += `L${r1(pts[i][0])} ${r1(pts[i][1])}`;
    return `${out}L${r1(e.x)} ${r1(e.y)}${closed && t0 === 0 && t1 === 1 ? 'Z' : ''}`;
  };
  const nearest = (x, y) => {
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const dd = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (dd < bd) { bd = dd; best = i; } });
    return cum[best] / total;
  };
  return { at, d, nearest, total };
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * @param {SVGSVGElement} svg
 * @param {object} layout  LAYOUTS.wide | LAYOUTS.tall
 * @param {object} [opts]  { fade: [x1,y1,x2,y2,min], onStop(i), scale: 표식 크기 배율 }
 */
export function createMap(svg, layout, opts = {}) {
  const id = `m${++uid}`;
  svg.textContent = '';
  svg.classList.add('map');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');

  const route = spline(layout.route);
  const stops = layout.stops.map((s, i) => ({ ...s, i, t: route.nearest(s.at[0], s.at[1]) }));
  const stopTs = stops.map((s) => s.t);

  /* 바탕: 땅, 물, 녹지, 도로 */
  el('rect', { class: 'map-land', x: -4000, y: -4000, width: 9600, height: 9600 }, svg);
  const base = el('g', { class: 'map-base' }, svg);
  if (opts.fade) {
    const [x1, y1, x2, y2, min] = opts.fade;
    const defs = el('defs', {}, svg);
    const grad = el('linearGradient', { id: `${id}-g`, gradientUnits: 'userSpaceOnUse', x1, y1, x2, y2 }, defs);
    el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': min }, grad);
    el('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 1 }, grad);
    const mask = el('mask', { id: `${id}-m`, maskUnits: 'userSpaceOnUse', x: -4000, y: -4000, width: 9600, height: 9600 }, defs);
    el('rect', { x: -4000, y: -4000, width: 9600, height: 9600, fill: `url(#${id}-g)` }, mask);
    base.setAttribute('mask', `url(#${id}-m)`);
  }
  for (const park of layout.parks) el('path', { class: 'map-park', d: spline(park, { closed: true, per: 10 }).d() }, base);
  el('path', { class: 'map-water', d: spline(layout.water).d(), 'stroke-width': layout.waterWidth }, base);
  const roadD = [...layout.roads.map((r) => spline(r, { per: 10 }).d()), route.d()].join('');
  const minorD = layout.minor.map((r) => spline(r, { per: 10 }).d()).join('');
  el('path', { class: 'map-road-case', d: minorD, 'stroke-width': layout.roadWidth * 0.55 + 3 }, base);
  el('path', { class: 'map-road-case', d: roadD, 'stroke-width': layout.roadWidth + 3 }, base);
  el('path', { class: 'map-road', d: minorD, 'stroke-width': layout.roadWidth * 0.55 }, base);
  el('path', { class: 'map-road', d: roadD, 'stroke-width': layout.roadWidth }, base);

  /* 노선 */
  el('path', { class: 'map-route-case', d: route.d(), 'stroke-width': layout.routeWidth + 6 }, svg);
  el('path', { class: 'map-route', d: route.d(), 'stroke-width': layout.routeWidth }, svg);
  const halo = el('path', { class: 'map-hl-halo', 'stroke-width': layout.routeWidth * 3.4 }, svg);
  const hl = el('path', { class: 'map-hl', 'stroke-width': layout.routeWidth * 1.5 }, svg);
  const flow = el('path', { class: 'map-hl-flow', 'stroke-width': layout.routeWidth * 0.36 }, svg);

  const under = el('g', { class: 'map-under' }, svg);   // 장면별 요소(정류장 아래)
  const stopLayer = el('g', { class: 'map-stops' }, svg);
  const busLayer = el('g', { class: 'map-buses' }, svg);
  const over = el('g', { class: 'map-over' }, svg);     // 장면별 요소(맨 위)

  /** 화면 px 기준으로 그리는 그룹 */
  const mark = (parent, x, y, cls) => {
    const g = el('g', { class: cls }, parent);
    g.style.transform = `translate(${r1(x)}px, ${r1(y)}px) scale(var(--k, 1))`;
    return g;
  };

  /* 정류장 */
  const stopEls = stops.map((s) => {
    const g = mark(stopLayer, s.at[0], s.at[1], 'map-stop');
    g.dataset.i = s.i;
    el('circle', { class: 'map-stop__hit', r: 22 }, g);
    el('circle', { class: 'map-stop__ping', r: 11 }, g);
    el('circle', { class: 'map-stop__ring', r: 8.5 }, g);
    const [dx, dy, anchor] = s.label;
    const name = el('text', { class: 'map-stop__name', x: dx, y: dy, 'text-anchor': anchor, 'dominant-baseline': 'central' }, g);
    name.textContent = s.name;
    const tag = el('g', { class: 'map-stop__tag' }, g);
    const pill = el('rect', { rx: 6, height: 28, y: dy - 14 }, tag);
    const tagText = el('text', { x: dx, y: dy, 'text-anchor': anchor, 'dominant-baseline': 'central' }, tag);
    if (opts.onStop) g.addEventListener('click', () => opts.onStop(s.i));
    return { g, name, pill, tagText, dx, anchor, s };
  });

  let selected = -1;
  const sizeTag = (se) => {
    let w = 0;
    try { w = se.tagText.getComputedTextLength(); } catch { /* 아직 그려지지 않음 */ }
    if (!w) w = se.tagText.textContent.length * 12;
    const pad = 10;
    const x = se.anchor === 'middle' ? se.dx - w / 2 : se.anchor === 'end' ? se.dx - w : se.dx;
    se.pill.setAttribute('x', r1(x - pad));
    se.pill.setAttribute('width', r1(w + pad * 2));
  };
  const select = (i, eta) => {
    selected = i;
    stopEls.forEach((se) => se.g.classList.toggle('is-selected', se.s.i === i));
    if (i >= 0) setEta(eta);
  };
  const setEta = (eta) => {
    const se = stopEls[selected];
    if (!se) return;
    const text = eta ? `${se.s.name} · ${eta}` : se.s.name;
    if (se.tagText.textContent !== text) { se.tagText.textContent = text; sizeTag(se); }
  };

  /* 강조 구간 */
  const highlight = (t0, t1, waiting = false) => {
    const d = t0 == null ? '' : route.d(t0, t1);
    halo.setAttribute('d', d); hl.setAttribute('d', d); flow.setAttribute('d', d);
    svg.classList.toggle('is-waiting', waiting);
  };

  /* 버스 */
  const addBus = ({ label, cls = '' } = {}) => {
    const g = el('g', { class: `map-bus ${cls}` }, busLayer);
    const spin = el('g', {}, g);
    el('circle', { class: 'map-bus__ping', r: 20 }, g);
    g.appendChild(spin);
    el('rect', { class: 'map-bus__body', x: -19, y: -10, width: 38, height: 20, rx: 7 }, spin);
    el('rect', { class: 'map-bus__roof', x: -13, y: -5.5, width: 17, height: 11, rx: 3 }, spin);
    el('rect', { class: 'map-bus__glass', x: 9, y: -6.5, width: 5, height: 13, rx: 2 }, spin);
    let tagG = null;
    if (label) {
      tagG = el('g', { class: 'map-bus__tag' }, g);
      el('rect', { x: -27, y: -42, width: 54, height: 22, rx: 5 }, tagG);
      const tx = el('text', { x: 0, y: -31, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, tagG);
      tx.textContent = label;
    }
    const set = (t) => {
      const p = route.at(t);
      g.style.transform = `translate(${r1(p.x)}px, ${r1(p.y)}px) scale(var(--k, 1))`;
      spin.setAttribute('transform', `rotate(${r1(p.angle)})`);
      return p;
    };
    return { g, set };
  };

  /* 시점(카메라) */
  let view = { x: 0, y: 0, w: layout.size[0], h: layout.size[1] };
  let raf = 0;
  const apply = (v) => {
    view = v;
    svg.setAttribute('viewBox', `${r1(v.x)} ${r1(v.y)} ${r1(v.w)} ${r1(v.h)}`);
    svg.style.setProperty('--k', ((v.w / (svg.clientWidth || v.w)) * (opts.scale || 1)).toFixed(4));
  };
  const aspect = () => (svg.clientWidth || 16) / (svg.clientHeight || 9);
  /** p 지점이 화면의 at 비율 위치에 오고, 화면 폭에 span 만큼의 지도가 보이도록 */
  const frame = ({ p, at = [0.5, 0.5], span }) => {
    const w = span, h = span / aspect();
    return { x: p[0] - at[0] * w, y: p[1] - at[1] * h, w, h };
  };
  /** rect 전체가 보이도록(여백은 화면 비율에 맞게 늘림) */
  const contain = ([x, y, w, h], at = [0.5, 0.5]) => {
    const a = aspect();
    const vw = Math.max(w, h * a), vh = vw / a;
    return { x: x - (vw - w) * at[0], y: y - (vh - h) * at[1], w: vw, h: vh };
  };
  const tween = (to, ms = 900) => {
    cancelAnimationFrame(raf);
    if (ms <= 0) { apply(to); return; }
    const from = { ...view }, t0 = performance.now();
    const step = (now) => {
      const e = ease(Math.min(1, (now - t0) / ms));
      apply({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e });
      if (e < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  return {
    svg, layout, route, stops, stopTs, under, over, mark,
    select, setEta, highlight, addBus,
    apply, frame, contain, tween,
    resize: () => stopEls.forEach(sizeTag),
    get view() { return view; },
  };
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
