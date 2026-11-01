import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { drawnTexts, stubCanvas } from '../test/canvasStub';
import { adSignCell } from './signs';
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

// 광장 광고판 4개(양면) — 광고 자리 11~14, 사람들이 모이는 광장 둘레 (설계 2026-11-01 §3)
test('four plaza ad boards show slots 11 to 14', () => {
  drawnTexts.length = 0;
  const scene = new THREE.Scene(); buildStore(scene);
  const ads = scene.getObjectByName('plaza-ads') as THREE.Mesh;
  expect(ads).toBeDefined();
  const uv = ads.geometry.getAttribute('uv') as THREE.BufferAttribute, faces = uv.count / 4;
  expect(faces).toBe(8); // 4개 × 앞뒤
  const used = new Set<number>();
  for (let f = 0; f < faces; f++) for (let slot = 11; slot <= 14; slot++) {
    const c = adSignCell(slot - 1);
    if (Math.abs(uv.getX(f * 4) - c.u) < 1e-6 && Math.abs(Math.min(uv.getY(f * 4), uv.getY(f * 4 + 2)) - c.v) < 1e-6) used.add(slot);
  }
  expect([...used].sort()).toEqual([11, 12, 13, 14]);
  for (const slot of [11, 12, 13, 14]) expect(drawnTexts).toContain(`광고문의${slot}`);
});

// 진열탑 전광판: 알림이 없을 때 8초마다 광고 문구를 번갈아 띄우고, 희귀 알림 중에는 그대로
test('the tower board shows an ad when idle', () => {
  const scene = new THREE.Scene(); const tower = buildStore(scene);
  drawnTexts.length = 0; tower.update(8.1);
  expect(drawnTexts).toContain('광고문의1');
  drawnTexts.length = 0; tower.update(8.5);
  expect(drawnTexts).toHaveLength(0); // 같은 칸이면 다시 그리지 않음
  tower.showMessage('희귀 등장!', 'C-6에 고양이 등장!', false, 5);
  drawnTexts.length = 0; tower.update(16.2);
  expect(drawnTexts).toHaveLength(0);
});
