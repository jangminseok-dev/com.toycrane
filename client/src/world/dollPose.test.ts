import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import type { DollSpot } from '../net/protocol';
import { stubCanvas } from '../test/canvasStub';
import { HEAD } from './dolls';
import { dollPose, solidsOf } from './dollPose';
import { DOLL_FLOOR, DOLL_SCALE } from './machine';
import { spot } from '../test/spots';

beforeAll(stubCanvas);

// 서버는 인형 자리(x,z)에서 평면 거리로 부위를 고른다 — 기울어도 머리 가운데가 그 자리 위에 오게 놓아야
// "머리 판정 = 화면에서 머리"가 된다 (설계 2026-10-31 §4.8)
test('a leaning stacked doll keeps its head right above its spot', () => {
  const leaning: DollSpot = spot('bear', 0.12, -0.08, 2.1, 0.2);
  const { position, quaternion } = dollPose(leaning);
  const head = new THREE.Vector3(0, HEAD.standing.c * DOLL_SCALE, 0).applyQuaternion(quaternion).add(position);
  expect(head.x).toBeCloseTo(0.12, 6);
  expect(head.z).toBeCloseTo(-0.08, 6);
  expect(position.y).toBeCloseTo(DOLL_FLOOR + 0.2, 6);
});

test('solid spheres sit where the doll is drawn', () => {
  const [[, head]] = solidsOf([spot('bear', 0.1, 0.05, 0.4, 0)]);
  expect(head.c.x).toBeCloseTo(0.1, 6);
  expect(head.c.z).toBeCloseTo(0.05, 6);
  expect(head.r).toBeCloseTo(0.34 * DOLL_SCALE, 6);
});

// 화면의 집게 잡기(손가락이 닿는 공)도 체형 폭을 따른다 (설계 2026-10-31 인형 채우기 §4.5), 희귀·황금은 왕관 공까지
test('the claw feels chubby dolls wider and crowns on rare ones', () => {
  const [[, plainHead]] = solidsOf([spot('bear', 0, 0, 0, 0)]);
  const [[, chubbyHead]] = solidsOf([spot('bear', 0, 0, 0, 0, { body: 'c' })]);
  expect(chubbyHead.r).toBeGreaterThan(plainHead.r * 1.1);
  expect(solidsOf([spot('bear', 0, 0, 0, 0, { rare: 'gold' })])[0].some((h) => h.part === 'crown')).toBe(true);
});
