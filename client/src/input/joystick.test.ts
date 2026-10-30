import { expect, test } from 'vitest';
import { joystickVector } from './joystick';

test('joystick dead zone and saturation', () => {
  expect(joystickVector({ x: 0, z: 0 }, { x: 5, z: 0 }, 50)).toEqual({ x: 0, z: 0 });
  expect(joystickVector({ x: 0, z: 0 }, { x: 100, z: 0 }, 50)).toEqual({ x: 1, z: 0 });
});

test('joystick inside radius is proportional', () => {
  expect(joystickVector({ x: 10, z: 10 }, { x: 10, z: 35 }, 50)).toEqual({ x: 0, z: 0.5 });
});
