import { CLAW } from '../data/claw';
import { MACHINE_SPEC } from '../data/storeLayout';
import type { Vec2 } from './movement';

const RESULT_WAIT = 8; // 보고(done)를 보낸 뒤 결과를 이만큼 못 받으면 포기(기계 화면에 갇히지 않게)

// 기계 한 판(내 화면) — 레버(조이스틱) 1개 + 하강 버튼 1개 (설계 2026-10-31 §3.10, 3차 결정):
// 집게는 상품 구멍 위(앞 왼쪽)에서 시작해 레버가 미는 쪽으로 놀이 영역 안을 자유롭게 움직이고, 하강 버튼으로 한 번만 내린다(시간이 다 되면 저절로).
// 남은 시간은 실제 시계로 잰다 — 프레임 시간을 쌓으면 느린 휴대폰에서 서버 마감을 넘긴다.
// 내린 뒤(phase 'cycle')에는 물리 한 바퀴가 집게를 움직이고(physics/clawCycle), 끝나면 done 보고를 보내고 결과를 기다린다 (물리 뽑기 설계 §4.4)
export const CLAW_EDGE = CLAW.reposition.edge; // 활짝 벌린 손가락 끝이 16cm까지 뻗으니 유리(놀이 영역 +12cm)를 뚫지 않게 벽에서 띄운다

export class PlaySession {
  claw: Vec2; // 기계 안 좌표 — 기계 앞에서 보면 +x 오른쪽, -z 안쪽
  remaining: number;
  phase: 'lever' | 'cycle' = 'lever';
  private droppedAt: number | null = null;
  private doneAt: number | null = null;

  private range: { x: [number, number]; z: [number, number] };

  // start: 집게가 서 있는 자리 — 인형 기계는 상품 구멍 위, 미는 뽑기는 턱 위 놓는 자리(설계 ring-hook §4).
  // range: 레버로 갈 수 있는 곳(기본 놀이 영역 전체) — 미는 뽑기는 칸만(턱 위는 놓을 때만, 사용자 2026-11-02). 시작 자리가 밖이면 안으로 저절로 미끄러진다
  constructor(readonly machineId: string, private limit: number, private startedAt: number, start: Vec2 = { x: MACHINE_SPEC.hole[0], z: MACHINE_SPEC.hole[1] },
    range?: { x: [number, number]; z: [number, number] }) {
    this.remaining = limit;
    this.claw = { ...start };
    const w = MACHINE_SPEC.play_half[0] - CLAW_EDGE, d = MACHINE_SPEC.play_half[1] - CLAW_EDGE;
    this.range = range ?? { x: [-w, w], z: [-d, d] };
  }

  private inside(): boolean {
    const { x, z } = this.range;
    return this.claw.x >= x[0] - 1e-9 && this.claw.x <= x[1] + 1e-9 && this.claw.z >= z[0] - 1e-9 && this.claw.z <= z[1] + 1e-9;
  }

  update(dt: number, input: Vec2, now: number): 'drop' | null {
    if (this.droppedAt !== null) return null;
    const { x, z } = this.range, v = MACHINE_SPEC.claw_speed * dt;
    const toward = (p: number, lo: number, hi: number) => (p < lo ? Math.min(lo, p + v) : p > hi ? Math.max(hi, p - v) : p);
    this.claw = this.inside()
      ? { x: Math.min(Math.max(this.claw.x + input.x * v, x[0]), x[1]), z: Math.min(Math.max(this.claw.z + input.z * v, z[0]), z[1]) }
      : { x: toward(this.claw.x, x[0], x[1]), z: toward(this.claw.z, z[0], z[1]) }; // 레버로 갈 수 있는 곳으로 먼저 나간다
    this.remaining = this.limit - (now - this.startedAt);
    return this.remaining <= 0 ? this.requestDrop(now) : null;
  }

  requestDrop(now: number): 'drop' | null {
    if (this.droppedAt !== null || !this.inside()) return null; // 미는 뽑기 턱 위(시작 자리)에서는 내리지 않는다
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
