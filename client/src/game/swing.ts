// 줄에 매달린 집게의 흔들림(진자): 매달린 곳이 가속하면 반대로 기울고, 놓으면 출렁이다 잦아든다.
// tiltX = x 방향으로 아래가 밀려난 각도, tiltZ = z 방향 (라디안)
const K = 22, C = 2.0, G = 1.2, MAX = 0.35; // 덜 딱딱하게, 조금 더 오래 출렁 (설계 2026-10-31 §3.6)
const clamp = (v: number) => Math.min(Math.max(v, -MAX), MAX);

export class Swing {
  tiltX = 0;
  tiltZ = 0;
  private vx = 0;
  private vz = 0;

  update(dt: number, ax: number, az: number): void {
    this.vx += (-K * this.tiltX - C * this.vx - G * ax) * dt;
    this.vz += (-K * this.tiltZ - C * this.vz - G * az) * dt;
    this.tiltX = clamp(this.tiltX + this.vx * dt);
    this.tiltZ = clamp(this.tiltZ + this.vz * dt);
  }

  // 모터가 덜컥 움직이기 시작할 때처럼 한 번 툭
  kick(vx: number, vz: number): void {
    this.vx += vx; this.vz += vz;
  }

  reset(): void {
    this.tiltX = this.tiltZ = this.vx = this.vz = 0;
  }
}
