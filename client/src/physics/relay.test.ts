import { expect, test } from 'vitest';
import type { DollPose, Pose } from '../net/protocol';
import { PoseReceiver, PoseSender } from './relay';

const doll = (uid: number, y: number): DollPose => ({ uid, p: [0.1, y, 0.2], q: [0, 0, 0, 1] });

// 물리 뽑기 설계 §4.5: 판을 하는 화면은 집게와 움직이는 인형만 초당 10번 보낸다 (소수 2자리)
test('sender sends at most ten times a second and only moving dolls', () => {
  const sent: string[] = [];
  const s = new PoseSender((m) => sent.push(m), 10);
  for (let i = 0; i < 60; i++) s.frame('A-1', { x: 0.123, y: 1.5, z: 0.2, open: 0.4 }, i % 2 ? [doll(7, 1.3)] : [], i * (1 / 60));
  expect(sent.length).toBeGreaterThanOrEqual(9);
  expect(sent.length).toBeLessThanOrEqual(11);
  const m = JSON.parse(sent[0]);
  expect(m.t).toBe('pose'); expect(m.m).toBe('A-1'); expect(m.c).toEqual([0.12, 1.5, 0.2, 0.4]);
  expect(sent.some((x) => JSON.parse(x).d.length === 1)).toBe(true);
  expect(sent.some((x) => JSON.parse(x).d.length === 0)).toBe(true);
});

// 받는 쪽은 받은 두 자리 사이를 시간에 맞춰 잇고(0.1초 늦게), 그 뒤로는 마지막 자리를 든다
test('receiver interpolates between two poses and holds the last', () => {
  const r = new PoseReceiver(0.1);
  const at = (c: Pose['c'], y: number, now: number) => r.push({ t: 'pose', m: 'A-1', id: 'p1', c, d: [[7, 0.1, y, 0.2, 0, 0, 0, 1]] }, now);
  at([0, 1.9, 0, 1], 1.0, 1.0);
  at([0, 1.5, 0, 0.5], 1.4, 1.1);
  const mid = r.sample(1.15); // 1.05 시점 = 두 자리의 가운데
  expect(mid.claw[1]).toBeCloseTo(1.7);
  expect(mid.claw[3]).toBeCloseTo(0.75);
  expect(mid.dolls.get(7)!.p[1]).toBeCloseTo(1.2);
  const late = r.sample(3.0);
  expect(late.claw[1]).toBeCloseTo(1.5);
  expect(late.dolls.get(7)!.p[1]).toBeCloseTo(1.4);
});

test('a doll missing from the newer pose keeps its last known place', () => {
  const r = new PoseReceiver(0.1);
  r.push({ t: 'pose', m: 'A-1', id: 'p1', c: [0, 1.9, 0, 1], d: [[7, 0.1, 1.0, 0.2, 0, 0, 0, 1]] }, 1.0);
  r.push({ t: 'pose', m: 'A-1', id: 'p1', c: [0, 1.9, 0, 1], d: [] }, 1.1);
  expect(r.sample(2.0).dolls.get(7)!.p[1]).toBeCloseTo(1.0);
});
