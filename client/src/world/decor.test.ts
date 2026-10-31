import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { DECOR, OBSTACLES } from '../data/storeLayout';
import { stubCanvas } from '../test/canvasStub';
import { buildDecor } from './decor';

beforeAll(stubCanvas);

// 빈 미니·피규어 구역의 "준비 중" 장식: 몇 덩어리로 합쳐 그리고, 모두 걸어서 통과할 수 없는 장애물 (설계 2026-10-31 §3.8)
test('decor stays a few merged meshes and every piece is an obstacle', () => {
  const scene = new THREE.Scene();
  buildDecor(scene);
  let n = 0;
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; });
  expect(DECOR.length).toBeGreaterThanOrEqual(6);
  expect(n).toBeLessThanOrEqual(24);
  for (const d of DECOR) expect(OBSTACLES).toContainEqual(d.rect);
});
