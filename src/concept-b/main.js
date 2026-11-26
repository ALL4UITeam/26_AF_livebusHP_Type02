/**
 * LIVEBUS 비주얼 콘셉트 B — LIVE FIELD
 *
 * 그리는 것 : WebGL2 점 입자(가산 혼합). 형태는 shapes.js, 커서 변형은 field.js.
 * 역할 분담 : 스크롤은 전체 형태(조형물 → 버스)를, 커서는 그 위의 국소 변형만 담당한다.
 * 외부 라이브러리 없음.
 */
import { buildParticles } from './shapes.js';
import { Field } from './field.js';

const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec3 aA;
layout(location=1) in vec3 aB;
layout(location=2) in vec4 aP;   // u(선을 따라간 위치), 선마다 다른 위상, 등장 순서, 종류
layout(location=3) in vec2 aBr;  // 밝기(A, B)
uniform mat4 uVP;
uniform vec4 uFit;               // A 크기, A 기울임, B 크기, 화면 비율
uniform float uT, uMorph, uPx, uAlpha, uMaxPt, uGain;
uniform vec2 uRev;               // 등장: 신호가 지나간 위치(0~1), 섬광
uniform sampler2D uField;
uniform vec3 uCur;               // 커서 x, y, 누른 세기
uniform vec4 uRip[4];            // 파동: x, y, 나이(초), 세기
out vec3 vCol;

void main() {
  float u = aP.x, ph = aP.y, kind = aP.w;

  float cr = cos(uFit.y), sr = sin(uFit.y);
  vec3 a = vec3(aA.x * cr - aA.y * sr, aA.x * sr + aA.y * cr, aA.z) * uFit.x;
  vec3 b = aB * uFit.z;

  // 가만히 있을 때의 미세한 흐름: 위치의 매끄러운 함수라 이웃끼리 함께 움직인다
  a.y += 0.05 * sin(a.x * 1.1 + uT * 0.42 + a.z * 0.7);
  a.z += 0.08 * cos(a.x * 0.75 - uT * 0.33 + a.y * 1.2);
  a.x += 0.03 * sin(a.y * 1.6 + uT * 0.27);

  // 형태 변화: 앞쪽 선부터 차례로 넘어가되 모든 입자가 연속으로 움직인다
  float delay = clamp(aA.x / 9.0 + 0.5, 0.0, 1.0) * 0.42 + ph * 0.06;
  float m = clamp(uMorph * 1.48 - delay, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  vec3 p = mix(a, b, m);
  float arc = sin(m * 3.14159265);
  p += arc * vec3(0.16 * sin(a.y * 1.2 + a.x * 0.4), 0.2 * cos(a.x * 0.7), 0.5 * sin(a.x * 0.8 + a.y * 0.5));   // 넘어가는 동안 한 방향으로 함께 휘어 흐른다

  vec4 clip = uVP * vec4(p, 1.0);
  vec2 ndc = clip.xy / clip.w;
  vec2 sp = vec2(ndc.x * uFit.w, ndc.y);

  // 커서가 만든 변형. 안쪽 구조는 거의 움직이지 않아 표면이 밀리면 드러난다
  vec2 f = texture(uField, ndc * 0.5 + 0.5).xy;
  float kd = kind == 2.0 ? mix(0.1, 0.5, m) : (kind == 3.0 ? 1.3 : (kind == 1.0 ? 0.82 : 1.0));
  kd *= mix(0.75, 1.25, clamp((9.5 - clip.w) / 5.0, 0.0, 1.0));
  vec2 disp = f * kd;

  // 놓았을 때 퍼지는 얇은 파동과, 지나간 자리의 여운
  float glow = 0.0, after = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 r = uRip[i];
    if (r.w <= 0.0) continue;
    vec2 d = sp - r.xy;
    float dist = length(d) + 1e-4, front = r.z * 1.45, life = exp(-r.z * 1.15);
    float ring = exp(-pow((dist - front) / 0.045, 2.0)) * r.w * life;
    disp += (d / dist) * ring * 0.07 * kd;
    glow += ring;
    after += r.w * life * smoothstep(front - 0.9, front - 0.02, dist) * (1.0 - smoothstep(front - 0.02, front + 0.03, dist));
  }

  float base = mix(aBr.x, aBr.y, m);
  float pulse = pow(0.5 + 0.5 * sin(u * 46.0 - uT * 1.5 + ph * 6.283), 14.0);
  float reveal = clamp(length(f) * 6.0 + after * 1.3, 0.0, 1.0);
  float br;
  if (kind == 2.0) br = base * mix(0.28 + 1.25 * reveal, 1.0 + 0.7 * reveal + 0.4 * pulse, smoothstep(0.75, 1.0, m)) * (1.0 - 0.92 * arc);   // 윤곽선은 자리를 잡을 때 또렷해진다
  else br = base * (1.0 + (kind == 3.0 ? 0.0 : 0.9) * pulse) * (1.0 - 0.3 * reveal * (1.0 - m)) + base * glow * 0.9;

  br *= 1.0 - 0.35 * arc;   // 넘어가는 동안은 조금 가라앉히고, 자리를 잡으면 다시 밝아진다

  vec2 dc = sp - uCur.xy;
  br *= 1.0 + uCur.z * 1.1 * exp(-dot(dc, dc) / 0.05);   // 누르는 동안 모인 곳이 밝아진다

  float z = clip.w;
  float fog = (smoothstep(14.5, 5.5, z) * 0.86 + 0.14) * smoothstep(1.0, 2.8, z);

  float vis = smoothstep(0.0, 0.05, uRev.x - aP.z);
  float flash = uRev.y * exp(-max(uRev.x - aP.z, 0.0) * 15.0);
  br *= fog * vis * (1.0 + 2.2 * flash) * uAlpha * uGain;

  float size = (kind == 1.0 ? 1.85 : (kind == 2.0 ? 1.5 : (kind == 3.0 ? 1.15 : 1.4))) * uPx * (7.6 / z);
  if (size < 1.0) { br *= size; size = 1.0; }
  gl_PointSize = min(size, uMaxPt);

  float t = clamp(br, 0.0, 1.6);
  vec3 deep = vec3(0.02, 0.13, 0.80), cyan = vec3(0.09, 0.56, 1.0), white = vec3(0.80, 0.94, 1.0);
  vec3 col = mix(deep, cyan, smoothstep(0.05, 0.55, t));
  col = mix(col, white, smoothstep(0.6, 1.35, t));
  col = mix(col, deep * 1.1, (1.0 - fog) * 0.6);
  vCol = col * br;

  ndc += vec2(disp.x / uFit.w, disp.y);
  gl_Position = vec4(ndc * clip.w, clip.z, clip.w);
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec3 vCol;
out vec4 o;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float a = smoothstep(1.0, 0.25, dot(q, q));
  o = vec4(vCol * a, 1.0);
}`;

/* 등장 신호(작은 머리와 짧은 꼬리) */
const SIG_VERT = `#version 300 es
precision highp float;
layout(location=0) in vec4 aS;   // xyz, 밝기
uniform mat4 uVP;
uniform vec4 uFit;
uniform float uPx;
out float vI;
void main() {
  float cr = cos(uFit.y), sr = sin(uFit.y);
  vec3 a = vec3(aS.x * cr - aS.y * sr, aS.x * sr + aS.y * cr, aS.z) * uFit.x;
  gl_Position = uVP * vec4(a, 1.0);
  gl_PointSize = (1.6 + 3.4 * aS.w) * uPx;
  vI = aS.w;
}`;
const SIG_FRAG = `#version 300 es
precision mediump float;
in float vI;
out vec4 o;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float a = smoothstep(1.0, 0.1, dot(q, q));
  o = vec4(vec3(0.72, 0.92, 1.0) * a * vI, 1.0);
}`;

const $ = (s) => document.querySelector(s);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function program(gl, vs, fs) {
  const make = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, make(gl.VERTEX_SHADER, vs)); gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) { const name = gl.getActiveUniform(p, i).name.replace('[0]', ''); u[name] = gl.getUniformLocation(p, name); }
  return { p, u };
}

function viewProj(aspect, dist, yaw, pitch) {
  const f = 1 / Math.tan((32 * Math.PI) / 360), near = 0.1, far = 60;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  // V = T(0,0,-dist) · Rx(pitch) · Ry(yaw)
  const v = [cy, sp * sy, -cp * sy, 0, 0, cp, sp, 0, sy, -sp * cy, cp * cy, 0, 0, 0, -dist, 1];
  const p = [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += p[k * 4 + r] * v[c * 4 + k]; o[c * 4 + r] = s; }
  return o;
}

function start() {
  const canvas = $('#field');
  const stage = $('.stage');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) { document.documentElement.classList.add('no-gl'); return; }

  /* ── 입자 ── */
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const parts = buildParticles(small ? 90000 : 150000);
  const { p: prog, u: U } = program(gl, VERT, FRAG);
  const { p: sigProg, u: SU } = program(gl, SIG_VERT, SIG_FRAG);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  [[parts.A, 3], [parts.B, 3], [parts.P, 4], [parts.Br, 2]].forEach(([data, n], loc) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0);
  });
  const SIG_N = 40;
  const sigData = new Float32Array(SIG_N * 4);
  const sigVao = gl.createVertexArray();
  gl.bindVertexArray(sigVao);
  const sigBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sigBuf);
  gl.bufferData(gl.ARRAY_BUFFER, sigData, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);

  /* ── 변형 장 ── */
  const field = new Field(96, 54);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, field.gw, field.gh, 0, gl.RGBA, gl.FLOAT, field.data);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.clearColor(0.0, 0.003, 0.01, 1);
  const maxPoint = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];

  /* ── 상태 ── */
  let W = 1, H = 1, aspect = 1, dpr = 1;
  let quality = 0;                       // 0 전체, 1·2 는 느릴 때 입자 수와 해상도를 줄인 단계
  const lockQuality = window.__LIVE_FIELD_LOCK === true;   // 확인용: 품질 단계를 고정
  const QUALITY = [{ dpr: 2, frac: 1 }, { dpr: 1.5, frac: 0.72 }, { dpr: 1, frac: 0.5 }];
  const cur = { x: 0, y: 0, px: -100, py: -100, vx: 0, vy: 0, presence: 0, target: 0, charge: 0, pressing: false, pressAt: 0, lastMove: 0 };
  const cam = { yaw: 0, pitch: 0 };
  const rip = new Float32Array(16);
  let ripNext = 0;
  let morph = 0, morphTarget = 0;
  let t = reduce ? 14 : 0;
  let born = performance.now(), last = born;
  let alpha = reduce ? 0 : 1, alphaTarget = 1;
  let slow = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, QUALITY[quality].dpr);
    W = stage.clientWidth; H = stage.clientHeight; aspect = W / H;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    field.aspect = aspect;
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  /* ── 입력 ── */
  const dot = $('.cursor__dot'), ring = $('.cursor__ring');
  const ringPos = { x: -100, y: -100, s: 1 };
  let ringKick = 0;
  if (finePointer) document.documentElement.classList.add('has-cursor');

  const hint = { move: $('[data-hint="move"]'), press: $('[data-hint="press"]'), scroll: $('[data-hint="scroll"]') };
  if (!finePointer) {   // 터치 환경의 안내 문구
    hint.move.textContent = '가로로 문지르면 표면이 휩니다';
    hint.press.textContent = '길게 누르면 모이고, 떼면 퍼집니다';
  }
  let moved = 0;
  const done = (k) => hint[k] && hint[k].classList.add('is-done');

  const toField = (e) => { const r = stage.getBoundingClientRect(); return [((e.clientX - r.left) / r.width * 2 - 1) * aspect, -((e.clientY - r.top) / r.height * 2 - 1)]; };
  window.addEventListener('pointermove', (e) => {
    const [x, y] = toField(e);
    const now = performance.now(), dt = Math.max(0.004, (now - cur.lastMove) / 1000);
    if (cur.lastMove && dt < 0.12) {
      cur.vx += ((x - cur.x) / dt - cur.vx) * 0.35; cur.vy += ((y - cur.y) / dt - cur.vy) * 0.35;
      moved += Math.hypot(x - cur.x, y - cur.y);
      if (moved > 2.5) done('move');
    }
    cur.x = x; cur.y = y; cur.px = e.clientX; cur.py = e.clientY; cur.lastMove = now;
    if (e.pointerType !== 'touch' || cur.pressing) cur.target = 1;
    if (finePointer) dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;   // 중심점은 지연 없이
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { cur.target = 0; });
  window.addEventListener('blur', () => { cur.target = 0; });

  const release = (ripple) => {
    if (!cur.pressing) return;
    cur.pressing = false;
    stage.classList.remove('is-pressing');
    const c = cur.charge;
    if (ripple && !reduce) {
      const amp = 0.32 + 0.68 * c;                       // 누른 시간만큼, 상한 1
      rip.set([cur.x, cur.y, 0, amp], ripNext * 4); ripNext = (ripNext + 1) % 4;
      field.kick(cur.x, cur.y, 0.25 + 0.75 * c);
      ringKick = 1;
      if (c > 0.12) done('press');
    }
  };
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('a, button')) return;   // 링크·버튼 조작과 겹치지 않게
    const [x, y] = toField(e);
    cur.x = x; cur.y = y; cur.pressing = true; cur.pressAt = performance.now(); cur.target = 1;
    stage.classList.add('is-pressing');
  });
  window.addEventListener('pointerup', (e) => { release(true); if (e.pointerType === 'touch') cur.target = 0; });
  window.addEventListener('pointercancel', () => { release(false); cur.target = 0; });
  stage.addEventListener('contextmenu', () => release(false));

  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    morphTarget = reduce ? (p > 0.5 ? 1 : 0) : smooth(0.08, 0.86, p);
    if (p > 0.25) done('scroll');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (reduce) morph = morphTarget;

  const railMark = $('.rail__mark'), rail = $('.rail');

  /* ── 등장: 작은 신호가 주 리본을 따라 지나가고, 지나간 자리에서 조형물이 드러난다 ── */
  function intro(sec) {
    if (reduce) return { rev: 2, flash: 0, sig: 0, e: 1 };
    const e = easeInOut(clamp((sec - 0.25) / 1.0, 0, 1));
    const sig = clamp((sec - 0.05) / 0.2, 0, 1) * (1 - clamp((sec - 1.2) / 0.25, 0, 1));
    return { rev: e * 1.06 - 0.02 + clamp((sec - 1.25) / 0.3, 0, 1) * 0.2, flash: 1 - clamp((sec - 1.5) / 0.5, 0, 1), sig, e };
  }
  function fillSignal(e, strength) {
    for (let i = 0; i < SIG_N; i++) {
      const back = i * 0.0036 * (0.35 + 1.65 * Math.sin(Math.PI * e));
      const p = parts.signal(Math.max(0, e * 0.985 - back));
      sigData.set([p[0], p[1], p[2], Math.exp(-i * 0.14) * strength * (i === 0 ? 1 : 0.55)], i * 4);
    }
  }

  /* ── 한 프레임 ── */
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const sec = (now - born) / 1000;
    if (!reduce) t += dt;

    // 느리면 입자 수와 해상도부터 낮춘다
    if (sec > 2.5 && quality < 2 && !lockQuality) {
      slow = dt > 0.024 ? slow + dt : Math.max(0, slow - dt * 0.5);
      if (slow > 1.2) { quality++; slow = 0; resize(); }
    }

    // 스크롤이 정한 형태로 부드럽게 따라간다(멈추면 그 상태로 머문다)
    if (reduce) {
      if (morph !== morphTarget) { alphaTarget = 0; if (alpha < 0.02) { morph = morphTarget; alphaTarget = 1; } }
      alpha += (alphaTarget - alpha) * (1 - Math.exp(-dt * 12));
    } else {
      morph += (morphTarget - morph) * (1 - Math.exp(-dt * 7));
    }

    // 커서
    if (now - cur.lastMove > 60) { cur.vx *= Math.exp(-dt * 9); cur.vy *= Math.exp(-dt * 9); }
    cur.presence += (cur.target - cur.presence) * (1 - Math.exp(-dt * 8));
    const hold = cur.pressing ? 1 - Math.exp(-((now - cur.pressAt) / 1000) * 2.1) : 0;
    cur.charge += (hold - cur.charge) * (1 - Math.exp(-dt * (cur.pressing ? 14 : 9)));
    if (reduce) { cur.presence = 0; cur.charge = 0; }
    field.step(dt, cur);
    for (let i = 0; i < 4; i++) if (rip[i * 4 + 3] > 0) { rip[i * 4 + 2] += dt; if (rip[i * 4 + 2] > 3.6) rip[i * 4 + 3] = 0; }

    // 시점: 커서를 따라 아주 조금만 돈다. 버스가 될수록 고정한다
    const still = 1 - morph;
    const yawT = (reduce ? 0 : Math.sin(t * 0.13) * 0.04 * still) + (cur.x / Math.max(aspect, 1)) * 0.05 * cur.presence;
    const pitchT = (reduce ? 0 : Math.sin(t * 0.09 + 1) * 0.015 * still) - cur.y * 0.03 * cur.presence;
    cam.yaw += (yawT - cam.yaw) * (1 - Math.exp(-dt * 2.2));
    cam.pitch += (pitchT - cam.pitch) * (1 - Math.exp(-dt * 2.2));
    const vp = viewProj(aspect, 7.6, cam.yaw, cam.pitch);

    // 세로로 긴 화면: 조형물은 기울여 대각선으로, 버스는 폭에 맞춘다
    const wide = smooth(0.6, 1.35, aspect);
    const fit = [0.6 + 0.4 * wide, 0.95 * (1 - wide), Math.min(1, aspect / 1.5), aspect];

    const it = intro(sec);
    const px = dpr * (H / 900) * (small ? 1.25 : 1) * (dpr < 1.5 ? 1.2 : 1);   // 저해상도 화면에서는 점을 조금 키워 선이 끊겨 보이지 않게

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, field.gw, field.gh, gl.RGBA, gl.FLOAT, field.data);
    gl.uniform1i(U.uField, 0);
    gl.uniformMatrix4fv(U.uVP, false, vp);
    gl.uniform4fv(U.uFit, fit);
    gl.uniform1f(U.uT, t);
    gl.uniform1f(U.uMorph, morph);
    gl.uniform1f(U.uPx, px);
    gl.uniform1f(U.uAlpha, reduce ? alpha : 1);
    gl.uniform1f(U.uMaxPt, Math.min(maxPoint, 9 * dpr));
    gl.uniform1f(U.uGain, 1.25 * (fit[0] ** 1.2 * (1 - morph) + fit[2] ** 1.2 * morph));   // 작게 그릴수록 입자가 겹치므로 그만큼 어둡게
    gl.uniform2f(U.uRev, it.rev, it.flash);
    gl.uniform3f(U.uCur, cur.x, cur.y, cur.charge);
    gl.uniform4fv(U.uRip, rip);
    gl.drawArrays(gl.POINTS, 0, Math.floor(parts.count * QUALITY[quality].frac));

    if (it.sig > 0.001) {
      fillSignal(it.e, it.sig);
      gl.useProgram(sigProg);
      gl.bindVertexArray(sigVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, sigBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, sigData);
      gl.uniformMatrix4fv(SU.uVP, false, vp);
      gl.uniform4fv(SU.uFit, fit);
      gl.uniform1f(SU.uPx, px);
      gl.drawArrays(gl.POINTS, 0, SIG_N);
    }

    // 커서의 링: 중심점보다 조금 늦게 따라오고, 누르면 모였다가 놓으면 짧게 넓어진다
    if (finePointer) {
      const k = 1 - Math.exp(-dt * 16);
      ringPos.x += (cur.px - ringPos.x) * k; ringPos.y += (cur.py - ringPos.y) * k;
      ringKick *= Math.exp(-dt * 7);
      const target = (cur.pressing ? 1 - 0.5 * cur.charge : 1) + ringKick * 0.7;
      ringPos.s += (target - ringPos.s) * (1 - Math.exp(-dt * 18));
      ring.style.transform = `translate3d(${ringPos.x.toFixed(1)}px, ${ringPos.y.toFixed(1)}px, 0) scale(${ringPos.s.toFixed(3)})`;
    }

    railMark.style.transform = `translateX(${(morph * 100).toFixed(2)}%)`;
    rail.dataset.at = morph > 0.5 ? 'bus' : 'field';

    frames++;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.documentElement.classList.add('is-live');
  /* 확인용: 콘솔에서 상태를 볼 수 있게 둔다 */
  let frames = 0;
  window.__liveField = { get quality() { return quality; }, get morph() { return morph; }, get frames() { return frames; }, count: parts.count, field, cur };
}

try { start(); } catch (err) { console.error(err); document.documentElement.classList.add('no-gl'); }
