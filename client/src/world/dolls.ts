import type { Body, DollLook } from '../net/protocol';
import { makePlush, plushShape, type Detail } from './plush';
import type { Hit } from './plush/kit';
import { SPECIES } from './plush/species';
import type * as THREE from 'three';

// 인형 24종 (전부 오리지널). 인형 리뉴얼(설계 2026-11-01, 승인 시제품 v13 → 도감 승인)부터 생김새는 world/plush가 만든다.
// 이름·세트·색 이름은 shared/catalog.json. 같은 캐릭터도 인형마다 색·표정·희귀가 다르다(DollLook, 인형 채우기 설계 §4.4).
// 체형(폭)은 놓는 쪽이 x·z 크기에 BODY_W를 곱한다
export type { Hit };
export const PLAIN: DollLook = { color: 0, body: 'n', face: 0, rare: '' };
// 체형 폭 (키는 같음) — 서버 domain/crane.py BODY_W와 같은 값
export const BODY_W: Record<Body, number> = { n: 1, c: 1.15, s: 0.88 };

// 동글이형(몸통 하나)인지 — 겨냥 고리가 인형 머리 높이를 가늠할 때 쓴다
export function isRoundDoll(id: string): boolean {
  return !!SPECIES[id]?.round;
}

// 인형 머리(동글이형은 몸통 위쪽)를 구로 본 크기 — 인형 모양 좌표(크기 1) 기준 중심 높이·반지름.
// 겨냥 고리(game/aim.ts)와 머리 기준 자세(world/dollPose.ts)가 쓴다
export function headOf(id: string): { c: number; r: number } {
  return plushShape(id)?.head ?? { c: 0.74, r: 0.35 };
}

// lite = 기계 속 무더기·진열장용: 면 수를 낮추고 잔 자수(수염·발가락 줄)를 뺀다(얼굴·입은 남긴다).
// 목록에 없는 id는 null (배포로 목록이 바뀐 뒤 저장된 배치에 남은 인형). 희귀 반짝이는 userData.spin으로 돌릴 것을 알려 준다
export function makeDoll(id: string, look: DollLook = PLAIN, lite: Detail = false): THREE.Group | null {
  return makePlush(id, look, lite)?.group ?? null;
}

// 집게가 닿는 공 (인형 모양 좌표, 크기 1): 단단한 공(solid, 발·꼬리 포함 + 희귀 왕관)과 말랑한 귀(ears).
// 체형만큼 옆으로 넓거나 좁게(공의 x·z·반지름 × BODY_W)
const hitsCache = new Map<string, { solid: Hit[]; ears: Hit[] }>();
export function dollHits(id: string, body: Body = 'n', rare = ''): { solid: Hit[]; ears: Hit[] } {
  const key = `${id}|${body}|${rare}`, known = hitsCache.get(key);
  if (known) return known;
  const p = plushShape(id, rare);
  const w = BODY_W[body];
  const widen = (h: Hit): Hit => ({ ...h, c: h.c.clone().set(h.c.x * w, h.c.y, h.c.z * w), r: h.r * w });
  const hits = { solid: (p?.solid ?? []).map(widen), ears: (p?.ears ?? []).map(widen) };
  hitsCache.set(key, hits);
  return hits;
}
