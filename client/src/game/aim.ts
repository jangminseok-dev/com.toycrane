import type { DollSpot } from '../net/protocol';
import { headOf } from '../world/dolls';
import { MACHINE_SPEC } from '../data/storeLayout';
import { DOLL_FLOOR, DOLL_SCALE } from '../world/machine';

const ON_FLOOR = DOLL_FLOOR + 0.012;

// 겨냥 고리 높이: 집게 바로 아래(기계 안 좌표 x,z)에서 가장 높은 면 — 인형 위면 그 인형 머리 위, 아니면 펠트 바닥.
// 무더기 전체에 광선을 쏘면 휴대폰에서 무거워서, 서버가 준 인형 자리로 계산한다
export function aimHeight(spots: DollSpot[], x: number, z: number): number {
  let top = ON_FLOOR;
  for (const [id, sx, sz, , y = 0] of spots) {
    const { c, r } = headOf(id); // 인형 머리(동글이형은 몸통 위쪽)를 구로 본 크기 (world/dolls.ts HEAD)
    const d = Math.hypot(sx - x, sz - z) / DOLL_SCALE;
    if (d >= r) continue;
    const h = DOLL_FLOOR + y + DOLL_SCALE * (c + Math.sqrt(r * r - d * d));
    top = Math.max(top, h + 0.005);
  }
  return top;
}

// 겨냥 고리를 보일까: 집게가 상품 구멍 위(시작 자리)면 숨긴다 — 인형이 없는 곳이고, 레버 공 뒤에 걸쳐 보였다 (교환소 개편 설계 §4.7)
export function aimVisible(claw: { x: number; z: number }): boolean {
  const [hx, hz, hr] = MACHINE_SPEC.hole;
  return Math.hypot(claw.x - hx, claw.z - hz) >= hr;
}
