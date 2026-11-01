import * as THREE from 'three';
import { expect, test } from 'vitest';
import { ROOM_HEIGHT } from '../world/layout';
import type { Vec2 } from './movement';
import { CAMERA_OFFSETS, followCamera, plazaBlend } from './followCamera';
import { OcclusionFader } from './occlusion';

// 걷기 카메라는 동물의 숲처럼 캐릭터 뒤 위에서 대각선으로 내려다본다 (설계 2026-10-31 §3.7, 2차 결정)
for (const aspect of [16 / 9, 9 / 19.5]) test(`walking camera looks down diagonally from above (aspect ${aspect.toFixed(2)})`, () => {
  const cam = new THREE.PerspectiveCamera(50, aspect);
  for (let i = 0; i < 120; i++) followCamera(cam, { x: -10, z: 12 }, 0.1); // 광장 밖 길 (큰 홀: 광장 안에서는 높이 빠진다)
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

// 큰 홀(설계 2026-11-01 §3 카메라): 광장에 서면 저절로 높이 빠지고, 기계 줄 가까이에선 지금처럼 가깝다
const settledCamera = (at: Vec2, aspect: number) => {
  const cam = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
  for (let i = 0; i < 10; i++) followCamera(cam, at, 1);
  cam.updateMatrixWorld(true);
  return cam;
};
// 내 자리 높이의 바닥(y=0)에서 화면 가로로 보이는 폭(m)
const floorWidthAt = (cam: THREE.PerspectiveCamera, at: Vec2) => {
  const ndcY = new THREE.Vector3(at.x, 0, at.z).project(cam).y;
  const hit = (ndcX: number) => {
    const p = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(cam), d = p.sub(cam.position).normalize();
    return cam.position.clone().addScaledVector(d, -cam.position.y / d.y);
  };
  return hit(-1).distanceTo(hit(1));
};

test('in the plaza the PC camera sees the front rows of both side zones', () => {
  const cam = settledCamera({ x: 0, z: 0 }, 1280 / 800);
  for (const p of [[-11.45, 0, 0], [12.3, 0, 0]] as const) {
    const n = new THREE.Vector3(...p).project(cam);
    expect(Math.abs(n.x), `${p}`).toBeLessThan(1); expect(Math.abs(n.y), `${p}`).toBeLessThan(1);
  }
});

test('in the plaza the phone camera shows at least 10m of floor across the player', () => {
  expect(floorWidthAt(settledCamera({ x: 0, z: 0 }, 390 / 844), { x: 0, z: 0 })).toBeGreaterThanOrEqual(10);
});

test('next to a machine row the camera is as close as before', () => {
  expect(settledCamera({ x: -11.45, z: 0 }, 1.6).position.y).toBeCloseTo(CAMERA_OFFSETS.WIDE.y, 1);
  expect(plazaBlend({ x: 0, z: 0 })).toBe(1);
  expect(plazaBlend({ x: -11.45, z: 0 })).toBe(0);
});
