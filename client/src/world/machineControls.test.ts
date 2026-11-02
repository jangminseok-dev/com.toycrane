import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { CONTROLS, makeControlParts } from './machine';
import { buildBigZone } from './bigZone';
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

// 겨냥 고리는 인형에 가려도 보이게 깊이를 무시하고 그린다. 그 뒤에 레버·버튼을 그려야, 집게가 앞쪽(상품 구멍 근처)에 있을 때
// 고리가 레버 공 위에 겹쳐 잔상처럼 보이지 않는다 (2026-10-31 사용자 보고)
test('the live lever and button are drawn after the aim ring so the ring never shows over them', () => {
  const zone = buildBigZone(new THREE.Scene());
  const aim = zone.clawOf('C-6').getObjectByName('aim') as THREE.Mesh;
  buildMachineControls(zone.worldOf('C-6'));
  expect((aim.material as THREE.Material).transparent).toBe(false); // 불투명 목록은 renderOrder 순서대로 그린다
  const drawn: THREE.Mesh[] = [];
  zone.worldOf('C-6').getObjectByName('live-controls')!.traverse((o) => { if ((o as THREE.Mesh).isMesh) drawn.push(o as THREE.Mesh); });
  expect(drawn.length).toBeGreaterThan(3);
  for (const m of drawn) expect(m.renderOrder).toBeGreaterThan(aim.renderOrder);
});

// '잡기' 글씨가 버튼 윗면 밖으로 삐져나가지 않는다 — 글씨 판이 윗면 지름의 80% 안 (사용자 화면 2026-10-31)
test('the drop label fits inside the button top', () => {
  const anchor = new THREE.Group();
  buildMachineControls(anchor);
  const label = anchor.getObjectByName('drop-label') as THREE.Mesh;
  label.geometry.computeBoundingBox();
  const size = label.geometry.boundingBox!.getSize(new THREE.Vector3());
  expect(Math.max(size.x, size.y)).toBeLessThanOrEqual(0.8 * 2 * 0.055 + 1e-9);
});

// 아무도 안 할 때(기계 그림의 버튼)도 윗면에 '잡기'가 늘 보인다 — 판이 끝나 움직이는 버튼을 거두면 글씨가 사라졌다(사용자 2026-11-02 사진 219·228)
test('the drop button in the machine picture reads 잡기 too', () => {
  const parts = makeControlParts();
  const label = parts.getObjectByName('drop-label') as THREE.Mesh;
  expect(label?.userData.text).toBe('잡기');
  parts.updateMatrixWorld(true);
  const at = label.getWorldPosition(new THREE.Vector3());
  expect(at.x).toBeCloseTo(CONTROLS.drop[0]); expect(at.z).toBeCloseTo(CONTROLS.drop[2]);
  expect(at.y).toBeGreaterThan(CONTROLS.drop[1] + 0.03); // 납작한 윗면(0.6배) 위
  label.geometry.computeBoundingBox();
  const size = label.geometry.boundingBox!.getSize(new THREE.Vector3()).multiply(label.scale);
  expect(Math.max(size.x, size.y)).toBeLessThanOrEqual(0.8 * 2 * 0.055 * 1.45 + 1e-9); // 윗면 지름 안
});

// 인형 기계 잡기 버튼도 하는 동안 둘레로 고리가 퍼져 나가 '이걸 누른다'가 보인다(사용자 2026-11-02)
test('the drop button sends out rings while aiming', () => {
  const anchor = new THREE.Group();
  const controls = buildMachineControls(anchor);
  const cue = anchor.getObjectByName('press-cue-drop')!;
  controls.update(0.2);
  expect(cue.visible).toBe(true);
  const a = cue.children[0].scale.x; controls.update(0.6);
  expect(cue.children[0].scale.x).not.toBeCloseTo(a);
  anchor.updateMatrixWorld(true);
  const at = cue.getWorldPosition(new THREE.Vector3());
  expect(at.x).toBeCloseTo(CONTROLS.drop[0]); expect(at.z).toBeCloseTo(CONTROLS.drop[2]);
  controls.setPressed(true); controls.update(0.8);
  expect(cue.visible).toBe(false);
});
