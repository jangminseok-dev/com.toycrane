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

// 동물의 숲처럼 위에서 내려다보므로 천장은 없다 (설계 2026-10-31 §3.7, 2차 결정)
test('there is no ceiling over the store', () => {
  const scene = new THREE.Scene(); buildStore(scene);
  const high: THREE.Object3D[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && new THREE.Box3().setFromObject(o).min.y >= ROOM_HEIGHT - 0.1) high.push(o); });
  expect(high).toHaveLength(0);
});

test('the store stays a handful of draw calls', () => {
  const scene = new THREE.Scene(); buildStore(scene);
  let n = 0; scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.visible) n++; });
  expect(n).toBeLessThanOrEqual(40);
});

// 벽 광고 간판 10장 '광고문의1'~'광고문의10' — 한 그림에 모아 메시 하나로 (설계 2026-10-31 교환소 개편 §3.4·§4.6)
test('ten ad signs hang on the walls as one mesh', () => {
  const scene = new THREE.Scene();
  buildStore(scene);
  const signs = scene.getObjectByName('wall-signs') as THREE.Mesh;
  expect(signs).toBeDefined();
  const tris = (signs.geometry.index ? signs.geometry.index.count : signs.geometry.getAttribute('position').count) / 3;
  expect(tris).toBe(20);
});
