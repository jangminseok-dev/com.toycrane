import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { makeAvatar } from './avatar';

beforeAll(stubCanvas);

test('avatar exposes a rig for motions', () => {
  const a = makeAvatar(0, '토끼');
  expect(a.rig.head).toBeDefined();
  expect(a.rig.held).toBeNull();
  expect(a.rig.handR.x).toBeCloseTo(0.52);
});
