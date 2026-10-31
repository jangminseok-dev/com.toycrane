import { expect, test } from 'vitest';
import { CLAW, clawStrength } from './claw';
import { MACHINE_SPEC } from './storeLayout';

// 집게 성격표 (물리 뽑기 설계 §3.2·§3.3·§9.4): 구멍 가장자리 0.6 → 가장 먼 모서리 1.4(Task 8 시뮬레이션에서 ±40%로), 쥠의 질·희귀 배율·구멍 치수
test('claw strength grows from the hole edge to the far corner', () => {
  const [hx, hz, hr] = MACHINE_SPEC.hole, [w, d] = MACHINE_SPEC.play_half;
  expect(clawStrength(hx + hr, hz)).toBeCloseTo(0.6);
  expect(clawStrength(w, -d)).toBeCloseTo(1.4);
  expect(clawStrength(0, 0)).toBeGreaterThan(0.6);
  expect(clawStrength(0, 0)).toBeLessThan(1.4);
});

test('claw table carries the spec numbers', () => {
  expect(CLAW.quality).toEqual({ three: 1, two: 0.5 });
  expect(CLAW.rare).toEqual({ rare: 0.85, gold: 0.75 });
  expect(CLAW.hole).toEqual({ size: 0.34, lip: 0.06 });
  expect(CLAW.max_wins).toBe(3);
  expect(CLAW.carry_relax).toBeGreaterThan(0);
  expect(CLAW.base_force).toBeGreaterThan(0);
});
