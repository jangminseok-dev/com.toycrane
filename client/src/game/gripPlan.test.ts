import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import type { DollSpot } from '../net/protocol';
import { stubCanvas } from '../test/canvasStub';
import { makeClawRig } from '../world/claw';
import type { Hit } from '../world/dolls';
import { solidsOf } from '../world/dollPose';
import { CLAW_REST, DOLL_FLOOR, DOLL_SCALE } from '../world/machine';
import { contactPull, planGrip, probesAt } from './gripPlan';

beforeAll(stubCanvas);

const START = CLAW_REST.y;
const plan = (spots: DollSpot[], target: number | null, x = 0, z = 0) => ({ solids: solidsOf(spots), ...planGrip(x, z, START, solidsOf(spots), target) });
const depth = (pts: THREE.Vector3[], hits: Hit[]) => Math.max(0, ...pts.flatMap((p) => hits.map((h) => h.r - p.distanceTo(h.c))));
const gap = (pts: THREE.Vector3[], hits: Hit[]) => Math.min(...pts.flatMap((p) => hits.map((h) => p.distanceTo(h.c) - h.r)));

// 미리 잰 표본점 자리는 실제 집게의 표본점과 같다 (흔들림 없음, 같은 벌림)
test('cached probe offsets match a real claw rig', () => {
  const rig = makeClawRig(); rig.setOpen(0.6); rig.root.position.set(0.1, 1.5, -0.2); rig.root.updateMatrixWorld(true);
  const cached = probesAt(0.1, 1.5, -0.2, 0.6);
  rig.probes.forEach((p, i) => expect(p.getWorldPosition(new THREE.Vector3()).distanceTo(cached.all[i])).toBeLessThan(1e-6));
});

// 집게는 인형을 파고들지 않는다: 벌린 채 내려가다 닿기 직전에 멈춘다 (설계 2026-10-31 §3.6)
test('the claw stops on the head without sinking in', () => {
  const p = plan([['bear', 0, 0, 0, 0]], 0);
  const at = probesAt(0, p.y, 0, p.descendOpen);
  expect(depth(at.all, p.solids[0])).toBeLessThan(0.001);
  const headTop = p.solids[0][1].c.y + p.solids[0][1].r;
  expect(at.hub.y - headTop).toBeLessThan(0.015);
});

// 머리를 감싸 쥔다: 손가락 끝이 머리 가운데보다 아래(목 쪽)까지 내려가 닿을 때까지만 오므린다
test('fingers close until they wrap the head, tips under its middle', () => {
  const p = plan([['bear', 0, 0, 0, 0]], 0);
  const at = probesAt(0, p.y, 0, p.open);
  expect(p.open).toBeLessThan(0.75);
  expect(Math.max(...at.tips.map((t) => t.y))).toBeLessThan(p.solids[0][1].c.y);
  expect(depth(at.fingers, p.solids[0])).toBeLessThan(0.001);
  expect(depth(probesAt(0, p.y, 0, p.open - 0.03).fingers, p.solids[0])).toBeGreaterThan(0);
});

// 동글이형(펭귄·병아리·물범 …)도 손가락이 몸통을 감싸 쥔다 — 몸에서 떨어진 채 들어 올리면 안 된다 (최종 리뷰 C1)
for (const id of ['chick', 'penguin', 'seal']) test(`a round ${id} is wrapped, not lifted from afar`, () => {
  const p = plan([[id, 0, 0, 0, 0]], 0);
  const at = probesAt(0, p.y, 0, p.open);
  const equator = DOLL_FLOOR + 0.5 * DOLL_SCALE;
  expect(Math.min(...at.tips.map((t) => t.y))).toBeLessThan(equator + 0.02);
  expect(gap(at.fingers, p.solids[0])).toBeLessThan(0.005);
  expect(depth(at.all, p.solids[0])).toBeLessThan(0.001);
});

// 빈 곳: 펠트 근처까지 내려가 끝까지 오므리되, 오므리는 내내 손가락 끝이 펠트 아래로 들어가지 않는다 (최종 리뷰 M1)
test('an empty spot closes all the way without dipping into the felt', () => {
  const p = plan([], null);
  expect(p.open).toBe(0);
  expect(p.y).toBeLessThan(DOLL_FLOOR + 0.35);
  for (let t = 0; t <= p.descendOpen; t += 0.05) for (const tip of probesAt(0, p.y, 0, t).tips) expect(tip.y).toBeGreaterThan(DOLL_FLOOR);
});

test('a taller neighbour stops the descent', () => {
  const low = plan([['bear', 0, 0, 0, 0]], 0).y;
  const high = plan([['bear', 0, 0, 0, 0], ['bear', 0.04, 0.02, 0, 0.2]], 0).y;
  expect(high).toBeGreaterThan(low + 0.1);
});

// 빽빽한 무더기(서버 최소 간격 22cm): 손가락은 옆 인형을 눌러 비키게 하며 내려간다 — 옆 인형 위에서 멈추지 않는다
test('open fingers slide down past a close neighbour', () => {
  const alone = plan([['bear', 0, 0, 0, 0]], 0).y;
  const crowded = plan([['bear', 0, 0, 0, 0], ['bear', 0.22, 0, 0, 0]], 0).y;
  expect(crowded - alone).toBeLessThan(0.02);
});

test('a neighbour beside the target does not stop the fingers', () => {
  const alone = plan([['bear', 0, 0, 0, 0]], 0).open;
  const crowded = plan([['bear', 0, 0, 0, 0], ['cat', 0.3, 0, 0, 0]], 0).open;
  expect(crowded).toBeCloseTo(alone, 2);
});

// 들어 올릴 때 인형은 손가락에 닿아 있어야 한다: 잡은 뒤 틈이 있으면 그만큼 끌어당긴다 (사용자: "공중에서 잡았는데 안 맞네")
test('contact pull closes the gap between fingers and the grabbed doll', () => {
  const spots: DollSpot[] = [['bear', 0.12, 0, 0, 0]]; // 팔을 잡은 경우: 집게가 옆으로 비껴 내려왔다
  const p = plan(spots, 0);
  const at = probesAt(0, p.y, 0, p.open);
  const pull = contactPull(at.fingers, p.solids[0]);
  const moved = p.solids[0].map((h) => ({ c: h.c.clone().add(pull), r: h.r }));
  expect(Math.abs(gap(at.fingers, moved))).toBeLessThan(0.004);
});

// 결과마다(매장의 모든 기계) 부르므로 가벼워야 한다 — 예전엔 한 번에 17~21ms (최종 리뷰 I3)
test('planning a grab is cheap', () => {
  const spots: DollSpot[] = [['bear', 0, 0, 0, 0], ['cat', 0.22, 0, 1, 0], ['bunny', -0.22, 0, 2, 0], ['chick', 0, 0.22, 3, 0], ['penguin', 0, -0.22, 4, 0], ['fox', 0.11, 0.11, 5, 0.2]];
  const solids = solidsOf(spots);
  planGrip(0, 0, START, solids, 0);
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) planGrip(0.01 * i, 0, START, solids, 0);
  expect((performance.now() - t0) / 20).toBeLessThan(6);
});
