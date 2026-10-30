import { expect, test } from 'vitest';
import { MachineBusy } from './machineBusy';

// 남이 하는 기계: 그 판이 끝날 시간(20초 + 여유 3초)이 지나면 버튼을 다시 보여 서버의 만료 인수가 동작하게 (최종 리뷰 I3)
test('busy machine frees itself after the round time runs out', () => {
  const b = new MachineBusy(20);
  b.set('A-1', 'p1', 100);
  expect(b.who('A-1', 110)).toBe('p1');
  expect(b.who('A-1', 123.5)).toBeNull();
});

test('a leaving player clears their machine', () => {
  const b = new MachineBusy(20);
  b.set('A-1', 'p1', 100); b.set('A-2', 'p2', 100);
  b.clearPlayer('p1');
  expect(b.who('A-1', 101)).toBeNull();
  expect(b.who('A-2', 101)).toBe('p2');
});
