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

// 조르는 사람 이름표 옆 꼬리표 '조르는 중' — 붙였다 떼면 GPU 자원도 돌려준다
test('a tag can be added under the name and removed', () => {
  const a = makeAvatar(0, '토끼');
  a.setTag('조르는 중');
  expect(a.root.getObjectByName('tag')).toBeDefined();
  a.setTag(null);
  expect(a.root.getObjectByName('tag')).toBeUndefined();
});
