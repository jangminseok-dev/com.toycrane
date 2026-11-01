import { beforeAll, describe, expect, test } from 'vitest';
import { FIGURE, variantOf, type BoxKind } from '../data/figures';
import type { BoxWire } from '../net/protocol';
import { FigureClaw } from './figureClaw';
import { runFigureCycle } from './figureCycle';
import { FigureWorld, barZ } from './figureWorld';
import { loadRapier, type Rapier } from './rapier';

// 9단계 피규어 물리(설계 §3.2·§8): 두 막대 위 큰 상자(긴 상자·정사각형), 힘이 약한 두 팔 집게 — 가운데를 집으면 못 들고, 끝을 집으면 걷거나 기운다.
// 앞판·받침 막대·뒤 벽이 앞뒤를 막아 두 막대 사이로만 빠진다
let R: Rapier;
beforeAll(async () => { R = await loadRapier(); });

const { bars, guards } = FIGURE;
const lying = (k: BoxKind, z = 0, yawDeg = 0): BoxWire => {
  const a = (yawDeg * Math.PI) / 360;
  return [0, bars.y + bars.radius + variantOf(k).box.d / 2, z, 0, Math.sin(a), 0, Math.cos(a)];
};
const settle = (w: FigureWorld, s: number, each?: () => void) => { for (let t = 0; t < s; t += 1 / 60) { w.step(1 / 60); each?.(); } };
const angle = (a: BoxWire, b: BoxWire) => 2 * Math.acos(Math.min(1, Math.abs(a[3] * b[3] + a[4] * b[4] + a[5] * b[5] + a[6] * b[6])));

describe.each(['long', 'square'] as const)('%s box', (kind) => {
  const B = variantOf(kind).box;

  test('a fresh box rests across both bars', () => {
    const w = new FigureWorld(R, lying(kind), kind);
    settle(w, 3);
    const p = w.boxPose(), start = lying(kind);
    expect(w.fallen()).toBe(false);
    expect(Math.hypot(p[0] - start[0], p[1] - start[1], p[2] - start[2])).toBeLessThan(0.002);
    w.dispose();
  });

  test('grabbing the middle cannot lift the box off the bars', () => {
    const w = new FigureWorld(R, lying(kind), kind);
    settle(w, 1);
    for (let i = 0; i < 12; i++) {
      const before = w.boxPose();
      let top = before[1];
      const claw = new FigureClaw(R, w, before[0], before[2]);
      const r = runFigureCycle(w, claw, before[0], before[2], { onTick: () => { top = Math.max(top, w.boxPose()[1]); } });
      claw.dispose();
      expect(r.won, `cycle ${i}`).toBe(false);
      expect(top - before[1], `cycle ${i}`).toBeLessThan(variantOf(kind).power.max_lift + 0.005);
    }
    w.dispose();
  });

  // 끝을 집으면(긴 상자는 무게중심 반대쪽 가벼운 끝, 정사각형은 앞 끝) 그 끝이 들썩여 상자가 걷거나 돈다 — 세 자리 중 둘 이상
  test('grabbing an end walks or tips the box', () => {
    let moves = 0;
    for (const dx of [-0.01, 0, 0.01]) {
      const w = new FigureWorld(R, lying(kind), kind);
      settle(w, 1);
      const end = B.com < 0 ? 1 : B.com > 0 ? -1 : 1;
      const before = w.boxPose(), x = before[0] + dx, z = before[2] + end * (B.h / 2 - 0.02);
      const claw = new FigureClaw(R, w, x, z);
      const r = runFigureCycle(w, claw, x, z);
      claw.dispose(); w.dispose();
      if (Math.hypot(r.box[0] - before[0], r.box[2] - before[2]) > 0.003 || angle(r.box, before) > Math.PI / 180) moves++;
    }
    expect(moves).toBeGreaterThanOrEqual(2);
  });

  test('the same play gives the same box twice', () => {
    const play = () => {
      const w = new FigureWorld(R, lying(kind), kind);
      const claw = new FigureClaw(R, w, 0.01, -0.07);
      const r = runFigureCycle(w, claw, 0.01, -0.07);
      claw.dispose(); w.dispose();
      return r;
    };
    expect(play()).toEqual(play());
  });

  // 세우면(긴 상자는 긴 변, 정사각형은 옆으로 — 두께가 틈을 가로지르게) 빠진다
  test('a standing box drops between the bars', () => {
    const s = Math.SQRT1_2;
    const w = new FigureWorld(R, [0, bars.y + B.h / 2 + 0.02, 0, s, 0, 0, s], kind);
    settle(w, 1.5);
    expect(w.fallen()).toBe(true);
    w.dispose();
  });

  // 앞뒤로는 빠질 곳이 없다(설계 §8.2): 세게 밀려도 앞판·받침 막대·뒤 벽에 막히고, 막대 아래로 간다면 두 막대 사이로만 —
  // 상자 가운데가 처음 막대보다 두께만큼 아래로 내려가는 순간 두 막대 사이에 있다(빠진 뒤 기계 속에서 막대 밑으로 밀려가는 건 상관없다)
  test('the box never leaves over the front or back', () => {
    for (const v of [1.5, -1.5]) {
      const w = new FigureWorld(R, lying(kind), kind);
      w.box.setLinvel({ x: 0, y: 0, z: v }, true);
      let crossZ: number | null = null;
      settle(w, 3, () => { const p = w.boxPose(); if (crossZ === null && p[1] < bars.y - B.d) crossZ = p[2]; });
      if (crossZ !== null) expect(Math.abs(crossZ), `push ${v} fell at`).toBeLessThan(barZ(kind));
      else expect(Math.abs(w.boxPose()[2]), `push ${v} stays inside`).toBeLessThan(barZ(kind) + guards.back_wall);
      w.dispose();
    }
  });
});

// 정사각형은 누운 채로는 어떻게 돌려도 두 막대에 걸친다(설계 §8.3) — 옆으로 세우거나 크게 기울여야 빠진다
test('a lying square box stays on the bars at any turn', () => {
  for (const yaw of [0, 20, 45, 70]) {
    const w = new FigureWorld(R, lying('square', 0, yaw), 'square');
    settle(w, 3);
    expect(w.fallen(), `${yaw}°`).toBe(false);
    w.dispose();
  }
});

// 뒤로 밀린 상자는 뒤 막대와 받침 막대에 얹혀 남고(뒤 벽에 닿기 직전), 앞 끝을 걸어 다시 끌어올 수 있다 — 영상의 '살려오기'
test('a box pushed onto the back support can be dragged back', () => {
  const B = variantOf('long').box, back = -(barZ('long') + guards.back_wall) + B.h / 2 + 0.01;
  const w = new FigureWorld(R, lying('long', back), 'long');
  settle(w, 2);
  expect(w.fallen()).toBe(false);
  const z0 = w.boxPose()[2];
  let best = z0;
  for (let i = 0; i < 6 && !w.fallen(); i++) {
    const p = w.boxPose(), z = p[2] + B.h / 2 - 0.03;
    const claw = new FigureClaw(R, w, p[0], z);
    runFigureCycle(w, claw, p[0], z);
    claw.dispose();
    best = Math.max(best, w.boxPose()[2]);
  }
  expect(w.fallen() || best > z0 + 0.01).toBe(true);
  w.dispose();
});
