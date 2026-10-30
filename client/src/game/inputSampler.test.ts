import { expect, test } from 'vitest';
import { InputSampler } from './inputSampler';

test('sampler: idle sends nothing, start/turn/stop send, same dir waits 3s', () => {
  const s = new InputSampler();
  expect(s.shouldSend({ x: 0, z: 0 }, 0)).toBe(false);
  expect(s.shouldSend({ x: 1, z: 0 }, 100)).toBe(true);
  expect(s.shouldSend({ x: 0.99, z: 0.05 }, 200)).toBe(false); // 같은 방위
  expect(s.shouldSend({ x: 1, z: 0 }, 3099)).toBe(false);
  expect(s.shouldSend({ x: 1, z: 0 }, 3100)).toBe(true); // 3초 보정
  expect(s.shouldSend({ x: 0, z: 1 }, 3200)).toBe(true); // 방향 바뀜
  expect(s.shouldSend({ x: 0, z: 0 }, 3300)).toBe(true); // 멈춤
});
