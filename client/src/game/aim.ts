import type { DollSpot } from '../net/protocol';
import { isRoundDoll } from '../world/dolls';
import { DOLL_FLOOR, DOLL_SCALE, STACK_RAISE } from '../world/machine';

// 인형 머리(동글이형은 몸통) 꼭대기를 구로 본 크기 — 인형 모양 좌표(크기 1) 기준 중심 높이·반지름 (world/dolls.ts)
const STANDING = { c: 0.8, r: 0.36 }, ROUND = { c: 0.5, r: 0.48 };
const ON_FLOOR = DOLL_FLOOR + 0.012;

// 겨냥 고리 높이: 집게 바로 아래(기계 안 좌표 x,z)에서 가장 높은 면 — 인형 위면 그 인형 머리 위, 아니면 펠트 바닥.
// 무더기 전체에 광선을 쏘면 휴대폰에서 무거워서, 서버가 준 인형 자리로 계산한다
export function aimHeight(spots: DollSpot[], x: number, z: number): number {
  let top = ON_FLOOR;
  spots.forEach(([id, sx, sz], i) => {
    const { c, r } = isRoundDoll(id) ? ROUND : STANDING;
    const d = Math.hypot(sx - x, sz - z) / DOLL_SCALE;
    if (d >= r) return;
    const h = DOLL_FLOOR + (i >= 6 ? STACK_RAISE : 0) + DOLL_SCALE * (c + Math.sqrt(r * r - d * d));
    top = Math.max(top, h + 0.005);
  });
  return top;
}
