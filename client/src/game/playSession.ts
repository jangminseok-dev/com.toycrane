import { MACHINE_SPEC } from '../data/storeLayout';
import type { Vec2 } from './movement';

const RESULT_WAIT = 8; // 보고(done)를 보낸 뒤 결과를 이만큼 못 받으면 포기(기계 화면에 갇히지 않게)

// 기계 한 판(내 화면) — 레버(조이스틱) 1개 + 하강 버튼 1개 (설계 2026-10-31 §3.10, 3차 결정):
// 집게는 상품 구멍 위(앞 왼쪽)에서 시작해 레버가 미는 쪽으로 놀이 영역 안을 자유롭게 움직이고, 하강 버튼으로 한 번만 내린다(시간이 다 되면 저절로).
// 남은 시간은 실제 시계로 잰다 — 프레임 시간을 쌓으면 느린 휴대폰에서 서버 마감을 넘긴다.
// 내린 뒤(phase 'cycle')에는 물리 한 바퀴가 집게를 움직이고(physics/clawCycle), 끝나면 done 보고를 보내고 결과를 기다린다 (물리 뽑기 설계 §4.4)
export const CLAW_EDGE = 0.07; // 활짝 벌린 손가락 끝이 16cm까지 뻗으니 유리(놀이 영역 +12cm)를 뚫지 않게 벽에서 띄운다

export class PlaySession {
  claw: Vec2 = { x: MACHINE_SPEC.hole[0], z: MACHINE_SPEC.hole[1] }; // 기계 안 좌표 — 기계 앞에서 보면 +x 오른쪽, -z 안쪽
  remaining: number;
  phase: 'lever' | 'cycle' = 'lever';
  private droppedAt: number | null = null;
  private doneAt: number | null = null;

  constructor(readonly machineId: string, private limit: number, private startedAt: number) {
    this.remaining = limit;
  }

  update(dt: number, input: Vec2, now: number): 'drop' | null {
    if (this.droppedAt !== null) return null;
    const w = MACHINE_SPEC.play_half[0] - CLAW_EDGE, d = MACHINE_SPEC.play_half[1] - CLAW_EDGE, v = MACHINE_SPEC.claw_speed * dt;
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
    this.phase = 'cycle';
    return 'drop';
  }

  // 한 바퀴가 끝나 보고를 보냈다
  markDone(now: number): void {
    this.doneAt = now;
  }

  resultOverdue(now: number): boolean {
    return this.doneAt !== null && now - this.doneAt > RESULT_WAIT;
  }
}
