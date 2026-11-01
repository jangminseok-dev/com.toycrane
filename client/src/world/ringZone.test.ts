import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { dollName } from '../data/catalog';
import { RING, RINGS, pegXY } from '../data/rings';
import type { CardWire } from '../net/protocol';
import { drawnTexts, stubCanvas } from '../test/canvasStub';
import { buildRingZone } from './ringZone';

beforeAll(stubCanvas);
const board = (kind: string): CardWire[] => Array.from({ length: 12 }, (_, i) => [kind, i % 6, i === 3 ? 'gold' : '']);

// 고리 뽑기 10대(설계 2026-11-02 §3): 줄마다 몸통·구멍판을 합쳐 굽고 카드는 줄마다 한 장 그림판, 갈고리·버튼은 인스턴스 — 메시 60개 이하
test('ten ring machines draw in a few meshes', () => {
  const scene = new THREE.Scene(), zone = buildRingZone(scene);
  let n = 0;
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; });
  expect(n).toBeLessThanOrEqual(60);
  for (const r of RINGS) expect([zone.worldOf(r.id).position.x, zone.worldOf(r.id).position.z]).toEqual([r.x, r.z]);
});

// 카드는 보이는 경품 — 걸이마다 그 캐릭터 이름이 카드에 적힌다
test('cards show their prize', () => {
  const zone = buildRingZone(new THREE.Scene());
  drawnTexts.length = 0;
  zone.setBoard('R-2', board('penguin'));
  expect(drawnTexts).toContain(dollName('penguin', 1, ''));
  expect(drawnTexts).toContain(dollName('penguin', 3, 'gold'));
  expect(zone.boardOf('R-2')[3]).toEqual(['penguin', 3, 'gold']);
});

// 갈고리 끝은 기계 좌표 (x, y)에, 찌르면 구멍판 쪽으로 들어간다
test('the hook tip follows setHook and pokes toward the board', () => {
  const zone = buildRingZone(new THREE.Scene()), [px, py] = pegXY(5);
  zone.setHook('R-1', px, py, 0);
  const out = zone.hookTip('R-1');
  zone.setHook('R-1', px, py, 1);
  const inn = zone.hookTip('R-1');
  expect(out.x).toBeCloseTo(px, 6); expect(out.y).toBeCloseTo(py, 6);
  expect(inn.z).toBeLessThan(out.z);
  expect(inn.z).toBeGreaterThan(RING.board.z);
});

// 날아가는 카드는 걸릴 때마다 새로 그린다 — 치울 때 그림·재질·도형을 버려 긴 시간 동안 메모리가 쌓이지 않게(최종 리뷰)
test('a flying card releases its picture when it is put away', () => {
  const zone = buildRingZone(new THREE.Scene());
  const before = new Set(zone.worldOf('R-1').children);
  zone.flyCard('R-1', ['bear', 1, ''], new THREE.Vector3(0, 1.2, 0));
  const mesh = zone.worldOf('R-1').children.find((c) => !before.has(c)) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  let freed = 0;
  for (const d of [mesh.geometry, mesh.material, mesh.material.map!]) d.addEventListener('dispose', () => freed++);
  zone.flyCard('R-1', null, new THREE.Vector3());
  expect(freed).toBe(3);
  expect(zone.worldOf('R-1').children).not.toContain(mesh);
});
