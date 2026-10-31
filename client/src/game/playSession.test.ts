import { expect, test } from 'vitest';
import { MACHINE_SPEC } from '../data/storeLayout';
import { PlaySession } from './playSession';

// 레버(조이스틱) 1개 + 하강 버튼 1개 (설계 2026-10-31 §3.10, 3차 결정): 집게는 상품 구멍 위에서 시작해 레버로 자유롭게 움직인다
test('the claw starts above the prize hole', () => {
  expect(new PlaySession('A-1', 20, 0).claw).toEqual({ x: MACHINE_SPEC.hole[0], z: MACHINE_SPEC.hole[1] });
});

test('the lever moves the claw freely at claw speed inside the play area', () => {
  const s = new PlaySession('A-1', 20, 0);
  const x0 = s.claw.x, z0 = s.claw.z;
  s.update(1, { x: 1, z: 0 }, 1); expect(s.claw.x).toBeCloseTo(x0 + MACHINE_SPEC.claw_speed);
  s.update(0.5, { x: 0, z: -1 }, 1.5); expect(s.claw.z).toBeCloseTo(z0 - MACHINE_SPEC.claw_speed * 0.5);
  s.update(1, { x: -1, z: 0 }, 2.5); expect(s.claw.x).toBeCloseTo(x0); // 되돌아갈 수도 있다
  s.update(10, { x: 1, z: 1 }, 3); expect(s.claw).toEqual({ x: MACHINE_SPEC.play_half[0], z: MACHINE_SPEC.play_half[1] });
});

test('drops once when time runs out', () => {
  const s = new PlaySession('A-1', 20, 0);
  expect(s.update(0.05, { x: 0, z: 0 }, 19.9)).toBeNull();
  expect(s.update(0.05, { x: 0, z: 0 }, 20.1)).toBe('drop');
  expect(s.update(0.05, { x: 0, z: 0 }, 20.3)).toBeNull();
  expect(s.requestDrop(20.3)).toBeNull();
});

// 느린 휴대폰(15fps)이나 숨긴 탭에서도 실제 시간으로 잰다 — 프레임 시간을 쌓으면 서버 마감(23초)을 넘긴다 (2단계 최종 리뷰 M2)
test('time runs on the wall clock, not on clamped frames', () => {
  const s = new PlaySession('A-1', 20, 100);
  expect(s.update(0.05, { x: 0, z: 0 }, 115)).toBeNull();
  expect(s.remaining).toBeCloseTo(5);
  expect(s.update(0.05, { x: 0, z: 0 }, 120.01)).toBe('drop');
});

test('pressing the drop button works once and stops the lever', () => {
  const s = new PlaySession('A-1', 20, 0);
  expect(s.requestDrop(3)).toBe('drop');
  expect(s.requestDrop(4)).toBeNull();
  const at = { ...s.claw };
  s.update(1, { x: 1, z: 0 }, 5);
  expect(s.claw).toEqual(at);
});

test('a result that never comes is given up after a while', () => {
  const s = new PlaySession('A-1', 20, 0);
  s.requestDrop(3);
  expect(s.resultOverdue(10)).toBe(false);
  expect(s.resultOverdue(11.5)).toBe(true);
});
