import { beforeAll, expect, test } from 'vitest';
import { FIGURE, variantOf } from '../data/figures';
import type { BoxWire } from '../net/protocol';
import { FigureClaw } from './figureClaw';
import { runFigureCycle } from './figureCycle';
import { FigureWorld } from './figureWorld';
import { loadRapier, type Rapier } from './rapier';

// 9단계 피규어 물리(설계 §3.2): 두 막대 위 상자, 힘이 약한 두 팔 집게 — 가운데를 집으면 못 들고, 끝을 집으면 걷거나 기운다
let R: Rapier;
beforeAll(async () => { R = await loadRapier(); });

const { bars } = FIGURE, { box: B } = variantOf('long');
const LYING: BoxWire = [0, bars.y + bars.radius + B.d / 2, 0, 0, 0, 0, 1];
const settle = (w: FigureWorld, s: number) => { for (let t = 0; t < s; t += 1 / 60) w.step(1 / 60); };
const angle = (a: BoxWire, b: BoxWire) => 2 * Math.acos(Math.min(1, Math.abs(a[3] * b[3] + a[4] * b[4] + a[5] * b[5] + a[6] * b[6])));

test('a fresh box rests across both bars', () => {
  const w = new FigureWorld(R, LYING);
  settle(w, 3);
  const p = w.boxPose();
  expect(w.fallen()).toBe(false);
  expect(Math.hypot(p[0] - LYING[0], p[1] - LYING[1], p[2] - LYING[2])).toBeLessThan(0.002);
  w.dispose();
});

test('grabbing the middle cannot lift the box off the bars', () => {
  const w = new FigureWorld(R, LYING);
  settle(w, 1);
  for (let i = 0; i < 20; i++) {
    const before = w.boxPose();
    let top = before[1];
    const claw = new FigureClaw(R, w, before[0], before[2]);
    const r = runFigureCycle(w, claw, before[0], before[2], { onTick: () => { top = Math.max(top, w.boxPose()[1]); } });
    claw.dispose();
    expect(r.won, `cycle ${i}`).toBe(false);
    expect(top - before[1], `cycle ${i}`).toBeLessThan(variantOf('long').power.max_lift + 0.005);
  }
  w.dispose();
});

// 가벼운 쪽(무게중심 반대, box.com < 0이면 +z) 끝을 집으면 그 끝이 들썩여 상자가 걷거나 돈다 — 한 자리의 우연에 기대지 않게 세 자리 중 둘 이상
test('grabbing the light end walks or tips the box', () => {
  let moves = 0;
  for (const dx of [-0.01, 0, 0.01]) {
    const w = new FigureWorld(R, LYING);
    settle(w, 1);
    const before = w.boxPose(), x = before[0] + dx, z = before[2] - Math.sign(B.com) * (B.h / 2 - 0.02);
    const claw = new FigureClaw(R, w, x, z);
    const r = runFigureCycle(w, claw, x, z);
    claw.dispose(); w.dispose();
    if (Math.hypot(r.box[0] - before[0], r.box[2] - before[2]) > 0.003 || angle(r.box, before) > Math.PI / 180) moves++;
  }
  expect(moves).toBeGreaterThanOrEqual(2);
});

test('the same play gives the same box twice', () => {
  const play = () => {
    const w = new FigureWorld(R, LYING);
    const claw = new FigureClaw(R, w, 0.01, -0.07);
    const r = runFigureCycle(w, claw, 0.01, -0.07);
    claw.dispose(); w.dispose();
    return r;
  };
  expect(play()).toEqual(play());
});

test('a standing box drops between the bars', () => {
  const s = Math.SQRT1_2;
  const w = new FigureWorld(R, [0, bars.y + B.h / 2 + 0.02, 0, s, 0, 0, s]); // 긴 변을 세움
  settle(w, 1.5);
  expect(w.fallen()).toBe(true);
  w.dispose();
});
