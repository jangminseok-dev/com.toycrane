import type { DollLook, DollSpot } from '../net/protocol';

// 테스트용 기계 속 인형 한 칸 — 변형은 기본(색 0·보통·웃음·일반), 번호는 차례로
let uid = 0;
export function spot(kind: string, x: number, z: number, r: number, y = 0, look: Partial<DollLook> = {}): DollSpot {
  const l = { color: 0, body: 'n' as const, face: 0, rare: '', ...look };
  return [kind, x, z, r, y, l.color, l.body, l.face, l.rare, ++uid];
}
