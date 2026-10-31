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

// 다 오므린 기준 자세(HUG)는 머리 위에 허브를 얹었을 때 서 있는 인형 머리를 닿지 않게 감싼다
test('the hug pose wraps a standing head without touching', () => {
  const rig = makeClawRig();
  rig.setOpen(rig.HUG); rig.root.updateMatrixWorld(true);
  const r = 0.34 * 0.3, hub = rig.probes[0].getWorldPosition(new THREE.Vector3());
  const head = new THREE.Vector3(0, hub.y - r - 0.003, 0);
  for (const p of rig.fingerProbes) expect(p.getWorldPosition(new THREE.Vector3()).distanceTo(head)).toBeGreaterThan(r + 0.003);
  const tips = rig.tips.map((t) => t.getWorldPosition(new THREE.Vector3()).y);
  expect(Math.max(...tips)).toBeLessThan(head.y); // 끝은 머리 가운데보다 아래
});
