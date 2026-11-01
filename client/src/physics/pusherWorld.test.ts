import { beforeAll, expect, test } from 'vitest';
import { PUSHER, plateFront } from '../data/pushers';
import type { DollSpot } from '../net/protocol';
import { DOLL_FLOOR } from '../world/machine';
import { PusherWorld } from './pusherWorld';
import { loadRapier, type Rapier } from './rapier';

// 미는 뽑기 물리(설계 2026-11-02 ring-hook §4): 턱 위 미니 인형을 3분의 1만 미는 판이 오가며 밀고, 쌓이면 앞 끝으로 떨어진다
let R: Rapier;
beforeAll(async () => { R = await loadRapier(); });
const { ledge, plate, drop } = PUSHER, TOP = DOLL_FLOOR + ledge.h;
const KINDS = ['bear', 'penguin', 'cat', 'duck', 'frog', 'bunny', 'chick', 'pig', 'seal', 'dog'];
const spot = (uid: number, x: number, y: number | null, z: number): DollSpot => [KINDS[uid % KINDS.length], x, y, z, 0, 0, 0, 1, uid % 6, 'n', 0, '', uid];
const run = (w: PusherWorld, s: number) => { for (let t = 0; t < s; t += 1 / 60) w.step(1 / 60); };
const dropped = (n: number) => Array.from({ length: n }, (_, i) => spot(i + 1, drop[0] + ((i % 3) - 1) * 0.04, null, drop[1]));

test('the plate pushes only a third of the ledge', () => {
  const zs = Array.from({ length: 300 }, (_, i) => plateFront((i / 300) * plate.period));
  expect(Math.min(...zs)).toBeCloseTo(ledge.z0, 4);
  expect(Math.max(...zs) - ledge.z0).toBeCloseTo((ledge.z1 - ledge.z0) / 3, 2);
});

test('dolls dropped on the ledge are pushed off the front edge as they pile up', () => {
  const one = new PusherWorld(R, dropped(1));
  one.setHoleOpen(true); run(one, 20);
  expect(one.fallen()).toEqual([]); // 하나만으로는 앞 끝까지 안 밀린다(3분의 1)
  const many = new PusherWorld(R, dropped(10));
  many.setHoleOpen(true); run(many, 40);
  expect(many.fallen().length).toBeGreaterThan(0);
}, 120_000);

test('a doll that rolls off the ledge side lands in the pile and is not won', () => {
  const w = new PusherWorld(R, [spot(1, ledge.x1 + 0.03, TOP + 0.02, 0)]);
  w.setHoleOpen(true); run(w, 3);
  const [p] = w.poses();
  expect(w.fallen()).toEqual([]);
  expect(p.p[1]).toBeLessThan(TOP - 0.02);
  expect(p.p[0]).toBeGreaterThan(ledge.x1);
});

test('after settling the plate touches no doll', () => {
  const w = new PusherWorld(R, dropped(7));
  w.setHoleOpen(true); run(w, 60);
  const before = new Map(w.poses().map((p) => [p.uid, p.p]));
  run(w, plate.period);
  for (const p of w.poses()) {
    const b = before.get(p.uid)!;
    expect(Math.hypot(p.p[0] - b[0], p.p[1] - b[1], p.p[2] - b[2]), `uid ${p.uid}`).toBeLessThan(0.003);
  }
}, 120_000);

test('no doll ends inside the plate or outside the walls', () => {
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 8; k++) {
    const n = 3 + Math.floor(rand() * 8);
    const spots = Array.from({ length: n }, (_, i) => spot(i + 1, ledge.x0 + 0.08 + rand() * (ledge.x1 - ledge.x0 - 0.12), null, ledge.z0 + 0.04 + rand() * (ledge.z1 - ledge.z0 - 0.06)));
    const w = new PusherWorld(R, spots);
    w.setHoleOpen(true); run(w, 20);
    for (const p of w.poses()) {
      const [x, y, z] = p.p, out = y < DOLL_FLOOR - 0.15;
      if (out) continue; // 출구로 떨어짐
      expect(Math.abs(x)).toBeLessThan(0.57);
      expect(Math.abs(z)).toBeLessThan(0.51);
      expect(x < ledge.x1 && z < ledge.z0 - 0.01 && y < TOP + plate.h - 0.01, `uid ${p.uid} in the plate box`).toBe(false);
    }
  }
}, 180_000);

test('the same play gives the same ledge', () => {
  const a = new PusherWorld(R, dropped(6)), b = new PusherWorld(R, dropped(6));
  a.setHoleOpen(true); b.setHoleOpen(true); run(a, 10); run(b, 10);
  expect(a.poses()).toEqual(b.poses());
}, 60_000);
