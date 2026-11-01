import { expect, test } from 'vitest';
import { CLAW, clawStrength } from './claw';
import { DOLLS } from './catalog';
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
  expect(CLAW.rare).toEqual({ rare: 0.79, gold: 0.72 }); // 곰·펭귄 1000판 기준에 맞춘 값(구멍 38cm·집게 힘 4.4 뒤 다시 맞춤, 2026-11-02)
  expect(CLAW.hole).toEqual({ size: 0.38, lip: 0.06 }); // 34cm에선 긴 다리 인형이 테두리에 걸렸다(사용자 2026-11-02)
  expect(CLAW.max_wins).toBe(3);
  expect(CLAW.carry_relax).toBeGreaterThan(0);
  expect(CLAW.base_force).toBeGreaterThan(0);
});

// 인형 리뉴얼 설계 §6: 승인된 생김새는 고치지 않고 종류별 힘 배율(없으면 1)로 24종 모두 머리 겨냥 3~4/10에 맞춘다
test('per-kind strength factors name real dolls and stay gentle', () => {
  for (const [id, k] of Object.entries(CLAW.kind)) { expect(DOLLS[id], id).toBeTruthy(); expect(k).toBeGreaterThanOrEqual(0.6); expect(k).toBeLessThanOrEqual(1.6); }
});
