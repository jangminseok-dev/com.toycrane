import { expect, test } from 'vitest';
import { FIGURE } from '../data/figures';
import { FigureSession } from './figureSession';

// 9단계 피규어 버튼 ①② 판(설계 §3.3): ① 누르는 동안 오른쪽, 떼면 멈춤 → ② 누르는 동안 안쪽, 떼면 내려감. 버튼마다 한 번
const [HOME_X, HOME_Z] = FIGURE.claw.home;
const start = () => new FigureSession('F-1', 20, 0);

test('button one moves right only while held and hands over to two', () => {
  const s = start();
  expect(s.claw).toEqual({ x: HOME_X, z: HOME_Z });
  expect(s.press(1)).toBe(true);
  s.update(0.5, 0.5);
  expect(s.claw.x).toBeCloseTo(HOME_X + FIGURE.claw.speed * 0.5);
  expect(s.release(1, 0.5)).toBeNull();
  expect(s.phase).toBe('two');
  const x = s.claw.x;
  s.update(0.5, 1.0);
  expect(s.claw.x).toBe(x);
  expect(s.press(2)).toBe(true);
  s.update(0.4, 1.4);
  expect(s.claw.z).toBeCloseTo(HOME_Z - FIGURE.claw.speed * 0.4);
});

test('pressing two first does nothing', () => {
  const s = start();
  expect(s.press(2)).toBe(false);
  s.update(0.5, 0.5);
  expect(s.claw).toEqual({ x: HOME_X, z: HOME_Z });
  expect(s.phase).toBe('one');
});

test('each button works once', () => {
  const s = start();
  s.press(1); s.update(0.2, 0.2); s.release(1, 0.2);
  expect(s.press(1)).toBe(false);
  s.press(2); s.update(0.2, 0.4);
  expect(s.release(2, 0.4)).toBe('drop');
  expect(s.phase).toBe('cycle');
  expect(s.release(2, 0.5)).toBeNull();
  expect(s.press(2)).toBe(false);
});

test('time out drops where the claw is', () => {
  const s = start();
  s.press(1); s.update(0.3, 0.3);
  const x = s.claw.x;
  expect(s.update(0.1, 20.1)).toBe('drop');
  expect(s.claw.x).toBeCloseTo(x + FIGURE.claw.speed * 0.1);
  expect(s.update(0.1, 20.2)).toBeNull();
  expect(s.remaining(10)).toBe(10);
});

test('claw stops at the play edge', () => {
  const s = start();
  s.press(1);
  for (let t = 0.1; t < 10; t += 0.1) s.update(0.1, t / 10);
  expect(s.claw.x).toBeLessThanOrEqual(FIGURE.play_half[0]);
  s.release(1, 1); s.press(2);
  for (let t = 0.1; t < 10; t += 0.1) s.update(0.1, 1 + t / 10);
  expect(s.claw.z).toBeGreaterThanOrEqual(-FIGURE.play_half[1]);
});

// 결과 기다리기는 보고(done)를 보낸 때부터 센다 — 집게 한 바퀴는 8초를 넘기도 하니 그동안은 포기하지 않는다(인형 PlaySession과 같음)
test('waiting for the result counts from the report, not the drop', () => {
  const s = new FigureSession('F-1', 20, 0);
  s.requestDrop(1);
  expect(s.resultOverdue(12)).toBe(false);
  s.markDone(12);
  expect(s.resultOverdue(19)).toBe(false);
  expect(s.resultOverdue(20.5)).toBe(true);
});

// 집게 종류마다 벌린 팔이 기계 안에 머무는 반폭(halfX) — 쉬는 자리도 그 왼쪽 끝, 오른쪽으로도 거기까지(사용자 2026-11-02 사진 224)
test('the claw starts and stops where its open arms stay inside', () => {
  const s = new FigureSession('F-8', 20, 0, 0.27);
  expect(s.claw).toEqual({ x: -0.27, z: HOME_Z });
  s.press(1);
  for (let t = 0.1; t < 10; t += 0.1) s.update(0.1, t / 10);
  expect(s.claw.x).toBeCloseTo(0.27);
});
