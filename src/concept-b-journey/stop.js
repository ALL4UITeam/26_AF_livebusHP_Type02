/**
 * 정류장 구간(5차): 태양광 BIT 안내기, 쉘터, 스마트폰, 정보가 전해지는 짧은 빛. (지나온 노선의 빛은 world.js 의 '선택 노선'으로 옮겼다)
 *
 * BIT 는 브로슈어(올포랜드 AI LIVEBUS, eBIT 태양광형)의 구조를 따른다:
 * 둥근 받침 → 각진 지주 → 지주 앞에 붙은 세로형 화면 → 지주 꼭대기의 기울어진 직사각형 태양광 패널.
 * 재질과 화면 색은 이 3D 세계(검정·남색·시안)에 맞췄다. 치수는 브로슈어 그림의 비례를 따른 값이며 실측값이 아니다.
 *
 * 정보 전달 효과는 '작은 신호 → 짧은 빛의 이동 → 목적지의 반응 → 흔적 소멸' 한 번으로 끝난다.
 * 선이 항상 켜져 있지 않고, 모든 상태가 스크롤 진행률로만 정해져 되돌려도 같은 값이 나온다.
 */
import { fatLines, dots, RES } from './lines.js';

const FONT = '"Freesentation", "Pretendard Variable", Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
export const ROUTE = { no: '01', dest: 'LIVEBUS행', stops: ['시청 앞', '중앙시장', '라이브 정류장', '도서관', '터미널'], here: 2 };

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ramp = (a, b, x) => clamp01((x - a) / (b - a));
const ease = (t) => t * t * (3 - 2 * t);

/**
 * 진행률 위의 구간들. 장면은 스크롤이 정하고, 정보 전달은 장면이 정착한 뒤 시간으로 재생된다(FX 참고).
 */
export const TL = {
  bitScene: [1.352, 1.545],                 // BIT 장면에 머무는 구간: 이 안에서 정착하면 전달이 시간으로 재생된다
  phoneIn: [1.57, 1.655],                   // 스마트폰이 올라오는 구간. 다 올라오면 BIS 전달이 재생된다
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
  const bitEdge = [new THREE.Vector3(-0.475, 2.42, 0.1).applyMatrix4(bit.matrixWorld), new THREE.Vector3(-0.475, 1.74, 0.1).applyMatrix4(bit.matrixWorld)], pEdge = [new THREE.Vector3(), new THREE.Vector3()];

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

  /* ── 정보의 전달(서비스의 핵심 효과). 발사가 아니라 '눈으로 따라갈 수 있는 흐름'이다:
     ① 버스의 신호점이 서서히 밝아진다 → ② 가느다란 경로가 버스에서 기기까지 낮은 밝기로 드러난다 → ③ 부드러운 빛의 구간이 경로를 따라 고른 속도로 간다
     → ④ 수신 지점이 밝아지고 기기 테두리에 얇은 빛이 짧게 퍼진 뒤, 화면 속 정보가 반응한다. 경로와 잔광은 서서히 사라진다.
     장면은 스크롤이 정하고, 전달은 장면이 정착한 뒤 '시간'으로 재생한다(스크롤 속도와 무관). 깊이 판정을 하므로 차체나 기기 뒤로 가면 가려진다 ── */
  const NS = 44, FX = { prep: 0.55, path: 0.75, flow: 1.7, recv: 0.75, rest: 7.5 };   // 초. 한 번의 전달 약 3.75초, 다음 전달까지 7.5초 쉰다
  FX.arrive = FX.prep + FX.path + FX.flow; FX.total = FX.arrive + FX.recv;
  const mkFx = () => {
    const path = fatLines(THREE, NS, { px: [0.9, 2.0], cap: 0, order: 6, frag: 'vec4 shade() { return vec4(mix(vec3(0.1, 0.42, 0.95), vec3(0.5, 0.86, 1.0), vE.y) * vE.x * lineA(), 1.0); }' });
    const edge = fatLines(THREE, 2, { px: [0.9, 1.8], cap: 1, order: 7, frag: 'vec4 shade() { return vec4(vec3(0.36, 0.8, 1.0) * vE.x * (1.0 - along()) * lineA(), 1.0); }' });   // 테두리를 따라 퍼지는 얇은 빛
    path.mesh.visible = edge.mesh.visible = false; scene.add(path.mesh, edge.mesh);
    return { path, edge, t: -1, vis: 0, done: false, since: 99 };   // t: 이번 전달이 시작된 뒤의 시간(-1 = 대기), since: 정보가 갱신된 뒤의 시간
  };
  const fx = [mkFx(), mkFx()];
  const sig = dots(THREE, 4, { px: [4, 12], order: 7 }); scene.add(sig.mesh);      // 출발점의 작은 신호, 도착점의 수신

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
  /* 경로 위의 위치는 '화면에서의 길이'로 잰다: 멀리 있는 구간에서 느리고 카메라 가까이에서 갑자기 빨라지는 일이 없다 */
  const SM = 32, sp = [], sl = new Float32Array(SM + 1), pr = new THREE.Vector3(), pa = [0, 0, 0], pb = [0, 0, 0], e0 = new THREE.Vector3(), e1 = new THREE.Vector3();
  for (let i = 0; i <= SM; i++) sp.push(new THREE.Vector3());
  const at = (f, out) => { const x = clamp01(f) * sl[SM]; let i = 1; while (i < SM && sl[i] < x) i++; const k = sl[i] > sl[i - 1] ? (x - sl[i - 1]) / (sl[i] - sl[i - 1]) : 0; tmp.lerpVectors(sp[i - 1], sp[i], k); out[0] = tmp.x; out[1] = tmp.y; out[2] = tmp.z; return out; };
  let lastTime = null;
  /**
   * 전달 한 건을 한 프레임 진행하고 그린다. from·to 는 이미 채워져 있다.
   * @param active 이 기기의 장면에 머물러 있는가  @param before 아직 이 장면에 오지 않았는가(되돌아간 경우 포함)
   * @returns { hit(수신 직후의 짧은 반응 0~1), done(정보가 갱신되었는가), since(갱신 뒤의 시간) }
   */
  const runFx = (i, s, dt, active, before, lift, edgeA, edgeB) => {
    const f = fx[i];
    if (before) { f.t = -1; f.done = false; f.since = 99; }
    else if (!active) { if (f.t >= 0 || !f.done) { f.done = true; f.since = Math.max(f.since, 9); } f.t = -1; }      // 지나간 장면: 효과는 정리하고 정보는 갱신된 것으로 둔다
    else if (s.reduce) { f.t = -1; f.done = true; f.since = 9; }                                                // 동작 줄이기: 움직임 없이 갱신된 정보만 보인다
    else if (f.t < 0) { if (s.settled) f.t = 0; }                                                               // 장면이 정착하면 시작한다
    else { f.t += dt; if (f.t > FX.total + FX.rest) f.t = 0; }                                                  // 한 번이 끝나면 충분히 쉰 뒤에 다시
    if (f.t >= FX.arrive && !f.done) { f.done = true; f.since = 0; }
    if (f.done) f.since += dt;
    f.vis += ((active && f.t >= 0 && f.t < FX.total + 0.1 ? 1 : 0) - f.vis) * (1 - Math.exp(-dt * 7));          // 장면을 떠나면 0.3초쯤에 걸쳐 사라진다
    const on = f.vis > 0.004 && f.t >= 0, t = Math.max(0, f.t);
    f.path.mesh.visible = f.edge.mesh.visible = on;
    const prep = ease(ramp(0, FX.prep, t)), out = 1 - ease(ramp(FX.arrive + 0.15, FX.total, t));
    const hit = on ? ease(ramp(FX.arrive - 0.12, FX.arrive + 0.2, t)) * (1 - ease(ramp(FX.arrive + 0.3, FX.total, t))) * f.vis : 0;
    if (on) {
      mid.lerpVectors(from, to, 0.5); mid.y += lift;
      let px = 0, py = 0;
      for (let k = 0; k <= SM; k++) { const v = k / SM, w = 1 - v; sp[k].set(w * w * from.x + 2 * w * v * mid.x + v * v * to.x, w * w * from.y + 2 * w * v * mid.y + v * v * to.y, w * w * from.z + 2 * w * v * mid.z + v * v * to.z);
        pr.copy(sp[k]).project(s.camera); const x = pr.x * RES.value.x * 0.5, y = pr.y * RES.value.y * 0.5; sl[k] = k ? sl[k - 1] + Math.hypot(x - px, y - py) : 0; px = x; py = y; }
      const front = ramp(FX.prep, FX.prep + FX.path, t) * 1.12;                               // 경로가 드러나는 앞 가장자리(부드럽게)
      const ft = ramp(FX.prep + FX.path, FX.arrive, t), c = -0.06 + 1.1 * (0.1 * ease(ft) + 0.9 * ft);   // 빛의 중심: 거의 고른 속도, 처음과 끝만 살짝 누그러진다
      const flowOn = ease(ramp(FX.prep + FX.path - 0.05, FX.prep + FX.path + 0.3, t)) * (1 - ease(ramp(FX.arrive, FX.arrive + 0.25, t)));
      const val = (u) => { const base = 0.17 * (1 - ease(ramp(front - 0.12, front, u))) * out; const d = u - c, g = Math.exp(-((d > 0 ? d / 0.045 : d / 0.17) ** 2)) * flowOn; return [(base + 0.95 * g) * f.vis, g]; };
      for (let j = 0; j < NS; j++) { const u0 = j / NS, u1 = (j + 1) / NS, a = val(u0), b = val(u1); f.path.set(j, at(u0, pa), at(u1, pb), [a[0], a[1], 0, 0], [b[0], b[1], 0, 0], 0.04); }
      f.path.done();
      const spread = 0.25 + 0.75 * ease(ramp(FX.arrive - 0.05, FX.arrive + 0.35, t));           // 수신 지점에서 테두리를 따라 양쪽으로 짧게 퍼진다
      for (let k = 0; k < 2; k++) { const e = k ? edgeB : edgeA; e0.copy(to); e1.lerpVectors(to, e, spread); f.edge.set(k, [e0.x, e0.y, e0.z], [e1.x, e1.y, e1.z], [hit, 0, 0, 0], [hit, 0, 0, 0], 0.03); }
      f.edge.done();
    }
    sig.set(i * 2, [from.x, from.y, from.z], 0.2 + 0.06 * prep, [0.36, 0.82, 1.0], on ? prep * (0.45 + 0.55 * (1 - ramp(FX.prep + FX.path, FX.arrive, t))) * out * f.vis : 0, 0.26, 0.85);
    sig.set(i * 2 + 1, [to.x, to.y, to.z], 0.24, [0.36, 0.82, 1.0], hit * 0.85, 0.24, 0.9);
    return { hit, done: f.done, since: f.since };
  };

  return {
    phone, bit, bitCenter, bitPort, BIT_AT,
    get fxState() { return fx.map((f) => ({ t: +f.t.toFixed(2), done: f.done, vis: +f.vis.toFixed(2) })); },   // 확인용: 두 전달의 진행 상태
    get keys() { return [bitKey, phone.visible ? phoneKey : '']; },   // 확인용: 두 화면의 현재 상태(스마트폰이 없을 때는 빈 값)
    /** 화면 속 문구는 글꼴이 준비된 뒤 다시 그린다 */
    redraw() { bitKey = phoneKey = ''; },
    /**
     * @param s { g(진행률), time, settled(스크롤이 멈춰 장면이 정착했는가), reduce(동작 줄이기), signal(버스 지붕의 신호점, 세계 좌표), dist, px,
     *            camera, slot: { nx, ny(화면 속 자리 -1~1), size(화면 높이에서 차지하는 비율), side(빛이 닿는 테두리: -1 왼쪽, 0 위쪽) } }
     */
    update(s) {
      const g = s.g;
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

      const dt = lastTime == null ? 0 : Math.min(0.05, Math.max(0, s.time - lastTime)); lastTime = s.time;
      const inBis = g >= TL.phoneIn[1] && g < TL.phoneOut[0];
      /* ① 버스 → BIT 몸체 옆면(태양광 패널이 아니다). 수신 뒤에는 몸체 옆 테두리를 따라 위아래로 얇은 빛이 퍼진다 */
      from.copy(s.signal); to.copy(bitPort);
      const fb = runFx(0, s, dt, g >= TL.bitScene[0] && g < TL.bitScene[1], g < TL.bitScene[0], 0.3, bitEdge[0], bitEdge[1]);
      /* ② 같은 버스의 정보 → 스마트폰 테두리. 바깥의 빛은 테두리에서 끝나고(화면 위를 지나지 않는다), 그 다음은 화면 안에서 이어진다 */
      from.copy(s.signal);
      const side = s.slot.side < 0;
      if (side) to.set(-0.0405, 0.03, -0.002); else to.set(-0.012, 0.0815, -0.002);
      to.applyMatrix4(phone.matrixWorld);
      if (side) { tmp.set(-0.0405, 0.066, -0.002).applyMatrix4(phone.matrixWorld); e0.set(-0.0405, -0.012, -0.002).applyMatrix4(phone.matrixWorld); }
      else { tmp.set(-0.031, 0.0815, -0.002).applyMatrix4(phone.matrixWorld); e0.set(0.014, 0.0815, -0.002).applyMatrix4(phone.matrixWorld); }
      pEdge[0].copy(tmp); pEdge[1].copy(e0);
      const fp = runFx(1, s, dt, inBis, g < TL.phoneIn[1], 0.2, pEdge[0], pEdge[1]);
      if (inBis && !fx[0].done) { fx[0].done = true; fx[0].since = 9; }                           // 두 기기의 도착정보는 항상 일치한다
      sig.done();

      /* BIT 화면: 빛이 닿으면 해당 노선의 줄만 반응하고(화면 전체가 번쩍이지 않는다) 도착정보가 바뀐다 */
      const status = g >= TL.depart + 0.02 ? '14분 후' : fb.done ? '도착' : g < 1.1 ? '3분 후' : g < 1.24 ? '2분 후' : '곧 도착';
      const on = fb.done && g < TL.depart + 0.02, hitQ = Math.round(Math.max(fb.hit, fb.done ? 1 - ramp(0, 0.9, fb.since) : 0) * 8) / 8;
      const key = `${status}|${on ? 1 : 0}|${hitQ}`;
      if (key !== bitKey) { bitKey = key; drawBit({ status, on, hit: hitQ }); }

      /* 스마트폰 화면: 테두리의 반응 → 노선 → 위치 → 도착정보(수신 뒤 시간에 따라 차례로) */
      if (phone.visible) {
        const q = (v) => Math.round(v * 24) / 24, z = fp.done ? fp.since : -1;
        const busT = ROUTE.here + clamp01((s.dist - STOP.dist) / 160);
        const st = { hit: Math.round(fp.hit * 8) / 8, route: q(ease(ramp(0.15, 0.75, z))), pin: q(ramp(0.7, 1.05, z)), card: q(ramp(1.0, 1.45, z)), busT: Math.round(busT * 60) / 60, here: g < TL.depart + 0.005 ? '도착' : '출발', next: busT < 2.02 ? '3분 후' : busT < 2.3 ? '2분 후' : '1분 후' };
        const pk = JSON.stringify(st);
        if (pk !== phoneKey) { phoneKey = pk; drawPhone(st); }
      }
    },
  };
}
