import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { CONTROLS } from './machine';
import { buildMachineControls } from './machineControls';

beforeAll(stubCanvas);

// 기계에 그려진 레버·하강 버튼을 직접 누른다 (설계 2026-10-31 §3.10, 3차): 휴대폰 손가락을 위해 그림보다 넉넉하게
function pickAt(controls: ReturnType<typeof buildMachineControls>, anchor: THREE.Object3D, local: readonly [number, number, number], dx = 0) {
  anchor.updateMatrixWorld(true);
  const p = anchor.localToWorld(new THREE.Vector3(local[0] + dx, local[1], local[2]));
  const ray = new THREE.Raycaster(p.clone().add(new THREE.Vector3(0, 1, 0.6)), new THREE.Vector3(0, -1, -0.6).normalize());
  return controls.pick(ray);
}

test('pressing on the lever or the drop button picks it, with a roomy touch area', () => {
  const anchor = new THREE.Group(); anchor.position.set(3, 0, -6); anchor.rotation.y = Math.PI;
  const controls = buildMachineControls(anchor);
  expect(pickAt(controls, anchor, CONTROLS.lever)).toBe('lever');
  expect(pickAt(controls, anchor, CONTROLS.drop)).toBe('drop');
  expect(pickAt(controls, anchor, CONTROLS.drop, 0.08)).toBe('drop'); // 버튼 가장자리 바깥 8cm도
  expect(pickAt(controls, anchor, CONTROLS.lever, -0.1)).toBe('lever');
});

test('the lever tilts where it is pushed and the drop button sinks when pressed', () => {
  const anchor = new THREE.Group();
  const controls = buildMachineControls(anchor);
  controls.setLever(1, 0);
  expect(Math.abs(controls.leverTilt().z)).toBeGreaterThan(0.2);
  const y0 = controls.dropY();
  controls.setPressed(true);
  expect(controls.dropY()).toBeLessThan(y0);
  controls.dispose();
  expect(anchor.children).toHaveLength(0);
});

// 하강 버튼이 무엇을 하는지 바로 알게: 윗면에 '잡기'와 흰 아래 화살표, 버튼과 함께 눌려 들어간다
test('the drop button reads 잡기 with a down arrow and sinks with the button', () => {
  const anchor = new THREE.Group();
  const controls = buildMachineControls(anchor);
  const label = anchor.getObjectByName('drop-label')!;
  expect(label.userData.text).toBe('잡기');
  anchor.updateMatrixWorld(true);
  const y0 = label.getWorldPosition(new THREE.Vector3()).y;
  controls.setPressed(true); anchor.updateMatrixWorld(true);
  expect(label.getWorldPosition(new THREE.Vector3()).y).toBeLessThan(y0 - 0.01);
});
