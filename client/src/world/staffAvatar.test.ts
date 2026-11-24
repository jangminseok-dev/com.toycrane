import { expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { makeAvatar } from './avatar';
import { makeStaffAvatar } from './staffAvatar';

stubCanvas();
// 상주 직원(설계 2026-11-24): 손님과 같은 몸에 모자·목줄·명찰을 더하고 가방은 없다
test('staff avatar wears the uniform and carries no bag', () => {
  const staff = makeStaffAvatar(), guest = makeAvatar(7, '손님');
  expect(staff.rig.backpack.visible).toBe(false);
  expect(staff.rig.bob.children.length).toBeGreaterThan(guest.rig.bob.children.length + 5);
});
