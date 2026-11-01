import type { DollSpot } from '../net/protocol';
import { headOf } from '../world/dolls';
import { MACHINE_SPEC } from '../data/storeLayout';
import { DOLL_FLOOR, DOLL_SCALE } from '../world/machine';
import { headAt } from '../world/dollPose';

const RING_LIFT = 0.012;

// 겨냥 고리 높이: 집게 바로 아래(기계 안 좌표 x,z)에서 가장 높은 면 — 인형 위면 그 인형 머리 위, 아니면 바닥(floor, 미는 뽑기 턱 위면 턱 윗면).
// 무더기 전체에 광선을 쏘면 휴대폰에서 무거워서, 인형 자리·돌림에서 머리 공을 계산한다. scale은 인형 크기(미는 뽑기는 미니 인형)
export function aimHeight(spots: DollSpot[], x: number, z: number, scale = DOLL_SCALE, floor = DOLL_FLOOR): number {
  let top = floor + RING_LIFT;
  for (const s of spots) {
    const head = headAt(s, spots, scale), r = headOf(s[0]).r * scale; // 인형 머리(동글이형은 몸통 위쪽)를 구로 본 크기 (world/dolls.ts HEAD)
    const d = Math.hypot(head.x - x, head.z - z);
    if (d >= r) continue;
    top = Math.max(top, head.y + Math.sqrt(r * r - d * d) + 0.005);
  }
  return top;
}

// 겨냥 고리를 보일까: 집게가 상품 구멍 위(시작 자리)면 숨긴다 — 인형이 없는 곳이고, 레버 공 뒤에 걸쳐 보였다 (교환소 개편 설계 §4.7)
export function aimVisible(claw: { x: number; z: number }): boolean {
  const [hx, hz, hr] = MACHINE_SPEC.hole;
  return Math.hypot(claw.x - hx, claw.z - hz) >= hr;
}
