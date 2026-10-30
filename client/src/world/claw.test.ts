import * as THREE from 'three';
import { expect, test } from 'vitest';
import { idleClawGeometry, makeClawRig } from './claw';

const spread = (rig: ReturnType<typeof makeClawRig>) => {
  rig.root.updateMatrixWorld(true);
  return Math.max(...rig.tips.map((t) => { const p = t.getWorldPosition(new THREE.Vector3()); return Math.hypot(p.x, p.z); }));
};

// 손가락 3개가 경첩에서 벌어졌다 오므라든다
test('opening the claw spreads the fingers', () => {
  const rig = makeClawRig();
  rig.setOpen(0); const closed = spread(rig);
  rig.setOpen(1); const open = spread(rig);
  expect(rig.tips).toHaveLength(3);
  expect(open).toBeGreaterThan(closed + 0.03);
});

// 줄 길이가 바뀌어도 맨 위(매달린 곳)는 제자리, 몸통이 내려간다
test('cable hangs from the top', () => {
  const rig = makeClawRig();
  rig.setCable(0.6);
  rig.root.updateMatrixWorld(true);
  expect(rig.grip.getWorldPosition(new THREE.Vector3()).y).toBeLessThan(-0.1);
});

test('idle claw is one shared geometry', () => {
  expect(idleClawGeometry()).toBe(idleClawGeometry());
  expect(idleClawGeometry().attributes.position.count).toBeGreaterThan(100);
});
