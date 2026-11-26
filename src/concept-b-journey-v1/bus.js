/**
 * 주인공 버스 — 코드로 만든 임시 모델(카메라·동작 검증용).
 * 저상 시내버스의 실제 비례(길이 11m · 폭 2.5m · 높이 3.3m)를 따른다. 단위 1 = 1m.
 * 좌표: 앞 +x, 위 +y, 오른쪽(문이 있는 쪽) +z.
 * 최종 GLB 로 바꿀 때는 이 함수가 돌려주는 { group, wheels, radius } 형태만 맞추면 된다.
 */
export const BUS = { length: 11, width: 2.5, wheelRadius: 0.48, axles: [2.85, -2.75] };

export function buildBus(THREE, shared) {
  const group = new THREE.Group();
  const W = BUS.width, R = BUS.wheelRadius;
  const hw = W / 2;

  /* 재질: 금속 차체 · 어두운 유리 · 무광 고무 · 휠 */
  const inject = (mat) => {
    // 차체를 훑는 얇은 빛과, 커서 가까이에서만 번지는 얇은 고리
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uSweep = shared.sweep; sh.uniforms.uCur = shared.cur; sh.uniforms.uCurAmt = shared.curAmt;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;\nuniform vec3 uSweep;\nuniform vec3 uCur;\nuniform float uCurAmt;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float sw = exp(-pow((vWp.x - uSweep.x) / 0.11, 2.0)) * uSweep.y;
          float dc = distance(vWp, uCur);
          float ring = smoothstep(0.05, 0.0, abs(fract(dc * 2.6 - uSweep.z * 0.35) - 0.5) - 0.455);
          float loc = smoothstep(1.7, 0.0, dc) * uCurAmt;
          totalEmissiveRadiance += vec3(0.22, 0.72, 1.0) * (sw * 1.5 + loc * (0.07 + ring * 0.6));`);
    };
    return mat;
  };
  const M = {
    body: inject(new THREE.MeshPhysicalMaterial({ color: 0x0b1a3a, metalness: 0.82, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.35 })),
    trim: inject(new THREE.MeshStandardMaterial({ color: 0x05070c, metalness: 0.4, roughness: 0.62, envMapIntensity: 0.6 })),
    glass: inject(new THREE.MeshPhysicalMaterial({ color: 0x010204, metalness: 0.0, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.55, reflectivity: 0.6 })),
    tire: new THREE.MeshStandardMaterial({ color: 0x07080b, metalness: 0.0, roughness: 0.94, envMapIntensity: 0.25, side: THREE.DoubleSide }),
    rim: new THREE.MeshStandardMaterial({ color: 0x2a3140, metalness: 0.95, roughness: 0.3, envMapIntensity: 1.2 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x020305, metalness: 0.1, roughness: 0.9, envMapIntensity: 0.1 }),
    cyan: new THREE.MeshBasicMaterial({ color: 0x2aa9e6 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xdff4ff }),
    tail: new THREE.MeshBasicMaterial({ color: 0x3a0508 }),
  };
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const rrect = (w, h, r) => { const s = new THREE.Shape(); const x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };

  /* 차체: 옆모습 윤곽(바퀴집 포함)을 폭 방향으로 밀어내고 모서리를 둥글린다 */
  const prof = new THREE.Shape();
  const yB = 0.34, yT = 3.04, aR = 0.63;
  prof.moveTo(-5.34, yB);
  for (const ax of [BUS.axles[1], BUS.axles[0]]) {
    const dx = Math.sqrt(aR * aR - (yB - R) ** 2), a = Math.atan2(yB - R, dx);
    prof.lineTo(ax - dx, yB);
    prof.absarc(ax, R, aR, Math.PI - a, a, true);
  }
  prof.lineTo(5.3, yB);
  prof.quadraticCurveTo(5.5, yB, 5.5, 0.56);
  prof.lineTo(5.5, 1.22);
  prof.lineTo(5.3, 2.78);
  prof.quadraticCurveTo(5.26, yT, 5.0, yT);
  prof.lineTo(-5.26, yT);
  prof.quadraticCurveTo(-5.5, yT, -5.5, 2.8);
  prof.lineTo(-5.5, 0.56);
  prof.quadraticCurveTo(-5.5, yB, -5.34, yB);
  const bev = 0.09;
  const bodyGeo = new THREE.ExtrudeGeometry(prof, { depth: W - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 24 });
  bodyGeo.translate(0, 0, -(W - bev * 2) / 2);
  add(bodyGeo, M.body);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo, 32), new THREE.LineBasicMaterial({ color: 0x3fbaff, transparent: true, opacity: 0.22 }));
  group.add(edges);

  /* 바퀴집 안쪽과 하부 */
  for (const ax of BUS.axles) add(box(1.3, 1.0, W - 0.5), M.dark, ax, 0.66, 0);
  add(box(10.2, 0.26, W - 0.3), M.dark, 0, 0.42, 0);

  for (const s of [1, -1]) {
    const z = s * (hw + 0.004), flip = s === 1 ? 0 : Math.PI;
    const side = (shape, mat, x, y, dz = 0) => { const m = add(new THREE.ShapeGeometry(shape, 8), mat, x, y, z + s * dz); m.rotation.y = flip; return m; };
    /* 옆 유리 띠 */
    side(rrect(9.5, 1.2, 0.1), M.glass, -0.3, 2.02);
    for (const x of [-3.9, -2.4, -0.95, 0.55, 2.0, 3.45]) add(box(0.05, 1.2, 0.012), M.trim, x, 2.02, z);
    /* 아랫단과 허리의 시안색 선(주인공 버스의 표식) */
    add(box(10.5, 0.012, 0.012), M.cyan, -0.1, 1.3, z);
    if (s === 1) {
      /* 오른쪽: 앞문과 중간문 */
      for (const [x0, x1] of [[3.72, 4.92], [-0.75, 0.55]]) {
        side(rrect(x1 - x0, 2.2, 0.06), M.glass, (x0 + x1) / 2, 1.56, 0.002);
        add(box(0.03, 2.2, 0.016), M.trim, (x0 + x1) / 2, 1.56, z);
        for (const x of [x0, x1]) add(box(0.045, 2.24, 0.016), M.trim, x, 1.56, z);
        add(box(x1 - x0, 0.045, 0.016), M.trim, (x0 + x1) / 2, 0.47, z);
      }
    } else {
      side(rrect(0.9, 1.3, 0.06), M.glass, 4.5, 1.95, 0.002);   // 운전석 옆 창
    }
    /* 사이드미러: 지붕 앞 모서리에서 내려오는 팔과 거울 몸체 */
    const arm = add(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 8), M.trim, 5.26, 2.76, s * (hw + 0.16));
    arm.rotation.set(s * 1.05, 0, 0.5);
    const mir = new THREE.Mesh(new THREE.ExtrudeGeometry(rrect(0.2, 0.44, 0.07), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }), M.trim);
    mir.position.set(5.36, 2.36, s * (hw + 0.34)); mir.rotation.y = Math.PI / 2 + s * 0.25; group.add(mir);
    const mg = add(new THREE.PlaneGeometry(0.16, 0.38), M.glass, 5.3, 2.36, s * (hw + 0.335)); mg.rotation.y = -Math.PI / 2 + s * 0.25;
  }

  /* 앞면: 기울어진 앞유리, 행선지 표시, 전조등, 범퍼 */
  const tilt = Math.atan2(0.2, 1.56);
  const front = new THREE.Group(); front.position.set(5.5 + bev, 1.22, 0); front.rotation.z = tilt; group.add(front);
  const fpanel = (shape, mat, y, dx = 0.012) => { const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8), mat); m.rotation.y = Math.PI / 2; m.position.set(dx, y, 0); front.add(m); return m; };
  fpanel(rrect(2.24, 1.28, 0.12), M.glass, 0.72);
  const sign = document.createElement('canvas'); sign.width = 512; sign.height = 64;
  const sg = sign.getContext('2d'); sg.fillStyle = '#01030a'; sg.fillRect(0, 0, 512, 64); sg.fillStyle = '#bfeaff'; sg.font = '700 40px Arial, sans-serif'; sg.textBaseline = 'middle'; sg.fillText('01', 26, 34); sg.textAlign = 'right'; sg.fillText('LIVEBUS', 488, 34);
  const signTex = new THREE.CanvasTexture(sign); signTex.encoding = THREE.sRGBEncoding;
  fpanel(rrect(1.9, 0.22, 0.03), new THREE.MeshBasicMaterial({ map: signTex }), 1.5, 0.016);
  add(box(0.02, 0.012, 2.1), M.cyan, 5.512 + bev, 1.12, 0);                                   // 앞면의 얇은 시안색 선
  for (const s of [1, -1]) {
    const lens = add(new THREE.ExtrudeGeometry(rrect(0.56, 0.2, 0.09), { depth: 0.03, bevelEnabled: false }), M.glass, 5.475 + bev, 0.82, s * 0.86); lens.rotation.y = Math.PI / 2;
    add(box(0.02, 0.028, 0.46), M.lamp, 5.515 + bev, 0.88, s * 0.86);
    for (const o of [-0.12, 0.1]) { const l = add(new THREE.CircleGeometry(0.05, 20), M.lamp, 5.512 + bev, 0.79, s * 0.86 + o); l.rotation.y = Math.PI / 2; }
    add(box(0.02, 0.5, 0.03), M.trim, 5.43 + bev, 1.75, s * 0.4).rotation.z = tilt;       // 와이퍼
  }
  add(box(0.1, 0.24, W - 0.1), M.trim, 5.5 + bev, 0.44, 0);
  /* 뒷면 */
  const rw = add(new THREE.ShapeGeometry(rrect(2.0, 0.8, 0.1), 8), M.glass, -5.505 - bev, 2.3, 0); rw.rotation.y = -Math.PI / 2;
  for (const s of [1, -1]) add(box(0.02, 0.62, 0.1), M.tail, -5.505 - bev, 1.25, s * 1.02);
  add(box(0.1, 0.24, W - 0.1), M.trim, -5.5 - bev, 0.44, 0);
  /* 지붕 설비 */
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(rrect(4.9, 1.9, 0.22), { depth: 0.2, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 }), M.trim);
  roof.rotation.x = -Math.PI / 2; roof.position.set(-1.2, 3.03 + bev, 0); group.add(roof);
  const fair = new THREE.Mesh(new THREE.ExtrudeGeometry(rrect(1.5, 1.5, 0.2), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 }), M.body);
  fair.rotation.x = -Math.PI / 2; fair.position.set(3.4, 3.03 + bev, 0); group.add(fair);

  /* 바퀴: 차체와 따로 도는 네 개 */
  const tireProfile = [];
  for (let i = 0; i <= 14; i++) { const a = -Math.PI / 2 + (i / 14) * Math.PI; tireProfile.push(new THREE.Vector2(R - 0.075 + Math.cos(a) * 0.075, Math.sin(a) * 0.15)); }
  const tireGeo = new THREE.LatheGeometry([new THREE.Vector2(0.3, -0.15), ...tireProfile, new THREE.Vector2(0.3, 0.15)], 40);
  tireGeo.rotateX(Math.PI / 2);
  const wheels = [];
  for (const ax of BUS.axles) for (const s of [1, -1]) {
    const w = new THREE.Group(); w.position.set(ax, R, s * (hw - 0.17)); group.add(w);
    w.add(new THREE.Mesh(tireGeo, M.tire));
    const face = s * 0.1;
    const disc = add(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 36), M.rim, 0, 0, face, w); disc.rotation.x = Math.PI / 2;
    const lip = add(new THREE.TorusGeometry(0.295, 0.016, 8, 40), M.rim, 0, 0, face + s * 0.03, w);
    const hub = add(new THREE.CylinderGeometry(0.085, 0.1, 0.09, 20), M.rim, 0, 0, face + s * 0.05, w); hub.rotation.x = Math.PI / 2;
    for (let k = 0; k < 10; k++) { const an = (k / 10) * Math.PI * 2; const b = add(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 8), M.dark, Math.cos(an) * 0.145, Math.sin(an) * 0.145, face + s * 0.035, w); b.rotation.x = Math.PI / 2; }
    for (let k = 0; k < 5; k++) { const an = (k / 5) * Math.PI * 2 + 0.3; const h = add(new THREE.CylinderGeometry(0.042, 0.042, 0.012, 16), M.dark, Math.cos(an) * 0.225, Math.sin(an) * 0.225, face + s * 0.027, w); h.rotation.x = Math.PI / 2; }
    wheels.push(w);
  }
  return { group, wheels, materials: M, edges };
}
