import { expect, test } from 'vitest';
import { FIGURE, variantOf, guardsOf } from '../data/figures';
import { CABINET_INNER, clawHalfX, clawHalfZ, clawShapeOf, openReach } from './figureClaw';
import { barZ } from './figureWorld';
import { hookClawShape } from './hookWorld';

// 집게를 키우자(긴 상자 1.72배·정사각형 2.3배) 앞 왼쪽 쉬는 자리에서 벌린 팔이 기계 옆 기둥 밖으로 나갔다(사용자 2026-11-02 사진 224) —
// 집게 머리가 갈 수 있는 반폭은 벌린 팔 끝이 기둥 안쪽 면 안에 머무는 데까지
test('open claw arms stay inside the cabinet anywhere the claw can go', () => {
  for (const S of [clawShapeOf('long'), clawShapeOf('square'), hookClawShape()]) {
    expect(openReach(S)).toBeGreaterThan(S.hinge[0] + S.elbow[0]); // 벌리면 다문 팔보다 바깥
    expect(clawHalfX(S) + openReach(S)).toBeLessThanOrEqual(CABINET_INNER);
    expect(clawHalfX(S)).toBeGreaterThan(0.25); // 상자 위는 어디든 닿는다
  }
});

// 앞뒤 유리 벽(막대에서 상자 종류마다 7·17cm) 안쪽까지만 — 앞 유리를 세우자 처음 자리(z 0.34)의 집게 팔이 유리에 걸렸다. 상자 양 끝은 닿는다
test('the claw stays inside the front and back walls and still reaches both box ends', () => {
  for (const kind of ['long', 'square'] as const) {
    const S = clawShapeOf(kind), wall = barZ(kind) + guardsOf(kind).front_wall;
    expect(clawHalfZ(kind) + S.plateW / 2, kind).toBeLessThanOrEqual(wall - 0.02 + 1e-9);
    expect(clawHalfZ(kind), kind).toBeGreaterThan(variantOf(kind).box.h / 2);
  }
});
