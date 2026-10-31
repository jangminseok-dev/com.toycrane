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
  world.settle(1);
  const claw = new ClawBody(R, world);
  // 머리 가운데를 노리고 오므리면 어느 벌림에선가 손가락 셋이 모두 닿는다
  const most = (x: number) => {
    const plan = claw.plan(x, 0);
    let best = 0;
    for (let open = plan.descendOpen; open >= 0; open -= 0.01) { claw.setPose(x, plan.y, 0, open); best = Math.max(best, claw.touching().get(1) ?? 0); }
    return best;
  };
  expect(most(0)).toBe(3);
  expect(most(0.12)).toBeLessThan(3); // 옆을 노리면 둘 이하
  world.dispose();
});

test('a grip breaks when the load exceeds its max force', () => {
  const world = new MachineWorld(R, [standing(1, 0, 0)]);
  const claw = new ClawBody(R, world);
  world.settle(1); // 인형이 가라앉은 뒤에
  const plan = claw.plan(0, 0);
  claw.setPose(0, plan.y, 0, plan.open);
  world.step(1 / 120);
  claw.grip(1, 'three', 5.0); // 최대 힘 5N × 거리 배율: 보통 인형(0.25kg, 2.45N)은 들리고
  for (let i = 0; i < 120; i++) { claw.setPose(0, plan.y + i * 0.002, 0, plan.open); claw.update(); world.step(1 / 120); }
  expect(claw.held()).toBe(1);
  world.bodyOf(1)!.setAdditionalMass(10, true); // 갑자기 10kg이 되면 끊어진다
  for (let i = 0; i < 120 && claw.held() !== null; i++) { claw.setPose(0, plan.y + 0.24 + i * 0.002, 0, plan.open); claw.update(); world.step(1 / 120); }
  expect(claw.held()).toBeNull();
  world.dispose();
});

// 붙는 점은 손가락 끝이 닿은 표면이 아니라 쥔 공(머리) 안쪽 — 접촉점에 매달면 인형이 손가락 아래로 줄처럼 늘어져 감싸는 모양이 안 난다 (사용자 2026-10-31 밤)
test('the grip anchors inside the gripped ball', () => {
  const world = new MachineWorld(R, [standing(1, 0, 0)]);
  const claw = new ClawBody(R, world);
  world.settle(1);
  const plan = claw.plan(0, 0);
  let open = plan.descendOpen; // 한 바퀴처럼 손가락 둘이 닿을 때까지 오므린 뒤 쥔다
  for (; open > 0 && (claw.touching().get(1) ?? 0) < 2; open -= 0.01) { claw.setPose(0, plan.y, 0, open); world.step(1 / 120); }
  claw.grip(1, 'three');
  const head = world.balls(1).sort((a, b) => b.c.y - a.c.y).find((b) => b.r > 0.05)!; // 가장 위의 큰 공 = 머리 (코·귀는 작다)
  const m = claw.debugAnchors().match(/doll\(([-\d.]+),([-\d.]+),([-\d.]+)\)/)!;
  expect(Math.hypot(+m[1] - head.c.x, +m[2] - head.c.y, +m[3] - head.c.z)).toBeLessThan(head.r * 0.6); // 표면이 아니라 공 안쪽
  world.dispose();
});
