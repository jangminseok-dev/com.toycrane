import { expect, test } from 'vitest';
import { watchersOf } from './watchers';

// 내 판을 보고 있는 사람(사용자 2026-11-03 '누군가 보고 있다고만 느끼게'): 내 자리에서 3m 안, 자기 판을 하는 사람은 빼고
test('people within three metres who are not playing are watching', () => {
  const people = [{ id: 'a', x: 2, z: 0 }, { id: 'b', x: 0, z: 3.4 }, { id: 'c', x: -1, z: 1 }];
  expect(watchersOf([], { x: 0, z: 0 }, people, new Set())).toEqual(['a', 'c']);
  expect(watchersOf([], { x: 0, z: 0 }, people, new Set(['c']))).toEqual(['a']);
});

// 먼저 온 사람이 앞에 — 새로 온 사람은 뒤에 붙고 떠난 사람만 빠진다(얼굴이 자리를 바꾸지 않게)
test('watchers keep the order they arrived in', () => {
  const at = { x: 0, z: 0 };
  expect(watchersOf(['c', 'a'], at, [{ id: 'a', x: 1, z: 0 }, { id: 'b', x: 0, z: 1 }, { id: 'c', x: 2, z: 0 }], new Set())).toEqual(['c', 'a', 'b']);
  expect(watchersOf(['c', 'a', 'b'], at, [{ id: 'a', x: 1, z: 0 }, { id: 'b', x: 0, z: 1 }, { id: 'c', x: 9, z: 0 }], new Set())).toEqual(['a', 'b']);
});

// 3m 언저리에 선 사람이 얼굴을 깜빡이지 않게: 들어올 땐 3m, 나갈 땐 3.5m 넘어서
test('a watcher at the edge does not flicker in and out', () => {
  const at = { x: 0, z: 0 }, edge = [{ id: 'a', x: 3.3, z: 0 }];
  expect(watchersOf([], at, edge, new Set())).toEqual([]);
  expect(watchersOf(['a'], at, edge, new Set())).toEqual(['a']);
  expect(watchersOf(['a'], at, [{ id: 'a', x: 3.6, z: 0 }], new Set())).toEqual([]);
});
