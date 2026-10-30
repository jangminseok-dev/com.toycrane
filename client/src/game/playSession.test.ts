import { expect, test } from 'vitest';
import { PlaySession } from './playSession';

test('claw moves at claw speed and stays inside the play area', () => {
  const s = new PlaySession('A-1', 20);
  s.update(1, { x: 1, z: 0 }); expect(s.claw.x).toBeCloseTo(0.35);
  s.update(1, { x: 1, z: 0 }); expect(s.claw.x).toBeCloseTo(0.44);
});

test('drops once when time runs out', () => {
  const s = new PlaySession('A-1', 20);
  expect(s.update(19.9, { x: 0, z: 0 })).toBeNull();
  expect(s.update(0.2, { x: 0, z: 0 })).toBe('drop');
  expect(s.update(0.2, { x: 0, z: 0 })).toBeNull();
  expect(s.requestDrop()).toBeNull();
});

test('pressing drop works once', () => {
  const s = new PlaySession('A-1', 20);
  expect(s.requestDrop()).toBe('drop');
  expect(s.requestDrop()).toBeNull();
});
