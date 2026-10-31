import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import type { Hit } from '../world/dolls';
import { solidsOf } from '../world/dollPose';
import { makeClawRig, type ClawRig } from '../world/claw';
import { CLAW_REST, DOLL_FLOOR } from '../world/machine';
import { DESCEND_OPEN, planGrip } from './gripPlan';

beforeAll(stubCanvas);

// 기계 하나 흉내: anchor(원점) ⊃ claw(쉬는 높이, x·z) ⊃ rig.root
function machineWithClaw(x: number, z: number) {
  const anchor = new THREE.Group(), claw = new THREE.Group(), rig = makeClawRig();
  claw.position.set(x, CLAW_REST.y, z); claw.add(rig.root); anchor.add(claw);
  anchor.updateMatrixWorld(true);
  return { anchor, claw, rig };
}
const local = (anchor: THREE.Object3D, o: THREE.Object3D) => anchor.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
const inside = (rig: ClawRig, anchor: THREE.Object3D, hits: Hit[], margin: number) =>
  rig.probes.some((p) => { const w = local(anchor, p); return hits.some((h) => w.distanceTo(h.c) < h.r + margin); });
const hubBottomY = (rig: ClawRig, anchor: THREE.Object3D) => local(anchor, rig.probes[0]).y;
const tipsY = (rig: ClawRig, anchor: THREE.Object3D) => Math.max(...rig.tips.map((t) => local(anchor, t).y));

// 집게는 인형을 파고들지 않는다: 벌린 채 내려가다 닿기 직전에 멈춘다 (설계 2026-10-31 §3.6)
test('the claw stops on the head without sinking in', () => {
  const { rig, claw, anchor } = machineWithClaw(0, 0);
  const solids = solidsOf([['bear', 0, 0, 0, 0]]);
  const plan = planGrip(rig, claw, anchor, solids, 0);
  claw.position.y = plan.y; rig.setOpen(DESCEND_OPEN); anchor.updateMatrixWorld(true);
  expect(inside(rig, anchor, solids[0], 0.003)).toBe(false);
  const headTop = solids[0][1].c.y + solids[0][1].r;
  expect(hubBottomY(rig, anchor) - headTop).toBeLessThan(0.015);
});

// 머리를 감싸 쥔다: 손가락 끝이 머리 가운데보다 아래(목 쪽)까지 내려가 닿을 때까지만 오므린다
test('fingers close until they wrap the head, tips under its middle', () => {
  const { rig, claw, anchor } = machineWithClaw(0, 0);
  const solids = solidsOf([['bear', 0, 0, 0, 0]]);
  const plan = planGrip(rig, claw, anchor, solids, 0);
  claw.position.y = plan.y; rig.setOpen(plan.open); anchor.updateMatrixWorld(true);
  expect(plan.open).toBeLessThan(0.75);
  expect(tipsY(rig, anchor)).toBeLessThan(solids[0][1].c.y);
  rig.setOpen(plan.open - 0.03); anchor.updateMatrixWorld(true);
  expect(inside(rig, anchor, solids[0], 0.002)).toBe(true);
});

test('an empty spot closes all the way', () => {
  const { rig, claw, anchor } = machineWithClaw(0, 0);
  const plan = planGrip(rig, claw, anchor, [], null);
  expect(plan.open).toBe(0);
  expect(plan.y).toBeLessThan(DOLL_FLOOR + 0.35);
});

test('a taller neighbour stops the descent', () => {
  const { rig, claw, anchor } = machineWithClaw(0, 0);
  const low = planGrip(rig, claw, anchor, solidsOf([['bear', 0, 0, 0, 0]]), 0).y;
  const high = planGrip(rig, claw, anchor, solidsOf([['bear', 0, 0, 0, 0], ['bear', 0.04, 0.02, 0, 0.2]]), 0).y;
  expect(high).toBeGreaterThan(low + 0.1);
});

test('a neighbour beside the target does not stop the fingers', () => {
  const { rig, claw, anchor } = machineWithClaw(0, 0);
  const alone = planGrip(rig, claw, anchor, solidsOf([['bear', 0, 0, 0, 0]]), 0).open;
  const crowded = planGrip(rig, claw, anchor, solidsOf([['bear', 0, 0, 0, 0], ['cat', 0.3, 0, 0, 0]]), 0).open;
  expect(crowded).toBeCloseTo(alone, 2);
});

// 빽빽한 무더기(서버 최소 간격 22cm): 벌린 손가락이 옆 인형을 살짝(4cm까지) 누르며 내려간다 — 옆 인형 위에서 멈춰 버리면
// 손가락이 머리를 감싸지 못하고 "그대로 들어 올리는" 느낌이 된다 (사용자 지적 2026-10-31)
test('open fingers slide down past a close neighbour', () => {
  const { rig, claw, anchor } = machineWithClaw(0, 0);
  const alone = planGrip(rig, claw, anchor, solidsOf([['bear', 0, 0, 0, 0]]), 0).y;
  const crowded = planGrip(rig, claw, anchor, solidsOf([['bear', 0, 0, 0, 0], ['bear', 0.22, 0, 0, 0]]), 0).y;
  expect(crowded - alone).toBeLessThan(0.02);
});
