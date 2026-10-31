import { expect, test } from 'vitest';
import { MACHINE_SPEC } from '../data/storeLayout';
import { PlaySession } from './playSession';

// 일본식 버튼 두 개 (설계 2026-10-31 §3.10): 집게는 상품 구멍 위(앞 왼쪽)에서 시작한다
test('the claw starts above the prize hole', () => {
  const s = new PlaySession('A-1', 20, 0);
  expect(s.claw).toEqual({ x: MACHINE_SPEC.hole[0], z: MACHINE_SPEC.hole[1] });
  expect(s.phase).toBe('one');
});

test('button one moves right only while held and only once', () => {
  const s = new PlaySession('A-1', 20, 0);
  const x0 = s.claw.x;
  s.update(1, 1); expect(s.claw.x).toBe(x0); // 누르기 전엔 그대로
  s.press(1); s.update(1, 2);
  expect(s.claw.x).toBeCloseTo(x0 + MACHINE_SPEC.claw_speed);
  s.release(1, 2); s.update(1, 3);
  expect(s.claw.x).toBeCloseTo(x0 + MACHINE_SPEC.claw_speed); // 떼면 멈춘다
  expect(s.phase).toBe('two');
  s.press(1); s.update(1, 4);
  expect(s.claw.x).toBeCloseTo(x0 + MACHINE_SPEC.claw_speed); // 다시 누를 수 없다
});

test('button two moves back while held and letting go drops', () => {
  const s = new PlaySession('A-1', 20, 0);
  s.press(1); s.update(0.5, 0.5); s.release(1, 0.5);
  const z0 = s.claw.z;
  s.press(2); s.update(0.5, 1);
  expect(s.claw.z).toBeCloseTo(z0 - MACHINE_SPEC.claw_speed * 0.5); // 안쪽(-z)
  expect(s.release(2, 1.1)).toBe('drop');
  expect(s.phase).toBe('done');
  expect(s.release(2, 1.2)).toBeNull();
});

test('button two does nothing before button one', () => {
  const s = new PlaySession('A-1', 20, 0);
  const at = { ...s.claw };
  s.press(2); s.update(1, 1);
  expect(s.claw).toEqual(at);
  expect(s.release(2, 1)).toBeNull();
  expect(s.phase).toBe('one');
});

test('the claw stops at the edge of the play area', () => {
  const s = new PlaySession('A-1', 20, 0);
  s.press(1); s.update(10, 10);
  expect(s.claw.x).toBeCloseTo(MACHINE_SPEC.play_half[0]);
});

test('drops where the claw is when time runs out', () => {
  const s = new PlaySession('A-1', 20, 0);
  s.press(1);
  expect(s.update(0.05, 19.9)).toBeNull();
  expect(s.update(0.05, 20.1)).toBe('drop');
  expect(s.update(0.05, 20.3)).toBeNull();
  expect(s.phase).toBe('done');
});

// 느린 휴대폰(15fps)이나 숨긴 탭에서도 실제 시간으로 잰다 — 프레임 시간을 쌓으면 서버 마감(23초)을 넘긴다 (2단계 최종 리뷰 M2)
test('time runs on the wall clock, not on clamped frames', () => {
  const s = new PlaySession('A-1', 20, 100);
  expect(s.update(0.05, 115)).toBeNull();
  expect(s.remaining).toBeCloseTo(5);
  expect(s.update(0.05, 120.01)).toBe('drop');
});

test('a result that never comes is given up after a while', () => {
  const s = new PlaySession('A-1', 20, 0);
  s.press(1); s.release(1, 1); s.press(2);
  s.release(2, 3);
  expect(s.resultOverdue(10)).toBe(false);
  expect(s.resultOverdue(11.5)).toBe(true);
});
