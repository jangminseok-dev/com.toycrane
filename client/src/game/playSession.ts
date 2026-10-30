import { MACHINE_SPEC } from '../data/storeLayout';
import type { Vec2 } from './movement';

// 기계 한 판(내 화면): 조이스틱·키로 집게를 놀이 영역 안에서 움직이고, 내리기는 한 번만(시간이 다 되면 저절로)
export class PlaySession {
  claw: Vec2 = { x: 0, z: 0 }; // 기계 안 좌표 — 화면 위·오른쪽이 기계 안 -z·+x (카메라가 기계 앞에서 봄)
  remaining: number;
  private dropped = false;

  constructor(readonly machineId: string, limit: number) {
    this.remaining = limit;
  }

  update(dt: number, input: Vec2): 'drop' | null {
    if (this.dropped) return null;
    const [w, d] = MACHINE_SPEC.play_half, v = MACHINE_SPEC.claw_speed * dt;
    this.claw = {
      x: Math.min(Math.max(this.claw.x + input.x * v, -w), w),
      z: Math.min(Math.max(this.claw.z + input.z * v, -d), d),
    };
    this.remaining -= dt;
    return this.remaining <= 0 ? this.requestDrop() : null;
  }

  requestDrop(): 'drop' | null {
    if (this.dropped) return null;
    this.dropped = true;
    return 'drop';
  }
}
