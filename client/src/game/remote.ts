import { step, type Vec2 } from './movement';

// 다른 사람: 마지막으로 받은 위치·방향에서 걷는 속도로 이어 간다고 보고 지금 위치를 추정한다.
// 움직이는 사람은 3초마다 다시 보내므로, 3.5초 넘게 소식이 없으면 멈춘 것으로 본다
// (탭을 내리거나 연결이 멈추면 멈춤 메시지가 오지 않는다)
export const MAX_EXTRAPOLATE_MS = 3500;

export type RemoteState = { pos: Vec2; dir: Vec2; receivedAt: number };

export function extrapolate(s: RemoteState, nowMs: number): Vec2 {
  const elapsed = Math.min(Math.max(nowMs - s.receivedAt, 0), MAX_EXTRAPOLATE_MS);
  return step(s.pos, s.dir, elapsed / 1000);
}

export function isMoving(s: RemoteState, nowMs: number): boolean {
  return Math.hypot(s.dir.x, s.dir.z) > 0 && nowMs - s.receivedAt <= MAX_EXTRAPOLATE_MS;
}
