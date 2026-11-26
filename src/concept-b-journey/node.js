/**
 * 정보 노드(6차): 주인공 버스의 '위치·운행 정보'를 나타내는 시각적 표식.
 *
 * 차량에 달린 장치가 아니라, 이 버스의 정보가 어디에 있는지를 가리키는 표식이다.
 * BMS 에서 버스 지붕 위에 나타나 정류장까지 버스와 함께 가고, BIT 와 BIS 에서는 이 노드에서 빛이 출발한다(노드는 버스 위에 남는다).
 *
 * 구성: 지붕의 실제 위치(안테나 끝)에서 올라가는 가는 링크 선 → 작은 3D 노드(팔면체) → 절제된 주변 빛.
 * 위치 갱신 표현: 지붕의 작은 신호 → 선을 따라 올라가는 빛 → 노드의 부드러운 반응. (노선이 잠깐 밝아지는 부분은 world.js 의 선택 노선이 맡는다)
 * 깊이 판정을 하므로 스마트폰이나 안내기 뒤로 가면 가려진다.
 */
import { fatLines, dots } from './lines.js';

const NSTEM = 14;
const gauss = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));

export function buildNode(THREE, scene) {
  /* 작은 3D 노드: 위아래로 조금 긴 팔면체. 면마다 밝기가 달라 입체로 읽힌다 */
  const U = { uK: { value: 0 }, uGain: { value: 1 } };
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), new THREE.ShaderMaterial({
    uniforms: U, transparent: true,
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; uniform float uK, uGain;
      void main() { vec3 n = normalize(vN); float up = n.y * 0.5 + 0.5, lit = max(dot(n, normalize(vec3(0.35, 0.8, 0.5))), 0.0), rim = pow(1.0 - abs(dot(n, vV)), 2.0);
        vec3 col = mix(vec3(0.03, 0.3, 0.72), vec3(0.27, 0.81, 1.0), up) * (0.72 + 0.4 * lit) + vec3(0.6, 0.92, 1.0) * rim * 0.4;
        gl_FragColor = vec4(min(col * uGain, vec3(1.0)), uK); }`,
  }));
  mesh.frustumCulled = false; mesh.renderOrder = 8; mesh.visible = false; scene.add(mesh);
  /* 링크 선: vE.x = 밝기, vE.y = 올라가는 빛 */
  const stem = fatLines(THREE, NSTEM, { px: [0.9, 1.9], cap: 0, order: 7,
    frag: 'vec4 shade() { return vec4((vec3(0.1, 0.52, 0.95) * vE.x + vec3(0.5, 0.9, 1.0) * vE.y) * lineA(), 1.0); }' });
  stem.mesh.visible = false; scene.add(stem.mesh);
  const glow = dots(THREE, 2, { px: [8, 96], order: 7 }); glow.mesh.visible = false; scene.add(glow.mesh);   // 0: 노드 둘레의 빛, 1: 지붕의 작은 신호
  const a = [0, 0, 0], b = [0, 0, 0];

  return {
    mesh,
    /**
     * @param s { node(노드 중심, 세계 좌표), base(지붕의 신호점), k(보이는 정도 0~1), rad(반지름 m), hot(선택 강조 0~1), emph(전달 직전의 강조 0~1),
     *            roof(지붕 신호 0~1), blip(선 위의 빛 위치 0~1, 없으면 -1), react(노드의 반응 0~1), spin(회전각) }
     */
    update(s) {
      const on = s.k > 0.003;
      mesh.visible = stem.mesh.visible = glow.mesh.visible = on;
      if (!on) return;
      const up = Math.max(s.hot, s.emph), r = s.rad * (1 + 0.1 * s.hot + 0.08 * s.emph + 0.1 * s.react);
      mesh.position.copy(s.node); mesh.scale.set(r, r * 1.32, r); mesh.rotation.y = s.spin;
      U.uK.value = s.k; U.uGain.value = 1 + 0.22 * up + 0.3 * s.react;
      const top = s.node.y - r * 1.5, y0 = s.base.y, h = Math.max(0.01, top - y0);
      const val = (t) => [s.k * (0.3 + 0.4 * t) * (1 + 0.6 * up), s.blip < 0 ? 0 : s.k * 0.9 * gauss(t, s.blip, 0.11) * Math.sin(Math.PI * Math.min(1, Math.max(0, s.blip))) ** 0.5, 0, 0];
      for (let i = 0; i < NSTEM; i++) {
        const t0 = i / NSTEM, t1 = (i + 1) / NSTEM;
        a[0] = b[0] = s.base.x; a[2] = b[2] = s.base.z; a[1] = y0 + h * t0; b[1] = y0 + h * t1;
        stem.set(i, a, b, val(t0), val(t1), 0.05);
      }
      stem.done();
      glow.set(0, [s.node.x, s.node.y, s.node.z], r * 7, [0.2, 0.74, 1.0], s.k * (0.3 + 0.2 * up + 0.25 * s.react), 0.01, 0.9);
      glow.set(1, [s.base.x, s.base.y, s.base.z], r * 1.6, [0.4, 0.88, 1.0], s.k * s.roof * 0.9, 0.3, 0.7);
      glow.done();
    },
  };
}
