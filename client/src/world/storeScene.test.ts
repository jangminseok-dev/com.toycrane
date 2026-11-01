import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { ROOM_HALF, ROOM_HEIGHT, TOWER_HALF } from './layout';
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

// 큰 홀(설계 2026-11-01 §3): 광장 가운데 진열탑 — 큰 인형·피규어 상자가 층층이, 4면 전광판은 꼭대기에, 높이 4.5m 이하
test('the display tower stands in the plaza with the four-sided board on top', () => {
  const scene = new THREE.Scene();
  const tower = buildStore(scene);
  scene.updateMatrixWorld(true);
  const display = scene.getObjectByName('display-tower')!;
  expect(display).toBeDefined();
  const box = new THREE.Box3().setFromObject(display);
  expect(box.max.y).toBeLessThanOrEqual(4.5);
  expect(Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z))).toBeLessThanOrEqual(TOWER_HALF + 0.05);
  const screens: THREE.Object3D[] = [];
  scene.traverse((o) => { if (o.name === 'tower-screen') screens.push(o); });
  expect(screens).toHaveLength(4);
  for (const sc of screens) expect(new THREE.Vector3().setFromMatrixPosition(sc.matrixWorld).y).toBeGreaterThanOrEqual(3);
  expect(tower.box.min.x).toBeCloseTo(-TOWER_HALF); expect(tower.box.max.z).toBeCloseTo(TOWER_HALF);
  expect(tower.box.max.y).toBeCloseTo(box.max.y, 1);
  let dolls = 0; display.traverse((o) => { if (o.name.startsWith('tower-doll')) dolls++; });
  expect(dolls).toBe(0); // 탑의 인형·상자는 재질별로 합쳐 그린다(메시 몇 개)
});

test('the walls enclose the big hall', () => {
  const scene = new THREE.Scene(); buildStore(scene);
  scene.updateMatrixWorld(true);
  const walls: THREE.Box3[] = [];
  scene.traverse((o) => { if (o.name === 'hall-wall') walls.push(new THREE.Box3().setFromObject(o)); });
  expect(walls).toHaveLength(4);
  const all = walls.reduce((a, b) => a.union(b), new THREE.Box3());
  expect(all.min.x).toBeCloseTo(-ROOM_HALF); expect(all.max.x).toBeCloseTo(ROOM_HALF);
  expect(all.min.z).toBeCloseTo(-ROOM_HALF); expect(all.max.z).toBeCloseTo(ROOM_HALF);
});
