import { step, type Vec2 } from './movement';

// 다른 사람: 마지막으로 받은 위치·방향에서 걷는 속도로 이어 간다고 보고 지금 위치를 추정한다
export type RemoteState = { pos: Vec2; dir: Vec2; receivedAt: number };

export function extrapolate(s: RemoteState, nowMs: number): Vec2 {
  return step(s.pos, s.dir, Math.max(nowMs - s.receivedAt, 0) / 1000);
}
