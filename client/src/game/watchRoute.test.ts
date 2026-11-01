import { expect, test } from 'vitest';
import { watchKind } from './watchRoute';

// 남이 판을 시작하면 그 기계 종류에 맞는 구경으로 — 인형 기계 구경(무더기)을 다른 기계에 걸면 예외로 화면이 멈췄다(최종 리뷰 Review Focus 5)
test('a play on a non-doll machine does not start a doll watch', () => {
  expect(watchKind('A-1')).toBe('doll');
  expect(watchKind('C-11')).toBe('doll');
  expect(watchKind('F-3')).toBe('box');
  expect(watchKind('R-1')).toBe('box');
  expect(watchKind('P-2')).toBe('pusher');
  expect(watchKind('X-9')).toBeNull();
});
