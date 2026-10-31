import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { spot } from '../test/spots';
import { HEAD } from './dolls';
import { dollPose, headAt, solidsOf } from './dollPose';
import { DOLL_FLOOR, DOLL_SCALE } from './machine';

beforeAll(stubCanvas);

// 물리 뽑기 설계 §4.5: 앉은 인형은 서버가 기록한 자리·돌림 그대로
test('a settled doll is drawn exactly at its recorded pose', () => {
  const lying = spot('bear', 0.12, -0.08, 0, 0.11);
  lying[4] = 0.70711; lying[7] = 0.70711; // x축 90°로 누움
  const { position, quaternion, provisional } = dollPose(lying);
  expect(provisional).toBe(false);
  expect([position.x, position.y, position.z]).toEqual([0.12, DOLL_FLOOR + 0.11, -0.08]);
  expect(quaternion.x).toBeCloseTo(0.70711);
  const head = new THREE.Vector3(0, HEAD.standing.c * DOLL_SCALE, 0).applyQuaternion(quaternion);
  expect(Math.abs(head.z)).toBeGreaterThan(0.2); // 누웠으니 머리는 옆으로
});

// §9.2: 아직 안 앉은 인형(y null)은 바닥에 선 임시 자세, 앉은 인형 머리 위라면 그 위에
test('an unsettled doll stands provisionally on the floor or on a settled doll below it', () => {
  const alone = dollPose(spot('bear', 0.1, 0.1, 0, null));
  expect(alone.provisional).toBe(true);
  expect(alone.position.y).toBe(DOLL_FLOOR);
  const under = spot('bear', 0.1, 0.1, 0, 0);
  const above = spot('cat', 0.15, 0.12, 0, null);
  expect(dollPose(above, [under, above]).position.y).toBeCloseTo(DOLL_FLOOR + 0.33);
});

test('solid spheres and the head follow the pose', () => {
  const s = spot('bear', 0.1, 0.05, 0.4, 0);
  const [[, head]] = solidsOf([s]);
  expect(head.c.x).toBeCloseTo(0.1, 6);
  expect(head.c.z).toBeCloseTo(0.05, 6);
  expect(head.r).toBeCloseTo(0.34 * DOLL_SCALE, 6);
  expect(headAt(s).y).toBeCloseTo(DOLL_FLOOR + HEAD.standing.c * DOLL_SCALE, 6);
});

// 화면의 집게 잡기(손가락이 닿는 공)도 체형 폭을 따른다 (설계 2026-10-31 인형 채우기 §4.5), 희귀·황금은 왕관 공까지
test('the claw feels chubby dolls wider and crowns on rare ones', () => {
  const [[, plainHead]] = solidsOf([spot('bear', 0, 0, 0, 0)]);
  const [[, chubbyHead]] = solidsOf([spot('bear', 0, 0, 0, 0, { body: 'c' })]);
  expect(chubbyHead.r).toBeGreaterThan(plainHead.r * 1.1);
  expect(solidsOf([spot('bear', 0, 0, 0, 0, { rare: 'gold' })])[0].some((h) => h.part === 'crown')).toBe(true);
});
