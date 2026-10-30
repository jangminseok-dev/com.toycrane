import { expect, test } from 'vitest';
import { extrapolate } from './remote';

test('extrapolate', () => expect(extrapolate({ pos: { x: 0, z: 3 }, dir: { x: 1, z: 0 }, receivedAt: 1000 }, 1500)).toEqual({ x: 1.6, z: 3 }));

test('extrapolate stops at the floor edge', () =>
  expect(extrapolate({ pos: { x: 12, z: 0 }, dir: { x: 1, z: 0 }, receivedAt: 0 }, 5000)).toEqual({ x: 12.6, z: 0 }));
