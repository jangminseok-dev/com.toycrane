import * as THREE from 'three';
import { expect, test } from 'vitest';
import { CONTROLS } from './machine';
import { buildMachineControls } from './machineControls';

// 기계에 그려진 버튼을 직접 누른다 (설계 2026-10-31 §3.10): 버튼 위를 누르면 그 버튼, 휴대폰 손가락을 위해 그림보다 넉넉하게
function pickAt(controls: ReturnType<typeof buildMachineControls>, anchor: THREE.Object3D, local: readonly [number, number, number], dx = 0) {
  anchor.updateMatrixWorld(true);
  const p = anchor.localToWorld(new THREE.Vector3(local[0] + dx, local[1], local[2]));
  const ray = new THREE.Raycaster(p.clone().add(new THREE.Vector3(0, 1, 0.6)), new THREE.Vector3(0, -1, -0.6).normalize());
  return controls.pick(ray);
}

test('pressing on a machine button picks that button, with a roomy touch area', () => {
  const anchor = new THREE.Group(); anchor.position.set(3, 0, -6); anchor.rotation.y = Math.PI;
  const controls = buildMachineControls(anchor);
  expect(pickAt(controls, anchor, CONTROLS.one)).toBe(1);
  expect(pickAt(controls, anchor, CONTROLS.two)).toBe(2);
  expect(pickAt(controls, anchor, CONTROLS.two, 0.06)).toBe(2); // 버튼 가장자리 바깥 6cm도
  expect(pickAt(controls, anchor, CONTROLS.lever)).toBeNull();
});

test('the button to press now glows and a held button sinks', () => {
  const anchor = new THREE.Group();
  const controls = buildMachineControls(anchor);
  controls.setPhase('one');
  expect(controls.glow(1)).toBeGreaterThan(controls.glow(2));
  controls.setPhase('two');
  expect(controls.glow(2)).toBeGreaterThan(controls.glow(1));
  const y0 = controls.domeY(2);
  controls.setPressed(2);
  expect(controls.domeY(2)).toBeLessThan(y0);
  controls.dispose();
  expect(anchor.children).toHaveLength(0);
});
