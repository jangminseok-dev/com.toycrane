import { expect, test } from 'vitest';
import { probesAt } from './gripPlan';
import { HoldLook, cageY, wrapOpen } from './holdLook';

// 쥔 인형의 보이는 모습 (사용자 2026-11-01: 손가락이 인형을 안 감싸는 느낌) — 화면·중계만, 물리·판정은 그대로
test('the wrapping opening puts the fingertips just inside the gripped ball', () => {
  for (const r of [0.07, 0.1, 0.13]) {
    const open = wrapOpen(r);
    const tips = probesAt(0, 0, 0, open).tips;
    const radius = Math.max(...tips.map((t) => Math.hypot(t.x, t.z)));
    expect(radius / r).toBeGreaterThan(0.6); expect(radius / r).toBeLessThan(0.8);
  }
});

test('the cage height keeps the ball between the hub and the fingertips', () => {
  const open = wrapOpen(0.1), tipsY = Math.min(...probesAt(0, 0, 0, open).tips.map((t) => t.y));
  const y = cageY(open, 0.1);
  expect(y).toBeGreaterThan(tipsY); // 공 중심이 손가락 끝보다 위
  expect(y + 0.1).toBeLessThan(-0.03); // 공 꼭대기는 허브 아래
});

test('holding blends the fingers to the wrap and lifts the doll into the cage; letting go blends back', () => {
  const look = new HoldLook();
  const hold = { r: 0.1, c: [0.02, 1.0, 0.01] as [number, number, number] }, claw = { x: 0, y: 1.3, z: 0 };
  expect(look.open(0.6, null)).toBe(0.6);
  for (let i = 0; i < 30; i++) look.update(1 / 60, true);
  expect(Math.abs(look.open(0.6, hold) - wrapOpen(0.1))).toBeLessThan(0.02);
  const s = look.shift(claw, hold);
  expect(s[0]).toBeCloseTo(-0.02, 2); // 허브 바로 아래로
  expect(s[1]).toBeCloseTo(1.3 + cageY(wrapOpen(0.1), 0.1) - 1.0, 2);
  for (let i = 0; i < 30; i++) look.update(1 / 60, false);
  expect(look.open(0.6, null)).toBe(0.6);
  expect(Math.hypot(...look.shift(claw, hold))).toBeLessThan(0.005);
});
