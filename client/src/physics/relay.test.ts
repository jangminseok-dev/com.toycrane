import { expect, test } from 'vitest';
import type { DollPose, Pose } from '../net/protocol';
import { PoseReceiver, PoseSender } from './relay';

const doll = (uid: number, y: number): DollPose => ({ uid, p: [0.1, y, 0.2], q: [0, 0, 0, 1] });
const msg = (f: Pose['f']): Pose => ({ t: 'pose', m: 'A-1', id: 'p1', f });

// 무료 한도(매장 들어오는 메시지 하루 10만 개, 사용자 2026-11-02 '0.4초로'): 판을 하는 화면은 집게·움직이는 인형 자리를 초당 10번 재되,
// 0.4초마다 한 묶음(f: [[나이(초), 집게, 인형들], …] — 나이 0이 가장 새것)으로 보낸다. 소수 2자리
test('sender samples ten times a second but sends one bundle every 0.4 seconds', () => {
  const sent: string[] = [];
  const s = new PoseSender((m) => sent.push(m), 10, 0.4);
  for (let i = 0; i <= 120; i++) s.frame('A-1', { x: 0.123, y: 1.5 - i * 0.005, z: 0.2, open: 0.4 }, Math.floor(i / 6) % 2 ? [doll(7, 1.3)] : [], i * (1 / 60));
  expect(sent.length).toBeGreaterThanOrEqual(4);
  expect(sent.length).toBeLessThanOrEqual(6);
  const m = JSON.parse(sent[1]) as Pose;
  expect(m.t).toBe('pose'); expect(m.m).toBe('A-1');
  expect(m.f.length).toBeGreaterThanOrEqual(3); expect(m.f.length).toBeLessThanOrEqual(5); // 0.4초 동안 10Hz로 잰 자리들
  expect(m.f[m.f.length - 1][0]).toBe(0); // 마지막이 가장 새것
  expect(m.f[0][0]).toBeGreaterThan(0.25); // 첫 자리는 0.3초쯤 전
  expect(m.f[0][1][0]).toBe(0.12); // 소수 2자리
  expect(m.f.some((fr) => fr[2].length === 1) && m.f.some((fr) => fr[2].length === 0)).toBe(true);
});

// 판이 끝날 때는 모아 둔 것을 바로 보낸다(done보다 먼저 가게) — 비어 있으면 안 보낸다
test('flush sends what is pending right away', () => {
  const sent: string[] = [];
  const s = new PoseSender((m) => sent.push(m), 10, 0.4);
  s.frame('A-1', { x: 0, y: 1.5, z: 0, open: 0.4 }, [], 0);
  s.frame('A-1', { x: 0, y: 1.4, z: 0, open: 0.4 }, [], 0.1);
  expect(sent.length).toBe(0);
  s.flush(0.15);
  expect(sent.length).toBe(1);
  expect((JSON.parse(sent[0]) as Pose).f.map((fr) => fr[0])).toEqual([0.1, 0]);
  s.flush(0.2);
  expect(sent.length).toBe(1);
});

// 구경하는 사람이 없으면(12m 안에 아무도 없음) 아예 보내지 않는다 — 모아 둔 것도 버린다
test('nothing is sent while nobody is watching', () => {
  const sent: string[] = [];
  const s = new PoseSender((m) => sent.push(m), 10, 0.4);
  for (let i = 0; i <= 60; i++) s.frame('A-1', { x: 0, y: 1.5, z: 0, open: 0.4 }, [], i * (1 / 60), false);
  expect(sent.length).toBe(0);
  for (let i = 61; i <= 120; i++) s.frame('A-1', { x: 0, y: 1.5, z: 0, open: 0.4 }, [], i * (1 / 60), true);
  expect(sent.length).toBeGreaterThanOrEqual(2);
  expect((JSON.parse(sent[0]) as Pose).f[0][0]).toBeLessThan(0.5); // 안 보던 때의 자리는 섞이지 않는다
});

// 받는 쪽은 묶음 속 자리들을 각각의 시각(받은 때 − 나이)에 놓고, 0.5초 늦게 그 사이를 이어 그린다. 그 뒤로는 마지막 자리를 든다
test('receiver spreads a bundle over time and interpolates half a second behind', () => {
  const r = new PoseReceiver(0.5);
  r.push(msg([[0.2, [0, 1.9, 0, 1], [[7, 0.1, 1.0, 0.2, 0, 0, 0, 1]]], [0.1, [0, 1.7, 0, 0.75], [[7, 0.1, 1.2, 0.2, 0, 0, 0, 1]]], [0, [0, 1.5, 0, 0.5], [[7, 0.1, 1.4, 0.2, 0, 0, 0, 1]]]]), 1.0); // 자리들은 0.8·0.9·1.0 시각
  const mid = r.sample(1.35); // 0.85 시점 = 첫째·둘째 가운데
  expect(mid.claw[1]).toBeCloseTo(1.8);
  expect(mid.claw[3]).toBeCloseTo(0.875);
  expect(mid.dolls.get(7)!.p[1]).toBeCloseTo(1.1);
  const late = r.sample(3.0);
  expect(late.claw[1]).toBeCloseTo(1.5);
  expect(late.dolls.get(7)!.p[1]).toBeCloseTo(1.4);
});

test('a doll missing from the newer pose keeps its last known place', () => {
  const r = new PoseReceiver(0.5);
  r.push(msg([[0, [0, 1.9, 0, 1], [[7, 0.1, 1.0, 0.2, 0, 0, 0, 1]]]]), 1.0);
  r.push(msg([[0, [0, 1.9, 0, 1], []]]), 1.4);
  expect(r.sample(2.5).dolls.get(7)!.p[1]).toBeCloseTo(1.0);
});
