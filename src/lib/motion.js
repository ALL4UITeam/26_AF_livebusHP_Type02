/** 공통 모션 유틸. 속도·easing 은 style.css 의 --ease-* / --dur-* 와 같은 값을 쓴다. */

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * 키프레임을 지나는 부드러운 곡선(Fritsch–Carlson 단조 3차 보간).
 * 구간마다 속도가 끊기지 않고, 키프레임 값을 넘어서 출렁이지(overshoot) 않는다.
 * stops: [[progress, value], ...] (progress 오름차순)
 */
export function track(stops) {
  const n = stops.length;
  const xs = stops.map((s) => s[0]);
  const ys = stops.map((s) => s[1]);
  if (n === 1) return () => ys[0];
  const d = []; // 구간 기울기
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  // 양 끝은 멈춰 있다가 출발하도록(키프레임 밖에서는 값 고정)
  m[0] = 0; m[n - 1] = 0;
  return (p) => {
    if (p <= xs[0]) return ys[0];
    if (p >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (p > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (p - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i]
      + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/** 화면 크기와 무관한 시간 기반 감쇠 (dt ms) */
export const damp = (cur, target, tau, dt) => cur + (target - cur) * (1 - Math.exp(-dt / tau));
