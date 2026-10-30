import { WALK_SPEED } from '../world/layout';
import { clampToFloor, step, type Vec2 } from './movement';

// 내 캐릭터 위치는 화면이 먼저 움직이고(바로 반응), 서버가 보정(correct)하면 따른다
export class LocalPlayer {
  pos: Vec2;
  dir: Vec2 = { x: 0, z: 0 };
  autoTarget: Vec2 | null = null; // 줄 자리처럼 입력 없이 걸어갈 곳

  constructor(pos: Vec2) {
    this.pos = { ...pos };
  }

  tick(dt: number): void {
    this.pos = step(this.pos, this.dir, dt);
  }

  // 손 입력이 있으면 그대로, 없으면 autoTarget 쪽으로 걷되 그 자리에서 멈춘다(넘어가지 않음)
  drive(input: Vec2, dt: number): void {
    if (Math.hypot(input.x, input.z) > 0 || !this.autoTarget) {
      this.dir = input;
      this.tick(dt);
      return;
    }
    const dx = this.autoTarget.x - this.pos.x, dz = this.autoTarget.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.02) { this.dir = { x: 0, z: 0 }; return; }
    const reach = Math.min(d, WALK_SPEED * dt);
    this.dir = { x: dx / d, z: dz / d };
    this.pos = clampToFloor({ x: this.pos.x + this.dir.x * reach, z: this.pos.z + this.dir.z * reach });
  }

  correct(p: Vec2): void {
    this.pos = { ...p };
  }
}
