import { expect, test } from 'vitest';
import { CABINET_INNER, clawHalfX, clawShapeOf, openReach } from './figureClaw';
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
