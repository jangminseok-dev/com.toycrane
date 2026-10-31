import * as THREE from 'three';
import { expect, test } from 'vitest';
import { ROOM_HEIGHT } from '../world/layout';
import { CAMERA_OFFSETS, followCamera } from './followCamera';
import { OcclusionFader } from './occlusion';

// 걷기 카메라는 동물의 숲처럼 캐릭터 뒤 위에서 대각선으로 내려다본다 (설계 2026-10-31 §3.7, 2차 결정)
for (const aspect of [16 / 9, 9 / 19.5]) test(`walking camera looks down diagonally from above (aspect ${aspect.toFixed(2)})`, () => {
  const cam = new THREE.PerspectiveCamera(50, aspect);
  for (let i = 0; i < 120; i++) followCamera(cam, { x: 1, z: -3 }, 0.1);
  const dir = cam.getWorldDirection(new THREE.Vector3());
  const pitch = Math.asin(-dir.y) * 180 / Math.PI;
  expect(pitch).toBeGreaterThan(35);
  expect(pitch).toBeLessThan(55);
  expect(cam.position.y).toBeGreaterThan(ROOM_HEIGHT + 2); // 천장 높이보다 훨씬 위 (천장은 없다)
  expect(dir.z).toBeLessThan(0);
  expect(Math.hypot(cam.position.x - 1, cam.position.y, cam.position.z + 3)).toBeLessThan(13);
});

// 섬 줄 뒤(북쪽)를 걸으면 섬 줄이 캐릭터를 가린다 — 가리면 흐려져야 캐릭터가 보인다
test('the island row fades when it hides the player from the aisle camera', () => {
  const island = new THREE.Box3(new THREE.Vector3(-9.9, 0, -8.4), new THREE.Vector3(9.9, 2.7, -5.75));
  let opacity = 1;
  const fader = new OcclusionFader([{ box: island, setOpacity: (o) => { opacity = o; } }]);
  const at = { x: 0, z: -10 };
  const eye = new THREE.Vector3(at.x, 0, at.z).add(CAMERA_OFFSETS.WIDE);
  for (let i = 0; i < 30; i++) fader.update(0.05, eye, at);
  expect(opacity).toBeLessThan(0.5);
});
