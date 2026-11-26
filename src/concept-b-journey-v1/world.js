/**
 * 버스가 달리는 공간: 반사용 조명 환경, 바닥과 도로, 도시, 운행 연결망, 다른 버스들.
 * 버스는 +x 방향으로 곧은 길을 달린다(z = 0). 도시는 x 60 ~ 470 구간에 있다.
 */
const rand = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** 차체에 비치는 조명 환경: 어두운 방에 길쭉한 조명판 몇 장 */
export function buildEnvironment(THREE, renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(60, 30, 60), new THREE.MeshBasicMaterial({ color: 0x010206, side: THREE.BackSide })));
  const panel = (w, h, color, pos, look) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(...look); s.add(m); };
  panel(26, 5, 0xcfe6ff, [0, 13, 2], [0, 0, 0]);          // 위의 큰 조명
  panel(18, 1.2, 0x39c3ff, [4, 3.2, 16], [0, 1.5, 0]);    // 옆의 가는 시안색 띠
  panel(22, 0.8, 0x2f6dff, [-6, 6, -18], [0, 1.5, 0]);    // 뒤쪽 청색 띠
  panel(5, 7, 0x9fc8ff, [24, 5, 6], [0, 1.5, 0]);         // 앞쪽 보조
  panel(40, 0.5, 0x163a80, [0, 0.8, 22], [0, 1, 0]);      // 낮게 깔린 선
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.03).texture;
  pm.dispose();
  return tex;
}

const radial = (THREE, stops, size = 256) => {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
};

export function buildWorld(THREE, scene, { mobile }) {
  const R = rand(7);
  const world = {};

  /* 조명 */
  scene.add(new THREE.HemisphereLight(0x86aef5, 0x04060b, 0.22));
  const key = new THREE.DirectionalLight(0xdcebff, 1.25); scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x35b8ff, 1.5); scene.add(rim, rim.target);
  const glow = new THREE.PointLight(0xbfd8ff, 0.7, 26, 1.6); scene.add(glow);   // 차체 옆면에 밝기의 흐름을 만드는 가까운 조명
  world.lights = { key, rim, glow };

  /* 버스 아래: 바닥에 떨어진 빛과 접지 그림자(버스를 따라다닌다) */
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(46, 30), new THREE.MeshBasicMaterial({ map: radial(THREE, [[0, 'rgba(60,104,170,0.2)'], [0.35, 'rgba(30,58,108,0.09)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.004; scene.add(pool);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(14.6, 5.4), new THREE.MeshBasicMaterial({ map: radial(THREE, [[0, 'rgba(0,0,0,0.96)'], [0.55, 'rgba(0,0,0,0.8)'], [0.8, 'rgba(0,0,0,0.3)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; scene.add(shadow);
  world.pool = pool; world.shadow = shadow;

  /* 도로: 어두운 노면, 가장자리 선, 끊어진 중앙선 */
  const X0 = -60, X1 = 520;
  const roadMat = new THREE.MeshBasicMaterial({ color: 0x010306, transparent: true, opacity: 0, depthWrite: false });   // 조명과 무관하게 어두운 노면
  const road = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, 9), roadMat);
  road.rotation.x = -Math.PI / 2; road.position.set((X0 + X1) / 2, 0.002, 0); scene.add(road);
  const lanePts = [];
  for (const z of [-4.3, 4.3]) lanePts.push(X0, 0.02, z, X1, 0.02, z);
  for (let x = X0; x < X1; x += 9) lanePts.push(x, 0.02, 0, x + 3.6, 0.02, 0);
  const laneGeo = new THREE.BufferGeometry(); laneGeo.setAttribute('position', new THREE.Float32BufferAttribute(lanePts, 3));
  const laneMat = new THREE.LineBasicMaterial({ color: 0x7fb4e8, transparent: true, opacity: 0 });
  const lanes3d = new THREE.LineSegments(laneGeo, laneMat); scene.add(lanes3d);
  world.road = { roadMat, laneMat };

  /* 도시: 더 어둡고 작은 덩어리 + 지붕의 가는 윤곽 */
  const city = new THREE.Group(); scene.add(city);
  const AVE = [-88, -44, 0, 44, 88], CROSS = [];
  for (let x = 80; x <= 460; x += 38) CROSS.push(x);
  const blocks = [];
  for (let i = 0; i < CROSS.length - 1; i++) for (let j = 0; j < AVE.length - 1; j++) {
    const x0 = CROSS[i] + 6, x1 = CROSS[i + 1] - 6, z0 = AVE[j] + 6.5, z1 = AVE[j + 1] - 6.5;
    const nx = 2, nz = 2;
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      if (R() < 0.12) continue;
      const zc = z0 + ((b + 0.5) * (z1 - z0)) / nz;
      const w = ((x1 - x0) / nx) * (0.62 + R() * 0.3), d = ((z1 - z0) / nz) * (0.62 + R() * 0.3), h = 4 + R() * R() * (Math.abs(zc) < 30 ? 9 : 26);   // 길가에는 낮은 건물
      blocks.push([x0 + ((a + 0.5) * (x1 - x0)) / nx, z0 + ((b + 0.5) * (z1 - z0)) / nz, w, d, h]);
    }
  }
  /* 건물은 조명을 받지 않는 어두운 덩어리: 윗면만 조금 밝게 칠해 형태를 구분한다 */
  const bGeo = new THREE.BoxGeometry(1, 1, 1), bCol = [];
  const faceCol = [[0.004, 0.007, 0.015], [0.003, 0.005, 0.011], [0.009, 0.017, 0.036], [0, 0, 0], [0.006, 0.01, 0.021], [0.002, 0.004, 0.009]];   // r128 은 색을 선형값으로 다룬다
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) bCol.push(...faceCol[f]);
  bGeo.setAttribute('color', new THREE.Float32BufferAttribute(bCol, 3));
  const bMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0 });
  const inst = new THREE.InstancedMesh(bGeo, bMat, blocks.length);
  const m4 = new THREE.Matrix4(), outline = [];
  blocks.forEach(([x, z, w, d, h], i) => {
    m4.makeScale(w, h, d).setPosition(x, h / 2, z); inst.setMatrixAt(i, m4);
    const a = [x - w / 2, z - d / 2], b = [x + w / 2, z - d / 2], c = [x + w / 2, z + d / 2], e = [x - w / 2, z + d / 2];
    for (const [p, q] of [[a, b], [b, c], [c, e], [e, a]]) outline.push(p[0], h + 0.02, p[1], q[0], h + 0.02, q[1]);
  });
  city.add(inst);
  const oGeo = new THREE.BufferGeometry(); oGeo.setAttribute('position', new THREE.Float32BufferAttribute(outline, 3));
  const oMat = new THREE.LineBasicMaterial({ color: 0x0c2a66, transparent: true, opacity: 0 });
  city.add(new THREE.LineSegments(oGeo, oMat));

  /* 운행 연결망: 길 위의 가는 선(형태는 고정) + 그 위를 흐르는 신호(따로 움직인다) */
  const segs = [];
  for (const z of AVE) for (let i = 0; i < CROSS.length - 1; i++) segs.push([CROSS[i], z, CROSS[i + 1], z]);
  for (const x of CROSS) for (let j = 0; j < AVE.length - 1; j++) segs.push([x, AVE[j], x, AVE[j + 1]]);
  const netPts = [];
  for (const [ax, az, bx, bz] of segs) netPts.push(ax, 0.06, az, bx, 0.06, bz);
  const nGeo = new THREE.BufferGeometry(); nGeo.setAttribute('position', new THREE.Float32BufferAttribute(netPts, 3));
  const nMat = new THREE.LineBasicMaterial({ color: 0x1546b0, transparent: true, opacity: 0 });
  city.add(new THREE.LineSegments(nGeo, nMat));
  const mainGeo = new THREE.BufferGeometry(); mainGeo.setAttribute('position', new THREE.Float32BufferAttribute([40, 0.07, 0, 500, 0.07, 0], 3));
  const mainMat = new THREE.LineBasicMaterial({ color: 0x46cfff, transparent: true, opacity: 0 });
  city.add(new THREE.LineSegments(mainGeo, mainMat));

  const count = mobile ? 90 : 220;
  const from = new Float32Array(count * 3), to = new Float32Array(count * 3), ph = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const [ax, az, bx, bz] = segs[Math.floor(R() * segs.length)], flip = R() < 0.5;
    from.set(flip ? [bx, 0.12, bz] : [ax, 0.12, az], i * 3); to.set(flip ? [ax, 0.12, az] : [bx, 0.12, bz], i * 3);
    ph.set([R(), 0.05 + R() * 0.09], i * 2);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(from, 3)); pGeo.setAttribute('aTo', new THREE.BufferAttribute(to, 3)); pGeo.setAttribute('aPh', new THREE.BufferAttribute(ph, 2));
  const pulseMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uA: { value: 0 }, uHero: { value: new THREE.Vector3() }, uWave: { value: 0 }, uPx: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aTo; attribute vec2 aPh; uniform float uT, uA, uWave, uPx; uniform vec3 uHero; varying float vI;
      void main() { float k = fract(aPh.x + uT * aPh.y); vec3 p = mix(position, aTo, k);
        float d = distance(p.xz, uHero.xz);
        float hit = exp(-pow((d - uWave) / 9.0, 2.0));                       // 주인공 버스의 신호가 지나가는 자리에서 반응
        vI = uA * (0.5 + 0.7 * sin(k * 3.14159)) * (0.8 + 1.8 * hit);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * (3.4 + 3.0 * hit) * clamp(95.0 / -mv.z, 0.75, 2.2); }`,
    fragmentShader: `varying float vI; void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; float a = smoothstep(1.0, 0.2, dot(q, q)); gl_FragColor = vec4(vec3(0.45, 0.82, 1.0) * a * vI, 1.0); }`,
  });
  const pulses = new THREE.Points(pGeo, pulseMat); pulses.frustumCulled = false; city.add(pulses);

  /* 다른 버스들: 어둡고 단순하게. 위치 표시만 옅게 */
  const lanes = [];
  for (const z of [-88, -44, 44, 88]) lanes.push({ ax: 80, az: z + 2.2, bx: 460, bz: z + 2.2 }, { ax: 460, az: z - 2.2, bx: 80, bz: z - 2.2 });
  for (const x of [156, 232, 308, 384]) lanes.push({ ax: x + 2.2, az: -88, bx: x + 2.2, bz: 88 });
  const others = lanes.slice(0, mobile ? 7 : 12).map((l, i) => ({ ...l, off: R(), speed: 0.55 + R() * 0.5, len: Math.hypot(l.bx - l.ax, l.bz - l.az) }));
  const oBus = new THREE.InstancedMesh(new THREE.BoxGeometry(10.5, 2.9, 2.45), new THREE.MeshBasicMaterial({ color: 0x050c1c, transparent: true, opacity: 0 }), others.length);
  city.add(oBus);
  const dotGeo = new THREE.BufferGeometry(); dotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(others.length * 3), 3));
  const dotMat = new THREE.PointsMaterial({ color: 0x2f6fe6, size: 4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  const dots = new THREE.Points(dotGeo, dotMat); dots.frustumCulled = false; city.add(dots);

  /* 주인공 버스의 위치 신호: 바닥에 퍼지는 가는 고리와 머리 위 표식 */
  const rings = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.994, 1, 128), new THREE.MeshBasicMaterial({ color: 0x5fd4ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = 0.09; scene.add(m); return m; });
  const beamMat = new THREE.LineBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0 });
  const beamGeo = new THREE.BufferGeometry(); beamGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 3.6, 0, 0, 13, 0], 3));
  const beam = new THREE.Line(beamGeo, beamMat); scene.add(beam);
  const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), new THREE.MeshBasicMaterial({ color: 0x6fdcff, transparent: true, opacity: 0 })); scene.add(tip);

  const q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
  /**
   * @param {object} s  { busX, dist(이동 거리), time, roadIn, cityIn, px }
   */
  world.update = (s) => {
    pool.position.x = shadow.position.x = s.busX;
    pool.material.opacity = 1 - 0.55 * s.cityIn;
    road.visible = lanes3d.visible = s.roadIn > 0.002; roadMat.opacity = s.roadIn; laneMat.opacity = 0.5 * s.roadIn;
    city.visible = s.cityIn > 0.002;
    bMat.opacity = s.cityIn; oMat.opacity = 0.5 * s.cityIn; nMat.opacity = 0.75 * s.cityIn; mainMat.opacity = 0.9 * s.cityIn;
    oBus.material.opacity = s.cityIn; dotMat.opacity = 0.9 * s.cityIn;
    /* 다른 버스는 주인공의 이동 거리에 맞춰 함께 움직인다(스크롤을 멈추면 같이 멈춘다) */
    others.forEach((o, i) => {
      const k = (((o.off + (s.dist * o.speed) / o.len) % 1) + 1) % 1;
      pos.set(o.ax + (o.bx - o.ax) * k, 1.6, o.az + (o.bz - o.az) * k);
      q.setFromAxisAngle(yAxis, Math.atan2(-(o.bz - o.az), o.bx - o.ax));
      m4.compose(pos, q, sc); oBus.setMatrixAt(i, m4);
      dotGeo.attributes.position.setXYZ(i, pos.x, 4.2, pos.z);
    });
    oBus.instanceMatrix.needsUpdate = true; dotGeo.attributes.position.needsUpdate = true;
    /* 신호 */
    const wave = (s.time * 38) % 190;
    pulseMat.uniforms.uT.value = s.time; pulseMat.uniforms.uA.value = s.cityIn; pulseMat.uniforms.uPx.value = s.px;
    pulseMat.uniforms.uHero.value.set(s.busX, 0, 0); pulseMat.uniforms.uWave.value = wave;
    const sig = Math.max(s.roadIn * 0.6, s.cityIn);
    rings.forEach((r, i) => {
      const k = (s.time * 0.42 + i / 3) % 1, rad = 3 + k * (10 + 44 * s.cityIn);
      r.position.x = s.busX; r.scale.setScalar(rad); r.material.opacity = sig * (1 - k) * (0.3 + 0.45 * s.cityIn);
    });
    beam.position.x = tip.position.x = s.busX; tip.position.y = 13.6; tip.rotation.y = s.time * 0.6;
    beamMat.opacity = 0.7 * s.cityIn; tip.material.opacity = s.cityIn; tip.scale.setScalar(0.6 + 1.4 * s.cityIn);
  };
  return world;
}
