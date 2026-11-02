import { FIGURE } from '../data/figures';
import type { Vec2 } from './movement';

const RESULT_WAIT = 8; // 보고(done)를 보낸 뒤 결과를 이만큼 못 받으면 포기(기계 화면에 갇히지 않게) — 인형 판과 같음

export type FigurePhase = 'one' | 'moving-one' | 'two' | 'moving-two' | 'cycle';

// 피규어 한 판(내 화면, 9단계 설계 §3.3) — 진짜 가게처럼 버튼 두 개:
// 집게는 앞 왼쪽(halfX 왼쪽 끝, 앞뒤는 claw.home)에서 시작 → ①을 누르는 동안 오른쪽(+x), 떼면 멈추고 다시 못 누름 →
// ②를 누르는 동안 안쪽(−z), 떼면 바로 내린다. 시간이 다 되면 그 자리에서 내린다(예전 버튼판 fde3f11과 같은 규칙).
// 남은 시간은 실제 시계로 잰다 — 프레임 시간을 쌓으면 느린 휴대폰에서 서버 마감을 넘긴다
export class FigureSession {
  claw: Vec2; // 기계 안 좌표 — 앞에서 보면 +x 오른쪽, −z 안쪽
  phase: FigurePhase = 'one';
  private droppedAt: number | null = null;
  private doneAt: number | null = null;

  // halfX: 그 집게가 갈 수 있는 반폭(벌린 팔이 기계 안에 머무는 데까지, figureClaw clawHalfX) — 쉬는 자리는 그 왼쪽 끝
  constructor(readonly machineId: string, private limit: number, private startedAt: number, readonly halfX = FIGURE.play_half[0]) {
    this.claw = { x: -halfX, z: FIGURE.claw.home[1] };
  }

  // 지금 누를 수 있는 버튼이면 누른다(받아들였나)
  press(button: 1 | 2): boolean {
    if (button === 1 && this.phase === 'one') { this.phase = 'moving-one'; return true; }
    if (button === 2 && this.phase === 'two') { this.phase = 'moving-two'; return true; }
    return false;
  }

  // ①을 떼면 ②로, ②를 떼면 내린다 → 'drop'
  release(button: 1 | 2, now: number): 'drop' | null {
    if (button === 1 && this.phase === 'moving-one') this.phase = 'two';
    if (button === 2 && this.phase === 'moving-two') return this.requestDrop(now);
    return null;
  }

  update(dt: number, now: number): 'drop' | null {
    if (this.droppedAt !== null) return null;
    const d = FIGURE.play_half[1], v = FIGURE.claw.speed * dt;
    if (this.phase === 'moving-one') this.claw = { x: Math.min(this.claw.x + v, this.halfX), z: this.claw.z };
    if (this.phase === 'moving-two') this.claw = { x: this.claw.x, z: Math.max(this.claw.z - v, -d) };
    return this.remaining(now) <= 0 ? this.requestDrop(now) : null;
  }

  remaining(now: number): number {
    return this.limit - (now - this.startedAt);
  }

  requestDrop(now: number): 'drop' | null {
    if (this.droppedAt !== null) return null;
    this.droppedAt = now;
    this.phase = 'cycle';
    return 'drop';
  }

  markDone(now: number): void {
    this.doneAt = now;
  }

  resultOverdue(now: number): boolean {
    return this.doneAt !== null && now - this.doneAt > RESULT_WAIT;
  }
}
