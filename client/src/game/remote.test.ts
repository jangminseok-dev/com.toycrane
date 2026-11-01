import { expect, test } from 'vitest';
import { extrapolate, isMoving } from './remote';

test('extrapolate', () => expect(extrapolate({ pos: { x: 0, z: 3 }, dir: { x: 1, z: 0 }, receivedAt: 1000 }, 1500)).toEqual({ x: 1.6, z: 3 }));

// z=-6: 벽 앞 "준비 중" 장식(z -4.6~11.6) 아래쪽의 빈 바닥 가장자리
test('extrapolate stops at the floor edge', () =>
  expect(extrapolate({ pos: { x: 20, z: 12 }, dir: { x: 1, z: 0 }, receivedAt: 0 }, 5000)).toEqual({ x: 21.6, z: 12 })); // 큰 홀 동쪽 벽 앞 빈 바닥

// 걷다가 탭을 내리거나 연결이 멈추면 멈춤 메시지가 안 온다 → 3.5초 넘게 소식이 없으면 멈춘 것으로 본다 (최종 리뷰 #5)
test('extrapolation is capped at 3.5s', () => {
  const p = extrapolate({ pos: { x: 0, z: 3 }, dir: { x: 1, z: 0 }, receivedAt: 0 }, 10_000);
  expect(p.x).toBeCloseTo(11.2);
  expect(p.z).toBe(3);
});

test('isMoving stops after 3.5s of silence', () => {
  const s = { pos: { x: 0, z: 0 }, dir: { x: 1, z: 0 }, receivedAt: 1000 };
  expect(isMoving(s, 4500)).toBe(true);
  expect(isMoving(s, 4501)).toBe(false);
  expect(isMoving({ ...s, dir: { x: 0, z: 0 } }, 1000)).toBe(false);
});
