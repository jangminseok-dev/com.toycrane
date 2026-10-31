import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { Swing } from '../game/swing';
import { Tweens } from '../game/tween';
import type { DollSpot, Outcome, Result } from '../net/protocol';
import { stubCanvas } from '../test/canvasStub';
import type { BigZone } from './bigZone';
import { makeClawRig, type ClawRig } from './claw';
import { runClaw } from './clawShow';
import { CLAW_REST } from './machine';
import { spot } from '../test/spots';

beforeAll(stubCanvas);

// 기계 하나만 흉내 낸 무더기: setContents가 곧 "다음 프레임에 그려질 무더기"
function fakeZone(spots: DollSpot[]) {
  const anchor = new THREE.Group(), claw = new THREE.Group();
  claw.position.copy(CLAW_REST); anchor.add(claw);
  let pile = spots, rig: ClawRig | null = null;
  const zone = {
    contentsOf: () => pile,
    setContents: (_id: string, s: DollSpot[]) => { pile = s; },
    clawOf: () => claw, worldOf: () => anchor,
    activateClaw: () => { rig ??= makeClawRig(); claw.add(rig.root); return rig; },
    rigOf: () => rig, releaseClaw: () => { rig?.root.removeFromParent(); rig = null; },
  } as unknown as BigZone;
  return { zone, anchor, pile: () => pile };
}

// 연출 내내 매 프레임: 원래 인형마다 무더기에 있거나 따로 그려지거나 — 정확히 한 번 (없어지거나 둘로 보이면 안 된다)
async function drawnCounts(o: Outcome) {
  const spots: DollSpot[] = [spot('bear', 0, 0, 0, 0), spot('cat', 0.22, 0, 1, 0), spot('bunny', -0.22, 0, 2, 0)];
  const { zone, anchor, pile } = fakeZone(spots);
  const tw = new Tweens();
  const m: Result = { t: 'result', m: 'C-6', id: 'p1', x: 0.02, z: 0, o, part: 'head', k: 'bear', i: 0 };
  let done = false;
  void runClaw({ tw, zone, swing: new Swing(), takePending: () => (o === 'slip' ? [spot('bear', 0.1, 0.12, 0, 0), spots[1], spots[2]] : undefined) }, m, true).then(() => { done = true; });
  const worst: number[] = [];
  for (let f = 0; f < 400 && !done; f++) {
    tw.update(1 / 30);
    for (let k = 0; k < 5; k++) await Promise.resolve();
    const counts = spots.map((s) => pile().filter((p) => p[0] === s[0]).length);
    anchor.traverse((c) => { if (typeof c.userData.spot === 'number') counts[c.userData.spot]++; });
    worst.push(...counts.map((n, i) => (o === 'win' && i === 0 ? Math.min(n, 1) : n)));
  }
  return { done, worst };
}

for (const o of ['miss', 'slip', 'win'] as const) test(`every doll stays drawn exactly once through a ${o}`, async () => {
  const { done, worst } = await drawnCounts(o);
  expect(done).toBe(true);
  expect(Math.min(...worst)).toBe(o === 'win' ? 0 : 1); // 성공한 인형만 구멍으로 사라진다
  expect(Math.max(...worst)).toBe(1);
});

// 뚱뚱 인형은 집게에 잡혀 들려도 뚱뚱하다 — 눌림(4%)은 체형 폭 위에 얹힌다 (설계 2026-10-31 인형 채우기 §4.4)
test('a chubby doll keeps its width through the claw show', async () => {
  const spots: DollSpot[] = [spot('bear', 0, 0, 0, 0, { body: 'c', color: 3 })];
  const { zone, anchor } = fakeZone(spots);
  const tw = new Tweens();
  const m: Result = { t: 'result', m: 'C-6', id: 'p1', x: 0.02, z: 0, o: 'win', part: 'head', k: 'bear', i: 0 };
  let done = false;
  void runClaw({ tw, zone, swing: new Swing(), takePending: () => undefined }, m, true).then(() => { done = true; });
  const ratios: number[] = [];
  for (let f = 0; f < 400 && !done; f++) {
    tw.update(1 / 30);
    for (let k = 0; k < 5; k++) await Promise.resolve();
    anchor.traverse((c) => {
      if (c.userData.spot !== 0) return;
      expect(c.scale.x).toBeCloseTo(c.scale.z, 6);
      ratios.push(c.scale.x / c.scale.y);
    });
  }
  expect(ratios.length).toBeGreaterThan(10);
  expect(Math.min(...ratios)).toBeGreaterThan(1.15 * 0.96 / 1.03 - 1e-6);
  expect(Math.max(...ratios)).toBeLessThan(1.15 + 1e-6);
});
