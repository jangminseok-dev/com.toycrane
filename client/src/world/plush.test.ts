import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { contactPull, planGrip, probesAt } from '../game/gripPlan';
import { stubCanvas } from '../test/canvasStub';
import { solidsOf } from './dollPose';
import { CLAW_REST } from './machine';
import { pushAway, squeezeAboutTop, type Yielding } from './plush';

beforeAll(stubCanvas);

// 쥘 때 말랑하게 눌려도 머리 꼭대기는 제자리 — 발 기준으로 늘리면 머리가 허브 속으로 들어간다 (최종 리뷰 I1)
test('squeezing keeps the head top in place', () => {
  const doll = new THREE.Object3D();
  doll.position.set(0.1, 0.87, -0.05); doll.quaternion.setFromEuler(new THREE.Euler(0.3, 1, 0.1)); doll.scale.setScalar(0.3);
  const rest = { position: doll.position.clone(), quaternion: doll.quaternion.clone(), scale: 0.3 };
  const top = () => { doll.updateMatrixWorld(true); return doll.localToWorld(new THREE.Vector3(0, 1.08, 0)); };
  const before = top();
  squeezeAboutTop(doll, rest, 1.08, 0.04);
  expect(top().distanceTo(before)).toBeLessThan(1e-6);
  expect(doll.scale.x).toBeLessThan(0.3);
});

// 옆 인형은 말랑해서 손가락에 밀려 비켜 주고(손가락이 속으로 들어가 보이지 않게), 집게가 떠나면 제자리로 (최종 리뷰 I2)
test('a neighbour pressed by fingers yields and springs back', () => {
  // 집게가 머리 가운데에서 이웃 쪽으로 5cm 비껴 내려왔다(서버 '머리' 판정 안) — 실제 무더기에서 흔한 경우
  const spots: Parameters<typeof solidsOf>[0] = [['bear', 0, 0, 0, 0], ['bear', 0.22, 0, 1.2, 0]];
  const solids = solidsOf(spots);
  const p = planGrip(0.05, 0, CLAW_REST.y, solids, 0);
  const doll = new THREE.Object3D();
  const n: Yielding = { doll, base: new THREE.Vector3(), hits: solids[1], offset: new THREE.Vector3() };
  const fingers = probesAt(0.05, p.y, 0, p.descendOpen).fingers; // 가장 깊이 누르는 때: 다 내려와서 아직 벌린 채
  expect(Math.max(...fingers.flatMap((f) => n.hits.map((h) => h.r - f.distanceTo(h.c))))).toBeGreaterThan(0.01); // 밀기 전엔 손가락이 속으로 들어가 있다
  for (let i = 0; i < 60; i++) pushAway([n], fingers, 1 / 60);
  const deepest = Math.max(0, ...fingers.flatMap((f) => n.hits.map((h) => h.r - f.distanceTo(h.c.clone().add(n.offset)))));
  expect(deepest).toBeLessThan(0.003);
  expect(doll.position.length()).toBeGreaterThan(0.005);
  for (let i = 0; i < 180; i++) pushAway([n], [], 1 / 60);
  expect(n.offset.length()).toBeLessThan(0.002);
});

test('contact pull is zero when the fingers already touch', () => {
  const solids = solidsOf([['bear', 0, 0, 0, 0]]);
  const p = planGrip(0, 0, CLAW_REST.y, solids, 0);
  expect(contactPull(probesAt(0, p.y, 0, p.open).fingers, solids[0]).length()).toBeLessThan(0.004);
});
