/**
 * 커서가 표면에 주는 힘을 담는 '변형 장'.
 *
 * 화면을 성긴 격자로 나누고 칸마다 변위(얼마나 밀렸는지)와 속도를 가진다.
 * 칸은 용수철처럼 목표 변위로 끌려가고 이웃과도 묶여 있어서
 *  - 커서 주변만 휘고(국소), 형태가 찢어지지 않으며(이웃 결합),
 *  - 커서가 떠나면 관성으로 조금 넘쳤다가 천천히 가라앉는다(감쇠가 약한 용수철).
 * 입자는 자기 화면 위치에서 이 장을 읽어 움직이므로 프레임마다 임의로 떨리지 않는다.
 *
 * 좌표: 화면 세로 절반을 1 로 둔 단위(x 는 -aspect ~ aspect, y 는 -1 ~ 1, 위가 +).
 */
export class Field {
  constructor(gw = 96, gh = 54) {
    this.gw = gw; this.gh = gh;
    const n = gw * gh;
    this.dx = new Float32Array(n); this.dy = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.data = new Float32Array(n * 4); // 텍스처로 올리는 값(R,G = 변위)
    this.aspect = 16 / 9;
  }

  /**
   * @param {number} dt 초
   * @param {{x:number,y:number,vx:number,vy:number,presence:number,charge:number}} c
   *        presence 0~1 커서가 화면 위에 있는 정도, charge 0~1 누르고 있는 세기
   */
  step(dt, c) {
    const { gw, gh, dx, dy, vx, vy, aspect } = this;
    const K = 58, C = 6.2, S = 5.5;          // 용수철, 감쇠, 이웃 결합
    const R = 0.36, RG = 0.5;               // 밀어내는 범위, 끌어모으는 범위
    const speed = Math.min(1, Math.hypot(c.vx, c.vy) / 5);
    const push = (0.105 + 0.2 * speed) * c.presence * (1 - c.charge);
    const drag = 0.045 * c.presence;
    const pull = 0.26 * c.charge;
    const dvx = Math.max(-4, Math.min(4, c.vx)) * drag, dvy = Math.max(-4, Math.min(4, c.vy)) * drag;
    const steps = Math.max(1, Math.min(4, Math.round(dt / (1 / 120))));
    const h = dt / steps;

    for (let s = 0; s < steps; s++) {
      for (let j = 0; j < gh; j++) {
        const py = ((j + 0.5) / gh) * 2 - 1;
        const jm = (j > 0 ? j - 1 : j) * gw, jp = (j < gh - 1 ? j + 1 : j) * gw, row = j * gw;
        for (let i = 0; i < gw; i++) {
          const px = (((i + 0.5) / gw) * 2 - 1) * aspect;
          const k = row + i;
          const ox = px - c.x, oy = py - c.y, r2 = ox * ox + oy * oy;
          let tx = 0, ty = 0;
          if (r2 < 4) {
            const g = Math.exp(-r2 / (R * R));
            // 가운데는 0, 조금 떨어진 곳이 가장 크게 밀린다 → 커서 둘레가 열리며 안쪽이 드러난다
            tx = (ox / R) * g * push + dvx * g;
            ty = (oy / R) * g * push + dvy * g;
            if (pull > 0) { const gg = Math.exp(-r2 / (RG * RG)); tx -= (ox / RG) * gg * pull; ty -= (oy / RG) * gg * pull; }
          }
          const im = i > 0 ? i - 1 : i, ip = i < gw - 1 ? i + 1 : i;
          const lx = dx[row + im] + dx[row + ip] + dx[jm + i] + dx[jp + i] - 4 * dx[k];
          const ly = dy[row + im] + dy[row + ip] + dy[jm + i] + dy[jp + i] - 4 * dy[k];
          vx[k] += (K * (tx - dx[k]) - C * vx[k] + S * lx) * h;
          vy[k] += (K * (ty - dy[k]) - C * vy[k] + S * ly) * h;
        }
      }
      for (let k = 0, n = gw * gh; k < n; k++) { dx[k] += vx[k] * h; dy[k] += vy[k] * h; }
    }
    const data = this.data;
    for (let k = 0, n = gw * gh; k < n; k++) { data[k * 4] = dx[k]; data[k * 4 + 1] = dy[k]; }
  }

  /** 누른 것을 놓을 때: 모였던 표면이 바깥으로 한 번 튕겨 나가게 한다 */
  kick(x, y, amount) {
    const { gw, gh, vx, vy, aspect } = this;
    const R = 0.5;
    for (let j = 0; j < gh; j++) {
      const py = ((j + 0.5) / gh) * 2 - 1;
      for (let i = 0; i < gw; i++) {
        const px = (((i + 0.5) / gw) * 2 - 1) * aspect;
        const ox = px - x, oy = py - y, r2 = ox * ox + oy * oy;
        if (r2 > 2.5) continue;
        const g = Math.exp(-r2 / (R * R)) * amount;
        vx[j * gw + i] += (ox / R) * g; vy[j * gw + i] += (oy / R) * g;
      }
    }
  }
}
