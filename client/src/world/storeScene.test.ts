import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { ROOM_HEIGHT } from './layout';
import { buildStore } from './storeScene';

beforeAll(stubCanvas);

// 밝은 게임센터: 하늘빛 하나 + 해 하나, 예전 분홍 점광은 없다 (설계 2026-10-31 §4.4)
test('the bright store uses one sun and a sky light, no coloured point lights', () => {
  const scene = new THREE.Scene(); buildStore(scene);
  const lights = scene.children.filter((o) => (o as THREE.Light).isLight);
  expect(lights.filter((l) => (l as THREE.PointLight).isPointLight)).toHaveLength(0);
  expect(lights.filter((l) => (l as THREE.DirectionalLight).isDirectionalLight)).toHaveLength(1);
});

// 낮춘 카메라에서 보이는 천장 조명판은 한 덩어리로 (그리기 한 번)
test('ceiling light panels are one merged mesh under the ceiling', () => {
  const scene = new THREE.Scene(); buildStore(scene);
  const panels = scene.getObjectByName('ceiling-lights') as THREE.Mesh;
  panels.geometry.computeBoundingBox();
  expect(panels.position.y + panels.geometry.boundingBox!.max.y).toBeLessThan(ROOM_HEIGHT);
  expect(panels.geometry.attributes.position.count).toBeGreaterThan(100 * 4);
});

test('the store stays a handful of draw calls', () => {
  const scene = new THREE.Scene(); buildStore(scene);
  let n = 0; scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.visible) n++; });
  expect(n).toBeLessThanOrEqual(40);
});
