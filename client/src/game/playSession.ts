import { MACHINE_SPEC } from '../data/storeLayout';
import type { Vec2 } from './movement';

const RESULT_WAIT = 8; // 내린 뒤 결과를 이만큼 못 받으면 포기(기계 화면에 갇히지 않게)

export type PlayPhase = 'one' | 'moving-one' | 'two' | 'moving-two' | 'done';

// 기계 한 판(내 화면) — 일본식 버튼 두 개 (설계 2026-10-31 §3.10):
// 집게는 상품 구멍 위(앞 왼쪽)에서 시작 → ①을 누르는 동안 오른쪽(+x), 떼면 멈추고 다시 못 누름 →
// ②를 누르는 동안 안쪽(-z), 떼면 바로 내린다. 시간이 다 되면 그 자리에서 내린다.
// 남은 시간은 실제 시계로 잰다 — 프레임 시간을 쌓으면 느린 휴대폰에서 서버 마감을 넘긴다
export class PlaySession {
  claw: Vec2 = { x: MACHINE_SPEC.hole[0], z: MACHINE_SPEC.hole[1] }; // 기계 안 좌표 — 기계 앞에서 보면 +x 오른쪽, -z 안쪽
  remaining: number;
  phase: PlayPhase = 'one';
  private droppedAt: number | null = null;

  constructor(readonly machineId: string, private limit: number, private startedAt: number) {
    this.remaining = limit;
  }

  press(button: 1 | 2): void {
    if (button === 1 && this.phase === 'one') this.phase = 'moving-one';
    if (button === 2 && this.phase === 'two') this.phase = 'moving-two';
  }

  // ②를 떼면 내린다 → 'drop'
  release(button: 1 | 2, now: number): 'drop' | null {
    if (button === 1 && this.phase === 'moving-one') this.phase = 'two';
    if (button === 2 && this.phase === 'moving-two') return this.requestDrop(now);
    return null;
  }

  update(dt: number, now: number): 'drop' | null {
    if (this.droppedAt !== null) return null;
    const [w, d] = MACHINE_SPEC.play_half, v = MACHINE_SPEC.claw_speed * dt;
    if (this.phase === 'moving-one') this.claw = { x: Math.min(this.claw.x + v, w), z: this.claw.z };
    if (this.phase === 'moving-two') this.claw = { x: this.claw.x, z: Math.max(this.claw.z - v, -d) };
    this.remaining = this.limit - (now - this.startedAt);
    return this.remaining <= 0 ? this.requestDrop(now) : null;
  }

  requestDrop(now: number): 'drop' | null {
    if (this.droppedAt !== null) return null;
    this.droppedAt = now;
    this.phase = 'done';
    return 'drop';
  }

  resultOverdue(now: number): boolean {
    return this.droppedAt !== null && now - this.droppedAt > RESULT_WAIT;
  }
}
