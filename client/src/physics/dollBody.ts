import type { DollSpot } from '../net/protocol';
import { BODY_W, dollHits } from '../world/dolls';
import { DOLL_SCALE } from '../world/machine';

// 인형 한 마리의 부딪힘 모양 (물리 뽑기 설계 §4.2·§9.6): 지금 그려지는 부위 공들(dollHits.solid, 왕관 제외)에 기계 속 크기를 곱한 것.
// 무게는 보통 0.25kg에 체형 폭의 제곱(뚱뚱 ≈0.33, 마른 ≈0.19). 천 느낌: 마찰 큼, 튀지 않음, 금방 멈춤
export const DOLL_MASS = 0.25;
export const FRICTION = 0.8, RESTITUTION = 0.05, ANGULAR_DAMPING = 20, LINEAR_DAMPING = 1.8; // 봉제 인형은 구르지 않는다 — 밀리면 10cm쯤 가고 멈춤, 누운 인형의 고깔 구름도 없음 (2·0.2는 40cm를 굴렀다)
export type Ball = { r: number; at: [number, number, number] };

const shapesCache = new Map<string, Ball[]>();
// scale: 기계 속 인형 크기(인형 기계 DOLL_SCALE, 미는 뽑기 미니 인형은 더 작게) — 무게는 크기의 세제곱으로
export function dollColliders(spot: DollSpot, scale = DOLL_SCALE): { shapes: Ball[]; mass: number } {
  const [kind, , , , , , , , , body, , rare] = spot;
  const key = `${kind}|${body}|${rare}|${scale}`;
  let shapes = shapesCache.get(key);
  if (!shapes) {
    shapes = dollHits(kind, body, rare).solid.filter((h) => h.part !== 'crown')
      .map((h) => ({ r: h.r * scale, at: [h.c.x * scale, h.c.y * scale, h.c.z * scale] as [number, number, number] }));
    shapesCache.set(key, shapes);
  }
  return { shapes, mass: DOLL_MASS * BODY_W[body] ** 2 * (scale / DOLL_SCALE) ** 3 };
}
