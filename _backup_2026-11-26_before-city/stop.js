/**
 * 정류장 구간(4차): 태양광 BIT 안내기, 쉘터, 스마트폰, 정보가 전해지는 짧은 빛, 지나온 노선의 빛.
 *
 * BIT 는 브로슈어(올포랜드 AI LIVEBUS, eBIT 태양광형)의 구조를 따른다:
 * 둥근 받침 → 각진 지주 → 지주 앞에 붙은 세로형 화면 → 지주 꼭대기의 기울어진 직사각형 태양광 패널.
 * 재질과 화면 색은 이 3D 세계(검정·남색·시안)에 맞췄다. 치수는 브로슈어 그림의 비례를 따른 값이며 실측값이 아니다.
 *
 * 정보 전달 효과는 '작은 신호 → 짧은 빛의 이동 → 목적지의 반응 → 흔적 소멸' 한 번으로 끝난다.
 * 선이 항상 켜져 있지 않고, 모든 상태가 스크롤 진행률로만 정해져 되돌려도 같은 값이 나온다.
 */
const FONT = '"Freesentation", "Pretendard Variable", Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
export const ROUTE = { no: '01', dest: 'LIVEBUS행', stops: ['시청 앞', '중앙시장', '라이브 정류장', '도서관', '터미널'], here: 2 };

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ramp = (a, b, x) => clamp01((x - a) / (b - a));
const ease = (t) => t * t * (3 - 2 * t);

/**
 * 진행률 위의 사건들. main.js 의 카메라 구도와 문구가 이 값에 맞춰져 있다.
 * BIT: 신호 1.345 → 도착 1.39(이때 '도착'으로 바뀐다) / BIS: 신호 1.645 → 도착 1.70 → 노선 → 위치 → 도착정보
 */
export const TL = {
  bitSignal: [1.345, 1.398], bitArrive: 1.388,
  phoneIn: [1.57, 1.655], phoneSignal: [1.645, 1.708], phoneArrive: 1.695,
  route: [1.7, 1.75], pin: [1.745, 1.785], card: [1.775, 1.83],
  depart: 1.9, phoneOut: [1.885, 1.96],
};

export function buildStop(THREE, scene, M, STOP, path) {
  const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const rr = (w, h, r) => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  };
  const slab = (w, h, d, r, mat, bevel = 0.012) => new THREE.Mesh(new THREE.ExtrudeGeometry(rr(w, h, r), { depth: d, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3 }), mat);
  const screenTex = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return { c, g: c.getContext('2d'), t }; };
  const glassOver = new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 0, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.14, envMapIntensity: 1.1 });
  /* 정류장 시설의 재질: 버스 재질과 따로 둔다(버스의 오프닝 효과가 묻어나지 않게) */
  const S = {
    frame: new THREE.MeshStandardMaterial({ color: 0x0a0e15, metalness: 0.7, roughness: 0.42, envMapIntensity: 0.9 }),
    pole: new THREE.MeshStandardMaterial({ color: 0x0c1118, metalness: 0.75, roughness: 0.36, envMapIntensity: 1.0 }),
    matte: new THREE.MeshStandardMaterial({ color: 0x030405, metalness: 0.1, roughness: 0.85, envMapIntensity: 0.2 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x525b6b, metalness: 1, roughness: 0.3, envMapIntensity: 1.0 }),
    cyan: new THREE.MeshBasicMaterial({ color: 0x1f9bd8 }),
  };
  const Y = 0.12;                                                     // 인도 높이

  /* ── BIT 안내기(브로슈어의 태양광형) ── */
  const BIT_AT = { x: STOP.x + 15.8, z: 7.5, yaw: 0.5 };             // 선 버스의 앞머리에서 10m 남짓 앞, 인도 위
  const bit = new THREE.Group(); bit.position.set(BIT_AT.x, Y, BIT_AT.z); bit.rotation.y = BIT_AT.yaw; scene.add(bit);
  add(new THREE.CylinderGeometry(0.34, 0.37, 0.07, 40), S.pole, 0, 0.035, 0, bit);                                     // 둥근 받침
  add(new THREE.CylinderGeometry(0.2, 0.26, 0.08, 32), S.pole, 0, 0.11, 0, bit);
  add(new THREE.BoxGeometry(0.15, 3.02, 0.15), S.pole, 0, 1.51, 0, bit);                                                // 각진 지주
  const body = slab(0.86, 1.46, 0.085, 0.07, S.frame, 0.016); body.position.set(0, 1.78, 0.08); bit.add(body);        // 세로형 화면 몸체(지주 앞)
  add(new THREE.BoxGeometry(0.3, 0.5, 0.06), S.pole, 0, 1.78, 0.06, bit);                                               // 지주와 몸체를 잇는 받침
  const bitScr = screenTex(512, 912);
  add(new THREE.PlaneGeometry(0.74, 1.318), new THREE.MeshBasicMaterial({ map: bitScr.t }), 0, 1.78, 0.1825, bit);
  add(new THREE.PlaneGeometry(0.78, 1.36), glassOver, 0, 1.78, 0.185, bit);
  add(new THREE.BoxGeometry(0.11, 0.2, 0.11), S.metal, 0, 3.06, 0, bit);                                                // 패널 받침대
  const panel = new THREE.Group(); panel.position.set(0, 3.2, 0.03); panel.rotation.x = 0.42; bit.add(panel);          // 꼭대기의 기울어진 태양광 패널(화면 쪽으로 숙인다)
  const pFrame = slab(1.3, 0.76, 0.03, 0.02, S.metal, 0.005); pFrame.rotation.x = -Math.PI / 2; pFrame.position.y = -0.03; panel.add(pFrame);
  const sol = screenTex(384, 224); sol.g.fillStyle = '#060b1a'; sol.g.fillRect(0, 0, 384, 224);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { sol.g.fillStyle = (i + j) % 2 ? '#0c1838' : '#0a1430'; sol.g.fillRect(i * 64 + 2, j * 74.6 + 2, 60, 70.6); }
  sol.g.strokeStyle = 'rgba(150,175,225,0.28)'; sol.g.lineWidth = 1;
  for (let i = 0; i < 6; i++) for (const dx of [21, 43]) { sol.g.beginPath(); sol.g.moveTo(i * 64 + dx, 0); sol.g.lineTo(i * 64 + dx, 224); sol.g.stroke(); }
  sol.t.needsUpdate = true;
  /* 패널은 빛을 내지 않는다. 주변 빛을 반사할 뿐이라 수신 장치처럼 보이지 않는다 */
  const cells = add(new THREE.PlaneGeometry(1.24, 0.7), new THREE.MeshPhysicalMaterial({ map: sol.t, metalness: 0.2, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.1 }), 0, 0.012, 0, panel); cells.rotation.x = -Math.PI / 2;
  const cellsUnder = add(new THREE.PlaneGeometry(1.24, 0.7), S.matte, 0, -0.045, 0, panel); cellsUnder.rotation.x = Math.PI / 2;
  bit.updateMatrixWorld(true);
  const bitPort = new THREE.Vector3(-0.475, 2.08, 0.1).applyMatrix4(bit.matrixWorld);     // 빛이 닿는 곳: 몸체의 버스 쪽 옆면(패널이 아니다)
  const bitCenter = new THREE.Vector3(0, 1.78, 0.1).applyMatrix4(bit.matrixWorld);

  /* ── 쉘터: BIT 바로 뒤(브로슈어 표지의 배치). 가는 기둥, 얇은 지붕, 어두운 유리 뒷면, 벤치 ── */
  const shelter = new THREE.Group(); shelter.position.set(BIT_AT.x + 4.9, Y, 7.55); scene.add(shelter);
  const roof = slab(4.6, 1.7, 0.07, 0.12, S.frame); roof.rotation.x = -Math.PI / 2; roof.position.set(0, 2.55, 0); shelter.add(roof);
  for (const x of [-2.1, 2.1]) for (const z of [-0.7, 0.7]) add(new THREE.BoxGeometry(0.07, 2.55, 0.07), S.pole, x, 1.275, z, shelter);
  add(new THREE.BoxGeometry(4.2, 1.7, 0.02), new THREE.MeshPhysicalMaterial({ color: 0x05080f, metalness: 0, roughness: 0.06, clearcoat: 1, transparent: true, opacity: 0.32, envMapIntensity: 1.0 }), 0, 1.35, 0.72, shelter);
  add(new THREE.BoxGeometry(3.0, 0.06, 0.4), S.frame, 0, 0.48, 0.35, shelter);
  for (const x of [-1.2, 1.2]) add(new THREE.BoxGeometry(0.06, 0.48, 0.34), S.pole, x, 0.24, 0.35, shelter);
  add(new THREE.BoxGeometry(4.3, 0.02, 0.025), S.cyan, 0, 2.52, -0.83, shelter);   // 지붕 끝의 가는 시안색 선

  /* ── 스마트폰: 두께가 있는 몸체, 금속 테두리, 유리 화면 ── */
  const phone = new THREE.Group(); scene.add(phone);
  const pBody = slab(0.074, 0.156, 0.0075, 0.012, M.chrome, 0.0012); pBody.position.z = -0.0075; phone.add(pBody);
  const pBack = slab(0.071, 0.153, 0.001, 0.011, S.frame, 0.0005); pBack.position.z = -0.0096; phone.add(pBack);
  const pScr = screenTex(540, 1170);
  add(new THREE.ShapeGeometry(rr(0.0705, 0.1525, 0.0105), 8), S.matte, 0, 0, 0.00135, phone);
  add(new THREE.PlaneGeometry(0.066, 0.143), new THREE.MeshBasicMaterial({ map: pScr.t }), 0, 0, 0.0015, phone);
  add(new THREE.ShapeGeometry(rr(0.0705, 0.1525, 0.0105), 8), glassOver, 0, 0, 0.0018, phone);
  add(new THREE.CircleGeometry(0.0016, 12), S.matte, 0, 0.0655, 0.0019, phone);
  phone.visible = false;
  const PHONE_D = 1.55;                                               // 카메라에서 스마트폰까지의 거리(m). 손에 든 것처럼 화면 속 정해진 자리에 선다

  /* ── 정보의 빛: 작은 머리와 짧은 꼬리. 깊이 판정을 하므로 차체나 기기 뒤로 가면 가려진다 ── */
  const NT = 96, cometU = { uPx: { value: 1 }, uT: { value: 0 } };
  const makeComet = () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NT * 3), 3));
    geo.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(NT), 1));      // 0 = 머리, 1 = 꼬리 끝
    geo.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(NT), 1));      // 보이는 정도
    const pts = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: cometU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aK; attribute float aA; uniform float uPx; uniform float uT; varying float vA; varying float vK;
        void main() { vK = aK; vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          float head = step(aK, 0.001); gl_PointSize = uPx * (head * (11.0 + 1.2 * sin(uT * 9.0)) + (1.0 - head) * mix(3.2, 1.3, aK)); }`,
      fragmentShader: `varying float vA; varying float vK;
        void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; float d = dot(q, q); float a = smoothstep(1.0, 0.0, d);
          float head = step(vK, 0.001); float core = smoothstep(0.3, 0.0, d);
          vec3 c = mix(vec3(0.2, 0.7, 1.0), vec3(0.3, 0.78, 1.0) * a + vec3(0.9, 0.97, 1.0) * core, head);
          gl_FragColor = vec4(c * a * vA * mix(0.5 * pow(1.0 - vK, 1.5), 1.0, head), 1.0); }` }));
    pts.frustumCulled = false; pts.renderOrder = 6; pts.visible = false; scene.add(pts);
    return { geo, pts };
  };
  const comets = [makeComet(), makeComet()];
  /* 출발점의 작은 신호, 도착점의 짧은 반응(둘 다 작은 점 하나) */
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
  dotGeo.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(4), 1));      // 크기(px)
  dotGeo.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(4), 1));
  const dots = new THREE.Points(dotGeo, new THREE.ShaderMaterial({ uniforms: cometU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aS; attribute float aA; uniform float uPx; varying float vA; void main() { vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = uPx * aS; }`,
    fragmentShader: `varying float vA; void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; float d = dot(q, q); float a = smoothstep(1.0, 0.0, d); a *= a; gl_FragColor = vec4(vec3(0.36, 0.82, 1.0) * a * vA + vec3(0.5) * smoothstep(0.12, 0.0, d) * vA, 1.0); }` }));
  dots.frustumCulled = false; dots.renderOrder = 6; scene.add(dots);

  /* ── 지나온 노선의 빛(마무리에서 은은하게 남는 한 줄) ── */
  const tp = [], tx = [], ti = [];
  path.forEach(([x, z], i) => { tp.push(x, 0.045, z - 0.09, x, 0.045, z + 0.09); tx.push(x, x); if (i) { const a = (i - 1) * 2; ti.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
  const tGeo = new THREE.BufferGeometry(); tGeo.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); tGeo.setAttribute('aX', new THREE.Float32BufferAttribute(tx, 1)); tGeo.setIndex(ti);
  const trailU = { uX: { value: 0 }, uK: { value: 0 }, uT: { value: 0 } };
  const trail = new THREE.Mesh(tGeo, new THREE.ShaderMaterial({ uniforms: trailU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'attribute float aX; varying float vX; void main() { vX = aX; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float vX; uniform float uX, uK, uT; void main() { float on = smoothstep(uX - 6.0, uX - 16.0, vX) * smoothstep(uX - 300.0, uX - 50.0, vX); float pulse = 0.7 + 0.3 * pow(0.5 + 0.5 * sin((vX - uT * 14.0) * 0.08), 4.0); gl_FragColor = vec4(vec3(0.16, 0.66, 1.0) * on * pulse * uK, 1.0); }' })); trail.frustumCulled = false; scene.add(trail);

  /* ── 화면 그리기 ── */
  const rrect = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  function drawBit(st) {
    const g = bitScr.g; g.fillStyle = '#02050c'; g.fillRect(0, 0, 512, 912);
    g.fillStyle = '#0b1a36'; g.fillRect(0, 0, 512, 156); g.fillStyle = '#eaf4ff'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.font = `600 26px ${FONT}`; g.fillStyle = '#8fb4e6'; g.fillText('현재 정류장', 36, 46);
    g.font = `700 46px ${FONT}`; g.fillStyle = '#ffffff'; g.fillText(ROUTE.stops[ROUTE.here], 36, 104);
    const rows = [[ROUTE.no, ROUTE.dest, st.status, true], ['12', '시청 방면', '8분 후', false], ['30', '터미널 방면', '15분 후', false]];
    rows.forEach(([no, dest, eta, hero], i) => {
      const y = 186 + i * 226;
      if (hero && (st.on || st.hit > 0)) {                                    // 빛이 닿으면 이 노선의 줄이 반응한다
        g.fillStyle = `rgba(40,150,230,${(0.2 * (st.on ? 1 : 0) + 0.34 * st.hit).toFixed(3)})`; rrect(g, 16, y - 6, 480, 210, 18); g.fill();
        g.fillStyle = '#46cfff'; g.globalAlpha = Math.min(1, (st.on ? 1 : 0) + st.hit); g.fillRect(16, y + 20, 7, 158); g.globalAlpha = 1;
      }
      g.fillStyle = hero ? '#1f9bd8' : '#22355c'; rrect(g, 44, y + 28, 122, 74, 14); g.fill();
      g.fillStyle = '#fff'; g.font = `700 56px ${FONT}`; g.textAlign = 'center'; g.fillText(no, 105, y + 68);
      g.textAlign = 'left'; g.fillStyle = '#a9bddc'; g.font = `600 34px ${FONT}`; g.fillText(dest, 190, y + 66);
      g.fillStyle = hero ? (eta === '도착' ? '#7fe3ff' : '#ffffff') : '#c9d6ea'; g.font = `700 ${hero ? 78 : 56}px ${FONT}`; g.fillText(eta, 44, y + 156);
      g.fillStyle = 'rgba(140,170,220,0.22)'; g.fillRect(36, y + 214, 440, 2);
    });
    g.fillStyle = '#5f7396'; g.font = `500 22px ${FONT}`; g.fillText('시연용 예시 정보', 36, 884);
    bitScr.t.needsUpdate = true;
  }
  function drawPhone(st) {
    const g = pScr.g, Wc = 540; g.fillStyle = '#04070f'; g.fillRect(0, 0, Wc, 1170);
    if (st.hit > 0) { const gr = g.createLinearGradient(0, 0, 150, 0); gr.addColorStop(0, `rgba(70,207,255,${(0.34 * st.hit).toFixed(3)})`); gr.addColorStop(1, 'rgba(70,207,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 150, 1170); }   // 빛이 닿은 쪽 가장자리의 짧은 반응
    g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#eaf4ff'; g.font = `700 38px ${FONT}`; g.fillText('버스 위치', 40, 96);
    g.fillStyle = '#1f9bd8'; rrect(g, 380, 66, 120, 60, 14); g.fill(); g.fillStyle = '#fff'; g.font = `700 36px ${FONT}`; g.textAlign = 'center'; g.fillText(ROUTE.no + '번', 440, 97);
    /* 노선: 아래에서 위로 달린다. 정류장 이름은 처음부터 있고, 같은 버스의 정보가 닿으면 지나온 구간과 위치가 켜진다 */
    const n = ROUTE.stops.length, y0 = 760, y1 = 200, x = 130, yAt = (t) => y0 + ((y1 - y0) * t) / (n - 1);
    g.lineCap = 'round'; g.strokeStyle = '#1b2c4d'; g.lineWidth = 12; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
    const reach = ROUTE.here * st.route;
    if (st.route > 0.01) { g.strokeStyle = '#1f9bd8'; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, yAt(Math.max(reach, st.pin > 0.5 ? st.busT : 0))); g.stroke(); }
    ROUTE.stops.forEach((name, i) => {
      const y = yAt(i), sel = i === ROUTE.here, lit = st.route > 0.01 && i <= reach + 0.001;
      g.fillStyle = '#04070f'; g.beginPath(); g.arc(x, y, sel ? 17 : 12, 0, 7); g.fill(); g.strokeStyle = sel ? '#7fe3ff' : lit ? '#8fb4e6' : '#4b5f85'; g.lineWidth = sel ? 7 : 5; g.stroke();
      g.textAlign = 'left'; g.fillStyle = sel ? '#ffffff' : lit ? '#b4c6e2' : '#7f93b6'; g.font = `${sel ? 700 : 500} ${sel ? 34 : 29}px ${FONT}`; g.fillText(name, x + 44, y);
      if (sel) { g.fillStyle = '#7fe3ff'; g.font = `600 24px ${FONT}`; g.fillText('선택한 정류장', x + 44, y + 38); }
    });
    if (st.pin > 0.01) {                                                   // 같은 버스의 위치
      const y = yAt(st.busT); g.globalAlpha = st.pin;
      g.fillStyle = 'rgba(70,207,255,0.22)'; g.beginPath(); g.arc(x, y, 26 + 14 * st.pin, 0, 7); g.fill();
      g.fillStyle = '#46cfff'; rrect(g, x - 26, y - 17, 52, 34, 9); g.fill(); g.fillStyle = '#03101f'; g.font = `700 22px ${FONT}`; g.textAlign = 'center'; g.fillText(ROUTE.no, x, y + 1);
      g.globalAlpha = 1;
    }
    /* 아래 정보 영역: 정보가 닿기 전에는 자리만 있다 */
    g.fillStyle = '#0b1a36'; rrect(g, 28, 850, Wc - 56, 270, 28); g.fill();
    g.textAlign = 'left'; g.fillStyle = '#8fb4e6'; g.font = `600 26px ${FONT}`; g.fillText(`${ROUTE.no}번 · ${ROUTE.dest}`, 60, 902);
    g.fillStyle = '#ffffff'; g.font = `700 30px ${FONT}`; g.fillText(ROUTE.stops[ROUTE.here], 60, 968);
    g.fillStyle = 'rgba(140,170,220,0.25)'; g.fillRect(60, 1010, Wc - 120, 2);
    g.fillStyle = '#c9d6ea'; g.font = `600 30px ${FONT}`; g.fillText(`다음 ${ROUTE.stops[ROUTE.here + 1]}`, 60, 1060);
    if (st.card > 0.01) {
      g.globalAlpha = st.card; g.textAlign = 'right';
      g.fillStyle = '#7fe3ff'; g.font = `700 44px ${FONT}`; g.fillText(st.here, Wc - 60, 966);
      g.fillStyle = '#ffffff'; g.font = `700 40px ${FONT}`; g.fillText(st.next, Wc - 60, 1058); g.globalAlpha = 1;
    } else { g.fillStyle = 'rgba(140,170,220,0.28)'; rrect(g, Wc - 150, 954, 90, 22, 11); g.fill(); rrect(g, Wc - 150, 1048, 90, 22, 11); g.fill(); }
    pScr.t.needsUpdate = true;
  }

  let bitKey = '', phoneKey = '';
  const from = new THREE.Vector3(), to = new THREE.Vector3(), mid = new THREE.Vector3(), tmp = new THREE.Vector3(), qx = new THREE.Quaternion(), xAxis = new THREE.Vector3(1, 0, 0), zAxis = new THREE.Vector3(0, 0, 1);
  /* 빛 한 번: t(0~1) 가 0→0.22 신호가 켜지고, 0.2→1 머리가 떠나 도착하고, 꼬리가 따라 들어가 사라진다 */
  const TAIL = 0.17;
  let ARRIVE = 0.8; { let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (ease(m) * (1 + TAIL) < 1) lo = m; else hi = m; } ARRIVE = 0.2 + 0.8 * lo; }   // 머리가 목적지에 닿는 때
  const runComet = (ci, t, lift) => {
    const { geo, pts } = comets[ci], P = geo.attributes.position, K = geo.attributes.aK, A = geo.attributes.aA;
    const on = t > 0.2 && t < 1;
    pts.visible = on;
    if (on) {
      const h = ease(ramp(0.2, 1, t)) * (1 + TAIL);
      mid.lerpVectors(from, to, 0.5); mid.y += lift;
      for (let j = 0; j < NT; j++) {
        const k = j / (NT - 1), u = h - k * TAIL, v = clamp01(u), w = 1 - v;
        tmp.set(w * w * from.x + 2 * w * v * mid.x + v * v * to.x, w * w * from.y + 2 * w * v * mid.y + v * v * to.y, w * w * from.z + 2 * w * v * mid.z + v * v * to.z);
        P.setXYZ(j, tmp.x, tmp.y, tmp.z); K.setX(j, k); A.setX(j, u >= 0 && u <= 1 ? 1 : 0);
      }
      P.needsUpdate = K.needsUpdate = A.needsUpdate = true;
    }
    const arrive = ARRIVE;
    return { emit: ease(ramp(0, 0.16, t)) * (1 - ease(ramp(0.3, 0.6, t))), hit: ease(ramp(arrive - 0.03, arrive + 0.04, t)) * (1 - ease(ramp(arrive + 0.06, 1.0, t))) };
  };
  const setDot = (i, v, size, alpha) => { dotGeo.attributes.position.setXYZ(i, v.x, v.y, v.z); dotGeo.attributes.aS.setX(i, size); dotGeo.attributes.aA.setX(i, alpha); };

  return {
    phone, bit, bitCenter, bitPort, BIT_AT,
    get keys() { return [bitKey, phone.visible ? phoneKey : '']; },   // 확인용: 두 화면의 현재 상태(스마트폰이 없을 때는 빈 값)
    /** 화면 속 문구는 글꼴이 준비된 뒤 다시 그린다 */
    redraw() { bitKey = phoneKey = ''; },
    /**
     * @param s { g(진행률), time, signal(버스 지붕의 신호점, 세계 좌표), dist, trailK, px,
     *            camera, slot: { nx, ny(화면 속 자리 -1~1), size(화면 높이에서 차지하는 비율), side(빛이 닿는 테두리: -1 왼쪽, 0 위쪽) } }
     */
    update(s) {
      const g = s.g;
      cometU.uPx.value = s.px; cometU.uT.value = s.time;
      /* 스마트폰: 화면 아래에서 올라와 자리를 잡고, 버스가 떠날 때 내려간다. 카메라가 움직여도 화면 속 자리는 그대로다 */
      const pin = ease(ramp(TL.phoneIn[0], TL.phoneIn[1], g)) * (1 - ease(ramp(TL.phoneOut[0], TL.phoneOut[1], g)));
      phone.visible = pin > 0.002;
      if (phone.visible) {
        const cam = s.camera, e = cam.matrixWorld.elements, halfH = Math.tan((cam.fov * Math.PI) / 360) * PHONE_D, halfW = halfH * cam.aspect;
        const scale = (s.slot.size * 2 * halfH) / 0.156, drop = (1 - pin) * (1.3 + s.slot.size + s.slot.ny) * halfH;
        phone.position.copy(cam.position)
          .addScaledVector(tmp.set(e[8], e[9], e[10]), -PHONE_D)                                  // 앞
          .addScaledVector(tmp.set(e[0], e[1], e[2]), s.slot.nx * halfW)                          // 오른쪽
          .addScaledVector(tmp.set(e[4], e[5], e[6]), s.slot.ny * halfH - drop);                  // 위
        phone.quaternion.copy(cam.quaternion).multiply(qx.setFromAxisAngle(zAxis, -0.045)).multiply(qx.setFromAxisAngle(xAxis, (1 - pin) * 0.45));
        phone.scale.setScalar(scale); phone.updateMatrixWorld(true);
      }

      /* ① 버스 → BIT 몸체 옆면 */
      from.copy(s.signal); to.copy(bitPort);
      const tb = ramp(TL.bitSignal[0], TL.bitSignal[1], g), fb = runComet(0, tb, 0.28);
      setDot(0, from, 9 + 5 * fb.emit, fb.emit); setDot(1, to, 13, fb.hit * 0.9);
      /* ② 같은 버스의 정보 → 스마트폰 테두리(화면 위를 지나지 않는다) */
      const tph = phone.visible ? ramp(TL.phoneSignal[0], TL.phoneSignal[1], g) : 0;
      from.copy(s.signal);
      if (s.slot.side < 0) to.set(-0.0405, 0.03, -0.002); else to.set(-0.012, 0.0815, -0.002);
      to.applyMatrix4(phone.matrixWorld);
      const fp = runComet(1, tph, 0.18);
      setDot(2, from, 9 + 5 * fp.emit, fp.emit); setDot(3, to, 12, fp.hit * 0.9);
      dotGeo.attributes.position.needsUpdate = dotGeo.attributes.aS.needsUpdate = dotGeo.attributes.aA.needsUpdate = true;

      /* BIT 화면: 빛이 닿으면 해당 노선의 줄이 반응하고 도착정보가 바뀐다 */
      const status = g < 1.1 ? '3분 후' : g < 1.24 ? '2분 후' : g < TL.bitArrive ? '곧 도착' : g < TL.depart + 0.02 ? '도착' : '14분 후';
      const on = g >= TL.bitArrive && g < TL.depart + 0.02, hitQ = Math.round(fb.hit * 6) / 6;
      const key = `${status}|${on ? 1 : 0}|${hitQ}`;
      if (key !== bitKey) { bitKey = key; drawBit({ status, on, hit: hitQ }); }

      /* 스마트폰 화면: 테두리의 반응 → 노선 → 위치 → 도착정보 */
      if (phone.visible) {
        const q = (v) => Math.round(v * 24) / 24;
        const busT = ROUTE.here + clamp01((s.dist - STOP.dist) / 160);
        const st = { hit: Math.round(fp.hit * 6) / 6, route: q(ease(ramp(TL.route[0], TL.route[1], g))), pin: q(ramp(TL.pin[0], TL.pin[1], g)), card: q(ramp(TL.card[0], TL.card[1], g)), busT: Math.round(busT * 60) / 60, here: g < TL.depart + 0.005 ? '도착' : '출발', next: busT < 2.02 ? '3분 후' : busT < 2.3 ? '2분 후' : '1분 후' };
        const pk = JSON.stringify(st);
        if (pk !== phoneKey) { phoneKey = pk; drawPhone(st); }
      }
      trailU.uX.value = s.busX; trailU.uK.value = s.trailK; trailU.uT.value = s.time;
    },
  };
}
