import { expect, test } from 'vitest';
import { QueueClient } from './queueClient';

test('walks to my place in line', () => {
  const q = new QueueClient(); q.onQueue(0, ['p9', 'me'], 'me', 0);
  expect(q.target()).toEqual({ x: -3.65, z: -2.6 });
  expect(q.status(0)).toEqual({ kind: 'waiting', place: 2 });
});

test('walking off the line unqueues once', () => {
  const q = new QueueClient(); q.onQueue(0, ['me'], 'me', 0);
  expect(q.tick({ x: -2.9, z: -0.8 }, 1)).toBe('unqueue');
  expect(q.tick({ x: -2.9, z: -0.8 }, 2)).toBeNull();
});

test('take is sent two seconds after reaching the window at the head', () => {
  const q = new QueueClient(); q.onQueue(0, ['me'], 'me', 10);
  expect(q.tick({ x: -2.9, z: -2.6 }, 11.9)).toBeNull();
  expect(q.tick({ x: -2.9, z: -2.6 }, 12.05)).toBe('take');
  expect(q.tick({ x: -2.9, z: -2.6 }, 12.5)).toBeNull();
});

test('offers the line only near its open end and not while queued', () => {
  const q = new QueueClient();
  q.onQueue(0, ['a', 'b'], 'me', 0);
  expect(q.entryNear({ x: -4.4, z: -2.0 })).toBe(0); // 세 번째 빈자리 근처
  expect(q.entryNear({ x: 0, z: 6 })).toBeNull();
  q.onQueue(0, ['a', 'b', 'me'], 'me', 1);
  expect(q.entryNear({ x: -4.4, z: -2.0 })).toBeNull();
});

test('dropping out of the server line resets me', () => {
  const q = new QueueClient(); q.onQueue(1, ['me'], 'me', 0);
  q.onQueue(1, [], 'me', 5);
  expect(q.target()).toBeNull();
  expect(q.status(5)).toEqual({ kind: 'none' });
});

// 둘만 있는 줄에서 맨 앞이 8초 넘게 멈추면 서버는 다음 메시지가 와야 알 수 있다 — 2번째가 8.5초 뒤 한 번 다시 묻는다 (최종 리뷰 I4)
test('second in line asks again once when the head stalls', () => {
  const q = new QueueClient(); q.onQueue(0, ['p9', 'me'], 'me', 10);
  const slot = { x: -3.65, z: -2.6 };
  expect(q.tick(slot, 18.4)).toBeNull();
  expect(q.tick(slot, 18.6)).toBe('requeue');
  expect(q.tick(slot, 19)).toBeNull();
  q.onQueue(0, ['p8', 'me'], 'me', 19); // 맨 앞이 바뀌면 다시 센다
  expect(q.tick(slot, 27.6)).toBe('requeue');
});
