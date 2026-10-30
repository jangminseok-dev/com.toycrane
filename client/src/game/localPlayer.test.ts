import { expect, test } from 'vitest';
import { LocalPlayer } from './localPlayer';

test('tick moves along dir, correct snaps to server position', () => {
  const me = new LocalPlayer({ x: 0, z: 3 });
  me.dir = { x: 1, z: 0 };
  me.tick(0.5);
  expect(me.pos).toEqual({ x: 1.6, z: 3 });
  me.correct({ x: -2, z: 4 });
  expect(me.pos).toEqual({ x: -2, z: 4 });
});
