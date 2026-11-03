import { expect, test } from 'vitest';
import { peekSlots } from './peekFaces';

// 구경하는 사람 얼굴은 먼저 온 3명까지, 나머지는 '+N' 하나로 (사용자 2026-11-03 그림 B)
test('up to three faces show and the rest become one count', () => {
  expect(peekSlots(['a', 'b'])).toEqual({ shown: ['a', 'b'], more: 0 });
  expect(peekSlots(['a', 'b', 'c'])).toEqual({ shown: ['a', 'b', 'c'], more: 0 });
  expect(peekSlots(['a', 'b', 'c', 'd', 'e'])).toEqual({ shown: ['a', 'b', 'c'], more: 2 });
});
