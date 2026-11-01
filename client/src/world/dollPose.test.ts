import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { spot } from '../test/spots';
import { headOf } from './dolls';
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
  const head = new THREE.Vector3(0, headOf('bear').c * DOLL_SCALE, 0).applyQuaternion(quaternion);
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
  const head = solidsOf([s])[0].reduce((a, h) => (h.r > a.r ? h : a)); // 가장 큰 공 = 머리 (인형 리뉴얼: 머리가 몸보다 크다)
  expect(head.c.x).toBeCloseTo(0.1, 6);
  expect(head.c.z).toBeCloseTo(0.05, 6);
  expect(head.r).toBeGreaterThan(0.25 * DOLL_SCALE);
  expect(headAt(s).y).toBeCloseTo(DOLL_FLOOR + headOf('bear').c * DOLL_SCALE, 6);
});

// 화면의 집게 잡기(손가락이 닿는 공)도 체형 폭을 따른다 (설계 2026-10-31 인형 채우기 §4.5), 희귀·황금은 왕관 공까지
test('the claw feels chubby dolls wider and crowns on rare ones', () => {
  const biggest = (hs: { r: number }[]) => hs.reduce((a, h) => (h.r > a.r ? h : a));
  const plainHead = biggest(solidsOf([spot('bear', 0, 0, 0, 0)])[0]);
  const chubbyHead = biggest(solidsOf([spot('bear', 0, 0, 0, 0, { body: 'c' })])[0]);
  expect(chubbyHead.r).toBeGreaterThan(plainHead.r * 1.1);
  expect(solidsOf([spot('bear', 0, 0, 0, 0, { rare: 'gold' })])[0].some((h) => h.part === 'crown')).toBe(true);
});

// 천장 아래에 '앉은' 자리로 저장된 인형(앉히기 끝 직전 구멍에 빠져 옮겨진 채 굳은 것, 라이브 C-4·C-7 1.85m)은 안 앉은 인형으로 다시 앉힌다
test('a doll saved hanging near the ceiling is treated as not settled', async () => {
  const { grounded } = await import('./dollPose');
  const high = spot('dino', 0.44, -0.41, 0, 0.98), low = spot('dino', 0, 0, 0, 0.3);
  expect(grounded(high)[2]).toBeNull();
  expect(grounded(high)[12]).toBe(high[12]);
  expect(grounded(low)).toBe(low);
});
