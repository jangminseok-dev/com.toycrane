import { beforeAll, expect, test } from 'vitest';
import type { DollSpot } from '../net/protocol';
import { stubCanvas } from '../test/canvasStub';
import { DOLL_FLOOR } from '../world/machine';
import { ClawBody } from './clawBody';
import { MachineWorld, type Rapier } from './machineWorld';
import { loadRapier } from './rapier';

beforeAll(stubCanvas);
let R: Rapier;
beforeAll(async () => { R = await loadRapier(); });
const standing = (uid: number, x: number, z: number): DollSpot => ['bear', x, DOLL_FLOOR, z, 0, 0, 0, 1, 0, 'n', 0, '', uid];

// 물리 뽑기 설계 §4.3·§9.4: 손가락 끝 셋이 같은 인형에 닿으면 꽉 쥠, 둘이면 약하게
test('three fingertips on one doll make a full grip, two or fewer a weaker one', () => {
  const world = new MachineWorld(R, [standing(1, 0, 0)]);
  const claw = new ClawBody(R, world);
  const plan = claw.plan(0, 0);
  claw.setPose(0, plan.y, 0, plan.open);
  expect(claw.touching().get(1)).toBe(3);
  const shifted = claw.plan(0.08, 0);
  claw.setPose(0.08, shifted.y, 0, shifted.open);
  expect(claw.touching().get(1) ?? 0).toBeLessThan(3);
  world.dispose();
});

test('a grip breaks when the load exceeds its max force', () => {
  const world = new MachineWorld(R, [standing(1, 0, 0)]);
  const claw = new ClawBody(R, world);
  const plan = claw.plan(0, 0);
  claw.setPose(0, plan.y, 0, plan.open);
  world.step(1 / 120);
  claw.grip(1, 'three', 2.0); // 최대 힘 2N: 보통 인형(0.25kg)은 들리고
  for (let i = 0; i < 120; i++) { claw.setPose(0, plan.y + i * 0.002, 0, plan.open); world.step(1 / 120); claw.update(); }
  expect(claw.held()).toBe(1);
  world.bodyOf(1)!.setAdditionalMass(10, true); // 갑자기 10kg이 되면 끊어진다
  for (let i = 0; i < 120 && claw.held() !== null; i++) { claw.setPose(0, plan.y + 0.24 + i * 0.002, 0, plan.open); world.step(1 / 120); claw.update(); }
  expect(claw.held()).toBeNull();
  world.dispose();
});
