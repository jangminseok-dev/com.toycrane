import { expect, test } from 'vitest';
import { clampToFloor, step } from './movement';

test('step walks at 3.2m/s', () => expect(step({ x: 0, z: 3 }, { x: 1, z: 0 }, 0.5)).toEqual({ x: 1.6, z: 3 }));
test('clamps to floor edge', () => expect(clampToFloor({ x: 13, z: -20 })).toEqual({ x: 12.6, z: -12.6 }));
test('pushes out of tower', () => expect(clampToFloor({ x: 0.5, z: 1.0 })).toEqual({ x: 0.5, z: 1.3 }));
