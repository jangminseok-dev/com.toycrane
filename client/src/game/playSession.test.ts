import { expect, test } from 'vitest';
import { PlaySession } from './playSession';

test('claw moves at claw speed and stays inside the play area', () => {
  const s = new PlaySession('A-1', 20, 0);
  s.update(1, { x: 1, z: 0 }, 1); expect(s.claw.x).toBeCloseTo(0.35);
  s.update(1, { x: 1, z: 0 }, 2); expect(s.claw.x).toBeCloseTo(0.44);
});

test('drops once when time runs out', () => {
  const s = new PlaySession('A-1', 20, 0);
  expect(s.update(0.05, { x: 0, z: 0 }, 19.9)).toBeNull();
  expect(s.update(0.05, { x: 0, z: 0 }, 20.1)).toBe('drop');
  expect(s.update(0.05, { x: 0, z: 0 }, 20.3)).toBeNull();
  expect(s.requestDrop(20.3)).toBeNull();
});

// 느린 휴대폰(15fps)이나 숨긴 탭에서도 실제 시간으로 잰다 — 프레임 시간을 쌓으면 화면 20초가 실제 27초가 되어 서버 마감(23초)을 넘긴다 (최종 리뷰 M2)
test('time runs on the wall clock, not on clamped frames', () => {
  const s = new PlaySession('A-1', 20, 100);
  expect(s.update(0.05, { x: 0, z: 0 }, 115)).toBeNull();
  expect(s.remaining).toBeCloseTo(5);
  expect(s.update(0.05, { x: 0, z: 0 }, 120.01)).toBe('drop');
});

test('pressing drop works once', () => {
  const s = new PlaySession('A-1', 20, 0);
  expect(s.requestDrop(3)).toBe('drop');
  expect(s.requestDrop(4)).toBeNull();
});

// 서버가 결과도 free도 못 보내면(D1 한도 등) 기계 화면에 갇히지 않게 8초 뒤 포기 (최종 리뷰 M3)
test('waiting for the result gives up after 8 seconds', () => {
  const s = new PlaySession('A-1', 20, 0);
  expect(s.resultOverdue(5)).toBe(false); // 아직 안 내림
  s.requestDrop(5);
  expect(s.resultOverdue(12.9)).toBe(false);
  expect(s.resultOverdue(13.1)).toBe(true);
});
