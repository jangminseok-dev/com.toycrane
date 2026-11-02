import * as THREE from 'three';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { drawnTexts, stubCanvas } from '../test/canvasStub';
import { AD_BOARDS } from '../data/storeLayout';
import { AD_SLOTS, AD_TOWER } from './ads';
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
  const tower = scene.getObjectByName('display-tower')!; // 광장 진열탑 꼭대기 전광판은 벽보다 높이 솟아 있다(천장 아님)
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && !tower.getObjectById(o.id) && new THREE.Box3().setFromObject(o).min.y >= ROOM_HEIGHT - 0.1) high.push(o); });
  expect(high).toHaveLength(0);
});

test('the store stays a handful of draw calls', () => {
  const scene = new THREE.Scene(); buildStore(scene);
  let n = 0; scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.visible) n++; });
  expect(n).toBeLessThanOrEqual(40);
});

// 광고는 광장 광고판 4개에만 (사용자 2026-11-01) — 벽에는 광고 간판이 없다
test('the walls carry no ad signs', () => {
  const scene = new THREE.Scene();
  buildStore(scene);
  expect(scene.getObjectByName('wall-signs')).toBeUndefined();
});

// 큰 홀(설계 2026-11-01 §3): 광장 가운데 진열탑 — 큰 인형·피규어 상자가 층층이, 4면 전광판은 꼭대기에.
// 사용자 2026-11-01 "중간 좀 더 크게": 폭 4.4m(옛 3.2m), 높이 6.2m 이하
test('the display tower stands in the plaza with the four-sided board on top', () => {
  const scene = new THREE.Scene();
  const tower = buildStore(scene);
  scene.updateMatrixWorld(true);
  const display = scene.getObjectByName('display-tower')!;
  expect(display).toBeDefined();
  const box = new THREE.Box3().setFromObject(display);
  expect(box.max.y).toBeLessThanOrEqual(6.2);
  expect(box.max.x - box.min.x).toBeGreaterThanOrEqual(4.3);
  expect(Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z))).toBeLessThanOrEqual(TOWER_HALF + 0.05);
  const screens: THREE.Object3D[] = [];
  scene.traverse((o) => { if (o.name === 'tower-screen') screens.push(o); });
  expect(screens).toHaveLength(4);
  for (const sc of screens) expect(new THREE.Vector3().setFromMatrixPosition(sc.matrixWorld).y).toBeGreaterThanOrEqual(4);
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

// 광장 광고판 4개(양면) — 광고 자리 1~4, 사람들이 모이는 광장 둘레 (설계 2026-11-01 §3, 광고는 여기에만)
test('four plaza ad boards show slots 1 to 4', () => {
  drawnTexts.length = 0;
  const scene = new THREE.Scene(); buildStore(scene);
  const ads = scene.getObjectByName('plaza-ads') as THREE.Mesh;
  expect(ads).toBeDefined();
  const uv = ads.geometry.getAttribute('uv') as THREE.BufferAttribute, faces = uv.count / 4;
  expect(faces).toBe(8); // 4개 × 앞뒤
  const used = new Set<number>();
  for (let f = 0; f < faces; f++) for (let slot = 1; slot <= 4; slot++) {
    const c = adSignCell(slot - 1);
    if (Math.abs(uv.getX(f * 4) - c.u) < 1e-6 && Math.abs(Math.min(uv.getY(f * 4), uv.getY(f * 4 + 2)) - c.v) < 1e-6) used.add(slot);
  }
  expect([...used].sort()).toEqual([1, 2, 3, 4]);
  for (const s of AD_SLOTS) expect(drawnTexts).toContain(s.text);
});

// '광고 문의' 판은 눌러서 인스타그램으로 — 그 판 자리에만 보이지 않는 누르는 상자(링크를 단다)
test('the inquiry board can be pressed to open its link', () => {
  const scene = new THREE.Scene(); buildStore(scene);
  const links = scene.getObjectByName('ad-links')!;
  const linked = AD_SLOTS.filter((s) => s.link);
  expect(links.children.map((c) => c.userData.link)).toEqual(linked.map((s) => s.link));
  const board = AD_BOARDS.find((b) => b.slot === linked[0].id)!;
  scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(board.x, 1.6, board.z + 5), new THREE.Vector3(0, 0, -1));
  expect(ray.intersectObjects(links.children, false)[0]?.object.userData.link).toBe(linked[0].link);
});

// 진열탑 전광판(사용자 2026-11-01): 광고 다섯 자리(5~9)를 한 줄로 이어 오른쪽에서 왼쪽으로 계속 흘린다 — 한 번에 한 칸 너비만 보인다
test('the tower board scrolls the five tower ads in turn', () => {
  drawnTexts.length = 0;
  const scene = new THREE.Scene(); const tower = buildStore(scene);
  for (const s of AD_TOWER) expect(drawnTexts).toContain(s.text);
  const screen = scene.getObjectByName('tower-screen') as THREE.Mesh, map = () => (screen.material as THREE.MeshBasicMaterial).map!;
  expect(map().repeat.x).toBeCloseTo(1 / AD_TOWER.length);
  const seen = new Set<number>(); let prev = NaN, moved = 0;
  for (let t = 0; t < 40; t += 0.25) {
    tower.update(t);
    const o = map().offset.x;
    if (o !== prev) moved++;
    prev = o; seen.add(Math.floor((((o % 1) + 1) % 1) * AD_TOWER.length));
  }
  expect(seen.size).toBe(AD_TOWER.length); // 다섯 칸이 차례로 다 지나간다
  expect(moved).toBeGreaterThan(150); // 멈추지 않고 계속 흐른다
});

// 희귀가 나오면 전광판이 잠깐 금색 알림으로 바뀌었다가 다시 광고가 흐른다
afterEach(() => { vi.useRealTimers(); });
test('a rare alert takes over the tower board for a moment', () => {
  vi.useFakeTimers();
  const scene = new THREE.Scene(); const tower = buildStore(scene);
  const screen = scene.getObjectByName('tower-screen') as THREE.Mesh, map = () => (screen.material as THREE.MeshBasicMaterial).map;
  const ticker = map();
  drawnTexts.length = 0;
  tower.showMessage('희귀 등장!', 'C-6에 고양이 등장!', true, 5);
  expect(drawnTexts).toContain('희귀 등장!');
  expect(map()).not.toBe(ticker);
  vi.advanceTimersByTime(5100);
  expect(map()).toBe(ticker);
});

// 큰 홀 최종 리뷰 I3: 해 그림자가 홀 끝까지 — 서쪽 인형 줄(x −20.2)·북쪽 고리 줄·입구 진열장에도 그림자가 진다
test('the sun shadow covers the whole hall', () => {
  const scene = new THREE.Scene();
  buildStore(scene);
  const sun = scene.children.find((o) => (o as THREE.DirectionalLight).isDirectionalLight) as THREE.DirectionalLight;
  scene.updateMatrixWorld(true);
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.updateMatrices(sun);
  for (const x of [-ROOM_HALF, ROOM_HALF]) for (const z of [-ROOM_HALF, ROOM_HALF]) for (const y of [0, 2.4]) {
    const p = new THREE.Vector3(x, y, z).applyMatrix4(sun.shadow.matrix);
    expect(p.x, `${x},${y},${z}`).toBeGreaterThanOrEqual(0); expect(p.x, `${x},${y},${z}`).toBeLessThanOrEqual(1);
    expect(p.y, `${x},${y},${z}`).toBeGreaterThanOrEqual(0); expect(p.y, `${x},${y},${z}`).toBeLessThanOrEqual(1);
  }
});

// 진열탑이 나를 가려 흐려질 때(사용자 2026-11-01 "중앙에 딱 붙으면 깨져 보여"): 외곽선 껍질(뒷면)을 감추고 몸은 깊이를 계속 쓴다 —
// 반투명 껍질이 몸 위에 겹겹이 그려져 탑 전체가 짙은 보라 유리 상자처럼 보였다
test('a faded tower hides its outline shells and keeps its depth', () => {
  const scene = new THREE.Scene(); const tower = buildStore(scene);
  const display = scene.getObjectByName('display-tower')!;
  const meshes: THREE.Mesh[] = [];
  display.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  const mat = (m: THREE.Mesh) => m.material as THREE.Material;
  const shells = meshes.filter((m) => mat(m).side === THREE.BackSide);
  expect(shells.length).toBeGreaterThan(0);
  const drawn = (m: THREE.Mesh) => m.visible && mat(m).visible;
  const solid = meshes.filter((m) => mat(m).side !== THREE.BackSide && !mat(m).transparent); // 원래 불투명한 것(유리창 빼고)
  expect(solid.length).toBeGreaterThan(3);
  tower.setOpacity(0.5);
  expect(shells.filter(drawn)).toEqual([]);
  for (const m of solid) { expect(mat(m).transparent).toBe(true); expect(mat(m).depthWrite).toBe(true); }
  tower.setOpacity(1);
  expect(shells.every(drawn)).toBe(true);
  for (const m of solid) expect(mat(m).transparent).toBe(false);
});
