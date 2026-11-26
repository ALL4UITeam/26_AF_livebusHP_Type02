/**
 * 정류장 구간: 쉘터, 태양광 BIT 안내기, 스마트폰, 정보의 빛, 지나온 노선의 빛.
 *
 * BIT 는 요청서에 적힌 구조(기울어진 직사각형 태양광 패널 · 세로형 화면 · 지주 · 받침)만으로 만든 대역이다.
 * 브로슈어 원본이 작업 환경에 없어 치수와 세부 형태는 확정하지 않았다(받으면 이 파일의 buildBit 만 고치면 된다).
 * 화면 글자는 캔버스에 그려 기기 표면에 입힌다. 상태는 스크롤 진행률로만 정해져 되돌려도 같은 값이 나온다.
 */
const FONT = '"Freesentation", "Pretendard Variable", Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
export const ROUTE = { no: '01', dest: 'LIVEBUS행', stops: ['시청 앞', '중앙시장', '라이브 정류장', '도서관', '터미널'], here: 2 };

export function buildStop(THREE, scene, M, STOP, path) {
  const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const rr = (w, h, r) => { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
  const slab = (w, h, d, r, mat, bevel = 0.012) => new THREE.Mesh(new THREE.ExtrudeGeometry(rr(w, h, r), { depth: d, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3 }), mat);
  const screenTex = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return { c, g: c.getContext('2d'), t }; };
  const glassOver = new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 0, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.16, envMapIntensity: 1.2 });
  const Y = 0.12;                                                     // 인도 높이

  /* ── 쉘터: 가는 기둥, 얇은 지붕, 어두운 유리 뒷면, 벤치 ── */
  const shelter = new THREE.Group(); shelter.position.set(STOP.x - 1.4, Y, 7.35); scene.add(shelter);
  const roof = slab(4.6, 1.7, 0.07, 0.12, M.trim); roof.rotation.x = -Math.PI / 2; roof.position.set(0, 2.55, 0); shelter.add(roof);
  for (const x of [-2.1, 2.1]) for (const z of [-0.7, 0.7]) add(new THREE.CylinderGeometry(0.035, 0.035, 2.55, 10), M.chrome, x, 1.275, z, shelter);
  const back = add(new THREE.BoxGeometry(4.2, 1.7, 0.02), new THREE.MeshPhysicalMaterial({ color: 0x05080f, metalness: 0, roughness: 0.06, clearcoat: 1, transparent: true, opacity: 0.32, envMapIntensity: 1.1 }), 0, 1.35, 0.72, shelter);
  add(new THREE.BoxGeometry(3.0, 0.06, 0.4), M.trim, 0, 0.48, 0.35, shelter);
  for (const x of [-1.2, 1.2]) add(new THREE.BoxGeometry(0.06, 0.48, 0.34), M.chrome, x, 0.24, 0.35, shelter);
  add(new THREE.BoxGeometry(4.3, 0.025, 0.03), M.cyan, 0, 2.52, -0.83, shelter);   // 지붕 끝의 가는 시안색 선

  /* ── BIT 안내기 ── */
  const bit = new THREE.Group(); bit.position.set(STOP.x + 6.0, Y, 6.2); bit.rotation.y = 0.5; scene.add(bit);
  const base = slab(0.78, 0.5, 0.07, 0.08, M.dark); base.rotation.x = -Math.PI / 2; bit.add(base);                    // 받침
  add(new THREE.BoxGeometry(0.34, 0.16, 0.24), M.dark, 0, 0.15, 0, bit);
  const pole = slab(0.15, 2.9, 0.11, 0.03, M.body, 0.01); pole.position.set(0, 1.52, -0.055); bit.add(pole);          // 지주
  const body = slab(0.74, 1.3, 0.1, 0.05, M.trim, 0.014); body.position.set(0, 1.6, 0.06); bit.add(body);            // 세로형 화면의 몸체
  const bitScr = screenTex(512, 912);
  add(new THREE.PlaneGeometry(0.62, 1.1), new THREE.MeshBasicMaterial({ map: bitScr.t }), 0, 1.63, 0.176, bit);
  add(new THREE.PlaneGeometry(0.66, 1.16), glassOver, 0, 1.63, 0.179, bit);
  add(new THREE.BoxGeometry(0.2, 0.012, 0.01), M.cyan, 0, 1.01, 0.176, bit);                                           // 상태 표시등
  const arm = add(new THREE.BoxGeometry(0.07, 0.07, 0.42), M.chrome, 0, 2.93, 0.02, bit); arm.rotation.x = -0.42;     // 패널 받침대
  const panel = new THREE.Group(); panel.position.set(0, 3.07, 0.02); panel.rotation.x = -0.42; bit.add(panel);       // 위쪽의 기울어진 태양광 패널
  const frame = slab(1.34, 0.86, 0.035, 0.03, M.chrome, 0.006); frame.rotation.x = -Math.PI / 2; panel.add(frame);
  const sol = screenTex(256, 164); sol.g.fillStyle = '#03060e'; sol.g.fillRect(0, 0, 256, 164); sol.g.strokeStyle = 'rgba(120,160,230,0.35)'; sol.g.lineWidth = 1;
  for (let i = 1; i < 6; i++) { sol.g.beginPath(); sol.g.moveTo((i * 256) / 6, 0); sol.g.lineTo((i * 256) / 6, 164); sol.g.stroke(); } for (let j = 1; j < 4; j++) { sol.g.beginPath(); sol.g.moveTo(0, (j * 164) / 4); sol.g.lineTo(256, (j * 164) / 4); sol.g.stroke(); } sol.t.needsUpdate = true;
  const cells = add(new THREE.PlaneGeometry(1.26, 0.78), new THREE.MeshPhysicalMaterial({ map: sol.t, color: 0x1a2c55, metalness: 0.4, roughness: 0.12, clearcoat: 1, envMapIntensity: 1.6 }), 0, 0.05, 0, panel); cells.rotation.x = -Math.PI / 2;
  const bitTop = new THREE.Vector3(); bit.updateMatrixWorld(true); bitTop.set(0, 2.3, 0.12).applyMatrix4(bit.matrixWorld);

  /* ── 스마트폰: 두께가 있는 몸체, 금속 테두리, 유리 화면 ── */
  const phone = new THREE.Group(); scene.add(phone);
  const pBody = slab(0.074, 0.156, 0.0075, 0.012, M.chrome, 0.0012); pBody.position.z = -0.0075; phone.add(pBody);
  const pBack = slab(0.071, 0.153, 0.001, 0.011, M.body, 0.0005); pBack.position.z = -0.0096; phone.add(pBack);
  const pScr = screenTex(540, 1170);
  add(new THREE.ShapeGeometry(rr(0.0705, 0.1525, 0.0105), 8), M.dark, 0, 0, 0.00135, phone);
  const pFace = add(new THREE.PlaneGeometry(0.066, 0.143), new THREE.MeshBasicMaterial({ map: pScr.t }), 0, 0, 0.0015, phone);
  add(new THREE.ShapeGeometry(rr(0.0705, 0.1525, 0.0105), 8), glassOver, 0, 0, 0.0018, phone);
  add(new THREE.CircleGeometry(0.0016, 12), M.dark, 0, 0.0655, 0.0019, phone);
  phone.visible = false;

  /* ── 정보의 빛: 버스에서 나와 안내기를 지나 스마트폰까지 이어지는 한 줄기 ── */
  const NF = 70, flowPos = new Float32Array(NF * 3);
  const flowGeo = new THREE.BufferGeometry(); flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
  const flow = new THREE.Line(flowGeo, new THREE.LineBasicMaterial({ color: 0x66d8ff, transparent: true, opacity: 0, depthTest: false, blending: THREE.AdditiveBlending })); flow.frustumCulled = false; flow.renderOrder = 5; scene.add(flow);
  const sparkGeo = new THREE.BufferGeometry(); sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  const spark = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xcdf2ff, size: 5, sizeAttenuation: false, transparent: true, opacity: 0, depthTest: false, blending: THREE.AdditiveBlending })); spark.frustumCulled = false; spark.renderOrder = 6; scene.add(spark);
  const stopRing = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), new THREE.MeshBasicMaterial({ color: 0x5fd4ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); stopRing.rotation.x = -Math.PI / 2; stopRing.position.set(STOP.x + 3, 0.06, 5.6); scene.add(stopRing);

  /* ── 지나온 노선의 빛(마무리에서 남는 한 줄) ── */
  const tp = [], tx = [], ti = [];
  path.forEach(([x, z], i) => { tp.push(x, 0.045, z - 0.11, x, 0.045, z + 0.11); tx.push(x, x); if (i) { const a = (i - 1) * 2; ti.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
  const tGeo = new THREE.BufferGeometry(); tGeo.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); tGeo.setAttribute('aX', new THREE.Float32BufferAttribute(tx, 1)); tGeo.setIndex(ti);
  const trailU = { uX: { value: 0 }, uK: { value: 0 }, uT: { value: 0 } };
  const trail = new THREE.Mesh(tGeo, new THREE.ShaderMaterial({ uniforms: trailU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'attribute float aX; varying float vX; void main() { vX = aX; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float vX; uniform float uX, uK, uT; void main() { float on = smoothstep(uX - 6.0, uX - 16.0, vX) * smoothstep(uX - 420.0, uX - 60.0, vX); float pulse = 0.55 + 0.45 * pow(0.5 + 0.5 * sin((vX - uT * 30.0) * 0.12), 6.0); gl_FragColor = vec4(vec3(0.16, 0.66, 1.0) * on * pulse * uK, 1.0); }' })); trail.frustumCulled = false; scene.add(trail);

  /* ── 화면 그리기 ── */
  const rrect = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  function drawBit(st) {
    const g = bitScr.g; g.fillStyle = '#02050c'; g.fillRect(0, 0, 512, 912);
    g.fillStyle = '#0b1a36'; g.fillRect(0, 0, 512, 150); g.fillStyle = '#eaf4ff'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.font = `700 40px ${FONT}`; g.fillText('버스 도착정보', 36, 58); g.font = `600 27px ${FONT}`; g.fillStyle = '#8fb4e6'; g.fillText(ROUTE.stops[ROUTE.here], 36, 112);
    const rows = [[ROUTE.no, ROUTE.dest, st.status, true], ['12', '시청 방면', '8분 후', false], ['30', '터미널 방면', '15분 후', false]];
    rows.forEach(([no, dest, eta, hero], i) => {
      const y = 190 + i * 228;
      if (hero && st.on) { g.fillStyle = 'rgba(40,150,230,0.2)'; rrect(g, 18, y - 6, 476, 208, 18); g.fill(); g.fillStyle = '#46cfff'; g.fillRect(18, y + 20, 7, 156); }
      g.fillStyle = hero ? '#1f9bd8' : '#22355c'; rrect(g, 44, y + 28, 122, 74, 14); g.fill();
      g.fillStyle = '#fff'; g.font = `700 52px ${FONT}`; g.textAlign = 'center'; g.fillText(no, 105, y + 68);
      g.textAlign = 'left'; g.fillStyle = '#9db3d6'; g.font = `600 28px ${FONT}`; g.fillText(dest, 190, y + 66);
      g.fillStyle = hero ? (eta === '도착' ? '#7fe3ff' : '#ffffff') : '#c9d6ea'; g.font = `700 ${hero ? 62 : 50}px ${FONT}`; g.fillText(eta, 44, y + 152);
      g.fillStyle = 'rgba(140,170,220,0.22)'; g.fillRect(36, y + 214, 440, 2);
    });
    g.fillStyle = '#5f7396'; g.font = `500 22px ${FONT}`; g.fillText('시연용 예시 정보', 36, 884);
    bitScr.t.needsUpdate = true;
  }
  function drawPhone(st) {
    const g = pScr.g, Wc = 540; g.fillStyle = '#04070f'; g.fillRect(0, 0, Wc, 1170);
    g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#eaf4ff'; g.font = `700 38px ${FONT}`; g.fillText('버스 위치', 40, 96);
    g.fillStyle = '#1f9bd8'; rrect(g, 380, 66, 120, 60, 14); g.fill(); g.fillStyle = '#fff'; g.font = `700 36px ${FONT}`; g.textAlign = 'center'; g.fillText(ROUTE.no + '번', 440, 97);
    /* 노선: 아래에서 위로 달린다 */
    const n = ROUTE.stops.length, y0 = 760, y1 = 200, x = 130, yAt = (t) => y0 + ((y1 - y0) * t) / (n - 1);
    g.lineCap = 'round'; g.strokeStyle = '#1b2c4d'; g.lineWidth = 12; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
    const top = yAt((n - 1) * st.route);
    if (st.route > 0.01) { g.strokeStyle = '#1f9bd8'; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, top); g.stroke(); }
    ROUTE.stops.forEach((name, i) => {
      if (i / (n - 1) > st.route + 0.001) return;
      const y = yAt(i), sel = i === ROUTE.here;
      g.fillStyle = '#04070f'; g.beginPath(); g.arc(x, y, sel ? 17 : 12, 0, 7); g.fill(); g.strokeStyle = sel ? '#7fe3ff' : '#8fa6c8'; g.lineWidth = sel ? 7 : 5; g.stroke();
      g.textAlign = 'left'; g.fillStyle = sel ? '#ffffff' : '#8fa6c8'; g.font = `${sel ? 700 : 500} ${sel ? 34 : 29}px ${FONT}`; g.fillText(name, x + 44, y);
      if (sel) { g.fillStyle = '#7fe3ff'; g.font = `600 24px ${FONT}`; g.fillText('선택한 정류장', x + 44, y + 38); }
    });
    if (st.pin > 0.01) {                                                   // 같은 버스의 위치
      const y = yAt(st.busT); g.globalAlpha = st.pin;
      g.fillStyle = 'rgba(70,207,255,0.22)'; g.beginPath(); g.arc(x, y, 40, 0, 7); g.fill();
      g.fillStyle = '#46cfff'; rrect(g, x - 26, y - 17, 52, 34, 9); g.fill(); g.fillStyle = '#03101f'; g.font = `700 22px ${FONT}`; g.textAlign = 'center'; g.fillText(ROUTE.no, x, y + 1);
      g.globalAlpha = 1;
    }
    if (st.card > 0.01) {                                                  // 아래 정보 영역
      g.globalAlpha = st.card; const cy = 850 + (1 - st.card) * 30;
      g.fillStyle = '#0b1a36'; rrect(g, 28, cy, Wc - 56, 270, 28); g.fill();
      g.textAlign = 'left'; g.fillStyle = '#8fb4e6'; g.font = `600 26px ${FONT}`; g.fillText(`${ROUTE.no}번 · ${ROUTE.dest}`, 60, cy + 52);
      g.fillStyle = '#ffffff'; g.font = `700 30px ${FONT}`; g.fillText(ROUTE.stops[ROUTE.here], 60, cy + 118); g.textAlign = 'right'; g.fillStyle = '#7fe3ff'; g.font = `700 44px ${FONT}`; g.fillText(st.here, Wc - 60, cy + 116);
      g.fillStyle = 'rgba(140,170,220,0.25)'; g.fillRect(60, cy + 160, Wc - 120, 2);
      g.textAlign = 'left'; g.fillStyle = '#c9d6ea'; g.font = `600 30px ${FONT}`; g.fillText(`다음 ${ROUTE.stops[ROUTE.here + 1]}`, 60, cy + 210); g.textAlign = 'right'; g.fillStyle = '#ffffff'; g.font = `700 40px ${FONT}`; g.fillText(st.next, Wc - 60, cy + 208);
      g.globalAlpha = 1;
    }
    pScr.t.needsUpdate = true;
  }

  let bitKey = '', phoneKey = '';
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), tmp = new THREE.Vector3();
  const curve = (p0, p1, lift, i0, n) => { for (let i = 0; i < n; i++) { const t = i / (n - 1); tmp.lerpVectors(p0, p1, t); tmp.y += Math.sin(Math.PI * t) * lift; flowPos.set([tmp.x, tmp.y, tmp.z], (i0 + i) * 3); } };
  return {
    phone, bitTop,
    get keys() { return [bitKey, phoneKey]; },   // 확인용: 두 화면의 현재 상태
    /** 화면 속 문구는 글꼴이 준비된 뒤 다시 그린다 */
    redraw() { bitKey = phoneKey = ''; },
    /** 스마트폰을 세계의 한 자리에 세워 둔다(카메라가 옮겨 가며 발견한다) */
    placePhone(pos, lookAt, scale) { phone.position.copy(pos); phone.lookAt(lookAt); phone.rotateZ(-0.05); phone.scale.setScalar(scale); phone.updateMatrixWorld(true); },
    /**
     * @param s { g(진행률), time, busX, busZ, dist, toBit(0~1 버스→안내기), toPhone(0~1 안내기→스마트폰), flowK(밝기), trailK, ringK }
     */
    update(s) {
      const status = s.g < 1.09 ? '4분 후' : s.g < 1.22 ? '2분 후' : s.g < 1.372 ? '곧 도착' : s.g < 1.9 ? '도착' : '12분 후';
      const key = `${status}|${s.g > 1.1 && s.g < 1.9 ? 1 : 0}`;
      if (key !== bitKey) { bitKey = key; drawBit({ status, on: s.g > 1.1 && s.g < 1.9 }); }
      phone.visible = s.g > 1.3 && s.g < 2.12;
      if (phone.visible) {
        const q = (v) => Math.round(v * 24) / 24, sm = (x0, x1) => Math.min(1, Math.max(0, (s.g - x0) / (x1 - x0)));
        const busT = ROUTE.here + Math.min(1, Math.max(0, (s.dist - STOP.dist) / 160));
        const st = { route: q(sm(1.54, 1.64)), pin: q(sm(1.64, 1.7)), card: q(sm(1.69, 1.76)), busT: Math.round(busT * 60) / 60, here: s.g < 1.865 ? '도착' : '출발', next: busT < 2.02 ? '3분 후' : busT < 2.3 ? '2분 후' : '1분 후' };
        const pk = JSON.stringify(st);
        if (pk !== phoneKey) { phoneKey = pk; drawPhone(st); }
      }
      /* 버스 → 안내기 → 스마트폰 */
      a.set(s.busX + 1.5, 3.25, s.busZ); b.copy(bitTop); c.set(0, 0.03, 0.002).applyMatrix4(phone.matrixWorld);
      curve(a, b, 1.1, 0, 36); curve(b, c, 0.25, 35, 35);
      const n = Math.round(36 * s.toBit + 34 * s.toPhone);
      flowGeo.setDrawRange(0, Math.max(0, n)); flowGeo.attributes.position.needsUpdate = true; flow.material.opacity = 0.85 * s.flowK;
      for (let k = 0; k < 3; k++) { const i = Math.floor((((s.time * 0.45 + k / 3) % 1) * Math.max(1, n - 1))); sparkGeo.attributes.position.setXYZ(k, flowPos[i * 3], flowPos[i * 3 + 1], flowPos[i * 3 + 2]); }
      sparkGeo.attributes.position.needsUpdate = true; spark.material.opacity = n > 2 ? s.flowK : 0;
      const rk = (s.time * 0.5) % 1; stopRing.scale.setScalar(2 + rk * 7); stopRing.material.opacity = s.ringK * (1 - rk) * 0.8;
      trailU.uX.value = s.busX; trailU.uK.value = s.trailK; trailU.uT.value = s.time;
    },
  };
}
