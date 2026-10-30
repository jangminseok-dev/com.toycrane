import { MACHINE_SPEC } from '../data/storeLayout';
import type { Vec2 } from './movement';

const RESULT_WAIT = 8; // 내린 뒤 결과를 이만큼 못 받으면 포기(기계 화면에 갇히지 않게)

// 기계 한 판(내 화면): 조이스틱·키로 집게를 놀이 영역 안에서 움직이고, 내리기는 한 번만(시간이 다 되면 저절로).
// 남은 시간은 실제 시계로 잰다 — 프레임 시간을 쌓으면 느린 휴대폰에서 서버 마감을 넘긴다
export class PlaySession {
  claw: Vec2 = { x: 0, z: 0 }; // 기계 안 좌표 — 화면 위·오른쪽이 기계 안 -z·+x (카메라가 기계 앞에서 봄)
  remaining: number;
  private droppedAt: number | null = null;

  constructor(readonly machineId: string, private limit: number, private startedAt: number) {
    this.remaining = limit;
  }

  update(dt: number, input: Vec2, now: number): 'drop' | null {
    if (this.droppedAt !== null) return null;
    const [w, d] = MACHINE_SPEC.play_half, v = MACHINE_SPEC.claw_speed * dt;
    this.claw = {
      x: Math.min(Math.max(this.claw.x + input.x * v, -w), w),
      z: Math.min(Math.max(this.claw.z + input.z * v, -d), d),
    };
    this.remaining = this.limit - (now - this.startedAt);
    return this.remaining <= 0 ? this.requestDrop(now) : null;
  }

  requestDrop(now: number): 'drop' | null {
    if (this.droppedAt !== null) return null;
    this.droppedAt = now;
    return 'drop';
  }

  resultOverdue(now: number): boolean {
    return this.droppedAt !== null && now - this.droppedAt > RESULT_WAIT;
  }
}
