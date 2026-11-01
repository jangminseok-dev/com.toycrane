import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { HOOK, type RingSide } from '../data/hooks';
import type { BoxWire } from '../net/protocol';
import { FigureClaw } from './figureClaw';
import { runFigureCycle } from './figureCycle';
import { HookWorld, hingeOf, hookStart } from './hookWorld';
import { loadRapier, type Rapier } from './rapier';

// 고리 걸기 물리(설계 2026-11-02 ring-hook §3): 팔 끝이 고리 판 구멍을 지나 내려가 걸리면 그쪽이 들리고, 걸린 채 집으로 돌아오며 끌려온다
let R: Rapier;
beforeAll(async () => { R = await loadRapier(); });

const { shelf, box, exit } = HOOK;
const START: BoxWire = [0, shelf.y + box.h / 2, HOOK.start.z, 0, 0, 0, 1];
// 고리 쪽 상자 윗면 가장자리(접는 선) — 여기가 들리면 '그쪽이 들렸다'
const holeLocal = (side: RingSide) => new THREE.Vector3(...hingeOf(side).at);
const worldOf = (w: HookWorld, local: THREE.Vector3) => {
  const p = w.box.translation(), q = w.box.rotation();
  return local.clone().applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)).add(new THREE.Vector3(p.x, p.y, p.z));
};
// 한 판: 상자를 앉힌 뒤 (x, z)에서 집게 한 바퀴 — 고리 쪽이 가장 많이 들린 높이, 상자 가장 빠른 속도, 결과
function play(side: RingSide, x: number, z: number, start = START) {
  const w = new HookWorld(R, start, side);
  for (let t = 0; t < 1; t += 1 / 60) w.step(1 / 60);
  const hole = holeLocal(side), y0 = worldOf(w, hole).y;
  let lift = 0, speed = 0, outside = false;
  const r = runFigureCycle(w, new FigureClaw(R, w, x, z), x, z, {
    onTick: () => {
      lift = Math.max(lift, worldOf(w, hole).y - y0);
      const v = w.box.linvel(); speed = Math.max(speed, Math.hypot(v.x, v.y, v.z));
      const p = w.box.translation();
      if (Math.abs(p.x) > shelf.half_x + 0.02 || p.z < shelf.back_z - 0.02 || p.z > exit.front_z + 0.02) outside = true;
    },
  });
  return { w, r, lift, speed, outside, moved: Math.hypot(r.box[0] - START[0], r.box[2] - START[2]) };
}
// 오른쪽 고리 구멍에 왼팔 끝이 들어가는 겨냥(구멍 가운데 + 팔 벌림)을 둘레에서 찾는다
const aims = Array.from({ length: 9 }, (_, i) => -0.04 + i * 0.01); // 오른팔 끝이 구멍으로 들어가는 집게 가운데 둘레

test('an arm tip through the ring lifts that side of the box', () => {
  const best = Math.max(...aims.map((x) => play('right', x, START[2]).lift));
  expect(best).toBeGreaterThan(0.02);
});

test('a hooked box is dragged toward the exit when the claw goes home', () => {
  const hooked = aims.map((x) => play('right', x, START[2])).filter((p) => p.lift > 0.02);
  expect(hooked.length).toBeGreaterThan(0);
  expect(Math.max(...hooked.map((p) => p.r.box[2] - START[2]))).toBeGreaterThan(0.03); // 앞(+z, 출구 쪽)으로
});

test('a claw that misses the ring only nudges the box', () => {
  const p = play('right', -0.3, -0.25);
  expect(p.lift).toBeLessThan(0.005);
  expect(p.moved).toBeLessThan(0.03);
});

test('the box only wins through the front exit', () => {
  const edge = new HookWorld(R, [0, shelf.y + box.h / 2 + 0.01, shelf.front_z + 0.03, 0, 0, 0, 1], 'right');
  for (let t = 0; t < 3; t += 1 / 60) edge.step(1 / 60);
  expect(edge.fallen()).toBe(true); // 앞 끝을 넘은 상자는 출구로
  const back = new HookWorld(R, [0.3, shelf.y + box.h / 2, shelf.back_z + 0.06, 0, 0, 0, 1], 'left');
  for (let t = 0; t < 3; t += 1 / 60) back.step(1 / 60);
  expect(back.fallen()).toBe(false); // 옆·뒤는 벽
});

test('a hooked box never flies or leaves the machine', () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 30; i++) {
    const side = (['right', 'left'] as const)[i % 2], x = (rand() * 2 - 1) * 0.4, z = (rand() * 2 - 1) * 0.3;
    const p = play(side, x, z, hookStart(rand));
    expect(p.speed, `${side} ${x.toFixed(2)},${z.toFixed(2)}`).toBeLessThanOrEqual(2.05);
    expect(p.outside).toBe(false);
  }
}, 120_000);

test('the same drop gives the same box', () => {
  expect(play('left', 0.0, -0.1).r.box).toEqual(play('left', 0.0, -0.1).r.box);
});
