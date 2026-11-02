import * as THREE from 'three';
import { expect, test } from 'vitest';
import { ROOM_HEIGHT } from '../world/layout';
import type { Vec2 } from './movement';
import { CAMERA_OFFSETS, followCamera } from './followCamera';
import { OcclusionFader } from './occlusion';

// 걷기 카메라는 동물의 숲처럼 캐릭터 뒤 위에서 대각선으로 내려다본다 (설계 2026-10-31 §3.7, 2차 결정)
for (const aspect of [16 / 9, 9 / 19.5]) test(`walking camera looks down diagonally from above (aspect ${aspect.toFixed(2)})`, () => {
  const cam = new THREE.PerspectiveCamera(50, aspect);
  for (let i = 0; i < 120; i++) followCamera(cam, { x: -10, z: 12 }, 0.1);
  const dir = cam.getWorldDirection(new THREE.Vector3());
  const pitch = Math.asin(-dir.y) * 180 / Math.PI;
  expect(pitch).toBeGreaterThan(35);
  expect(pitch).toBeLessThan(55);
  expect(cam.position.y).toBeGreaterThan(ROOM_HEIGHT + 2); // 천장 높이보다 훨씬 위 (천장은 없다)
  expect(dir.z).toBeLessThan(0);
  expect(Math.hypot(cam.position.x + 10, cam.position.y, cam.position.z - 12)).toBeLessThan(13);
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

// 카메라는 어디서나 같은 높이 — 광장에서 저절로 빠졌다 기계 줄에서 당기는 것이 어지러웠다(사용자 2026-11-02 사진 241·242).
// 예전 기계 줄 앞 시점(PC 6.8·6.6, 세로 9.5·7.5)보다 살짝 가깝게 고정
const settledCamera = (at: Vec2, aspect: number) => {
  const cam = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
  for (let i = 0; i < 10; i++) followCamera(cam, at, 1);
  cam.updateMatrixWorld(true);
  return cam;
};

test('the walking camera keeps one height everywhere, a little closer than the old row view', () => {
  for (const [aspect, old] of [[1.6, [6.8, 6.6]], [390 / 844, [9.5, 7.5]]] as const) {
    const plaza = settledCamera({ x: 0, z: 0 }, aspect), row = settledCamera({ x: -8.45, z: 0 }, aspect);
    const dist = (c: THREE.PerspectiveCamera, at: Vec2) => Math.hypot(c.position.y, c.position.z - at.z);
    expect(plaza.position.y).toBeCloseTo(row.position.y, 5);
    expect(dist(plaza, { x: 0, z: 0 })).toBeLessThan(Math.hypot(old[0], old[1]) * 0.95);
    expect(dist(plaza, { x: 0, z: 0 })).toBeGreaterThan(Math.hypot(old[0], old[1]) * 0.8);
  }
});
