import type { DollLook, DollSpot } from '../net/protocol';
import { DOLL_FLOOR } from '../world/machine';

// 테스트용 기계 속 인형 한 칸 — 변형은 기본(색 0·보통·웃음·일반), 번호는 차례로.
// ry는 세로축 돌림, y는 바닥에서의 높이(null이면 아직 안 앉은 인형)
let uid = 0;
export function spot(kind: string, x: number, z: number, ry = 0, y: number | null = 0, look: Partial<DollLook> = {}): DollSpot {
  const l = { color: 0, body: 'n' as const, face: 0, rare: '', ...look };
  const h = ry / 2;
  return [kind, x, y === null ? null : DOLL_FLOOR + y, z, 0, Math.sin(h), 0, Math.cos(h), l.color, l.body, l.face, l.rare, ++uid];
}
