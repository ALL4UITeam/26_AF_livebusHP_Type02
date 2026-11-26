/**
 * 선과 도트를 그리는 공통 부품(도시의 연결망, 선택 노선, 이동하는 데이터, 위치 도트가 함께 쓴다).
 *
 * 선: 1픽셀짜리 기본 선 대신, 화면에서 두께를 가진 띠로 그린다. 두께는 '세계에서의 폭(m)'을 화면 픽셀로 바꾼 뒤
 *     [최소, 최대] 픽셀로 묶는다. 그래서 멀어져도 끊기거나 깜빡이지 않고, 가까워져도 갑자기 굵어지지 않는다.
 *     가장자리는 픽셀 거리로 부드럽게 처리한다(블룸으로 가리지 않는다). 최소 폭보다 가늘어질 자리는 굵기 대신 밝기를 줄인다.
 * 도트: 작은 선명한 중심 + 절제된 주변 빛. 크기도 세계 크기를 픽셀로 바꿔 [최소, 최대]로 묶는다.
 */
export const RES = { value: null };   // 화면 크기(px). main.js 가 world.update 로 넘긴 값을 world.js 가 채운다

const LINE_VERT = `
attribute vec3 aA; attribute vec3 aB; attribute vec2 aQ; attribute vec4 aE; attribute float aW;
uniform vec2 uRes; uniform vec2 uPx; uniform float uCap;
varying vec2 vP; varying float vLen; varying float vHalf; varying vec4 vE; varying float vThin;
void main() {
  vec4 a = projectionMatrix * viewMatrix * modelMatrix * vec4(aA, 1.0), b = projectionMatrix * viewMatrix * modelMatrix * vec4(aB, 1.0);
  float nw = 0.3;
  if (a.w < nw && b.w < nw) { gl_Position = vec4(3.0, 3.0, 3.0, 1.0); return; }
  if (a.w < nw) a = mix(a, b, (nw - a.w) / (b.w - a.w)); else if (b.w < nw) b = mix(b, a, (nw - b.w) / (a.w - b.w));   // 카메라 뒤로 넘어간 끝은 앞에서 자른다
  vec2 h = uRes * 0.5, sa = a.xy / a.w * h, sb = b.xy / b.w * h, d = sb - sa;
  float len = length(d); vec2 dir = len > 1e-3 ? d / len : vec2(1.0, 0.0), nrm = vec2(-dir.y, dir.x);
  vec4 c = aQ.y < 0.5 ? a : b;
  float want = aW * projectionMatrix[1][1] * h.y / c.w * 0.5;          // 세계 폭을 픽셀 반폭으로
  float hw = clamp(want, uPx.x, uPx.y), pad = hw + 1.5, along = (aQ.y < 0.5 ? -1.0 : 1.0) * pad * uCap;
  vThin = clamp(want / uPx.x, 0.35, 1.0);
  vP = vec2(aQ.y < 0.5 ? along : len + along, aQ.x * pad); vLen = len; vHalf = hw; vE = aE;
  vec2 s = (aQ.y < 0.5 ? sa : sb) + dir * along + nrm * aQ.x * pad;
  gl_Position = vec4(s / h, c.z / c.w, 1.0);                             // w = 1: 띠 안의 값이 화면에서 고르게 이어진다
}`;
const LINE_HEAD = `
varying vec2 vP; varying float vLen; varying float vHalf; varying vec4 vE; varying float vThin; uniform float uCap; uniform float uT;
float lineA() { float dx = (vP.x - clamp(vP.x, 0.0, vLen)) * uCap; float d = length(vec2(dx, vP.y)); return (1.0 - smoothstep(vHalf - 0.7, vHalf + 0.7, d)) * vThin; }
float along() { return clamp(vP.x / max(vLen, 1e-3), 0.0, 1.0); }`;

/**
 * 띠 n 개를 한 번에 그리는 메시. set(i, A, B, eA, eB, 폭m) 으로 한 구간을 넣는다. eA·eB 는 양 끝의 값(vec4)이고 조각 shader 에서 vE 로 받는다.
 * frag 는 'vec4 shade()' 를 정의한다(lineA(): 가장자리가 부드러운 덮임, along(): 구간 위의 위치 0~1).
 */
export function fatLines(THREE, n, { frag, uniforms = {}, px = [0.8, 3], cap = 1, depthTest = true, order = 4 }) {
  const g = new THREE.BufferGeometry(), A = new Float32Array(n * 12), B = new Float32Array(n * 12), Q = new Float32Array(n * 8), E = new Float32Array(n * 16), Wd = new Float32Array(n * 4), idx = [];
  for (let i = 0; i < n; i++) { Q.set([-1, 0, 1, 0, -1, 1, 1, 1], i * 8); idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2); }
  const attr = (name, arr, size) => { const a = new THREE.BufferAttribute(arr, size); g.setAttribute(name, a); return a; };
  const aA = attr('aA', A, 3), aB = attr('aB', B, 3), aE = attr('aE', E, 4), aW = attr('aW', Wd, 1); attr('aQ', Q, 2); attr('position', new Float32Array(n * 12), 3); g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({ uniforms: { uRes: RES, uPx: { value: new THREE.Vector2(px[0], px[1]) }, uCap: { value: cap }, uT: { value: 0 }, ...uniforms }, vertexShader: LINE_VERT,
    fragmentShader: LINE_HEAD + frag + '\nvoid main() { gl_FragColor = shade(); }', transparent: true, depthWrite: false, depthTest, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = order;
  return {
    mesh, mat, count: n,
    set(i, a, b, eA, eB, w) { for (let k = 0; k < 4; k++) { const o = i * 4 + k; A.set(a, o * 3); B.set(b, o * 3); E.set(k < 2 ? eA : eB, o * 4); Wd[o] = w; } },
    done() { aA.needsUpdate = aB.needsUpdate = aE.needsUpdate = aW.needsUpdate = true; },
  };
}

/** 도트 n 개. set(i, 위치, 지름m, [r, g, b], 중심 비율, 주변 빛) */
export function dots(THREE, n, { px = [3, 26], depthTest = true, order = 6 } = {}) {
  const g = new THREE.BufferGeometry(), P = new Float32Array(n * 3), S = new Float32Array(n), C = new Float32Array(n * 4), K = new Float32Array(n * 2);
  const aP = new THREE.BufferAttribute(P, 3), aS = new THREE.BufferAttribute(S, 1), aC = new THREE.BufferAttribute(C, 4), aK = new THREE.BufferAttribute(K, 2);
  g.setAttribute('position', aP); g.setAttribute('aS', aS); g.setAttribute('aC', aC); g.setAttribute('aK', aK);
  const mat = new THREE.ShaderMaterial({ uniforms: { uRes: RES, uPx: { value: new THREE.Vector2(px[0], px[1]) } }, transparent: true, depthWrite: false, depthTest, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aS; attribute vec4 aC; attribute vec2 aK; uniform vec2 uRes; uniform vec2 uPx; varying vec4 vC; varying vec2 vK; varying float vS;
      void main() { vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = c;
        float want = aS * projectionMatrix[1][1] * uRes.y * 0.5 / max(c.w, 0.1), s = clamp(want, uPx.x, uPx.y);
        vC = vec4(aC.rgb, aC.a * clamp(want / uPx.x, 0.3, 1.0)); vK = aK; vS = s; gl_PointSize = s; }`,
    fragmentShader: `varying vec4 vC; varying vec2 vK; varying float vS;
      void main() { float r = length(gl_PointCoord * 2.0 - 1.0), aa = 2.5 / vS;
        float core = 1.0 - smoothstep(vK.x - aa, vK.x + aa, r);                                  // 작은 선명한 중심
        float halo = exp(-r * r * 5.0) * (1.0 - smoothstep(0.8, 1.0, r)) * vK.y;                  // 절제된 주변 빛
        gl_FragColor = vec4((vC.rgb * (core + halo) + vec3(0.6) * core * core * 0.5) * vC.a, 1.0); }` });
  const mesh = new THREE.Points(g, mat); mesh.frustumCulled = false; mesh.renderOrder = order;
  return {
    mesh, count: n,
    set(i, p, size, col, alpha = 1, core = 0.28, halo = 0.5) { P.set(p, i * 3); S[i] = size; C.set([col[0], col[1], col[2], alpha], i * 4); K.set([core, halo], i * 2); },
    done() { aP.needsUpdate = aS.needsUpdate = aC.needsUpdate = aK.needsUpdate = true; },
  };
}
