import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { COUNTERS } from '../data/storeLayout';
import { buildCoinCounters } from './coinCounter';

beforeAll(stubCanvas);

// 허브 위쪽 왼쪽·오른쪽에 좌우 대칭으로, 둘 다 카메라 쪽(남쪽)을 보는 교환소 (shared/store_layout.json counters, 설계 2026-10-31 §3.12)
// 작은 교환소 4곳이 배치(shared/store_layout.json) 자리에 선다 (설계 2026-10-31 교환소 개편 §3.1)
test('four counters stand where the layout puts them', () => {
  const counters = buildCoinCounters(new THREE.Scene());
  expect(counters).toHaveLength(4);
  counters.forEach((o, i) => {
    const c = o.box.getCenter(new THREE.Vector3());
    expect(Math.hypot(c.x - COUNTERS[i].x, c.z - COUNTERS[i].z)).toBeLessThan(0.8);
  });
});

// 작은 교환소(설계 2026-10-31 교환소 개편 §3.1): 장애물 상자(1.3×0.7m)만 하고, 교환소마다 재질별로 합친다 —
// 4곳을 한 덩어리로 합치면 매장 전체에 걸친 덩어리라 카메라 뒤에 있어도 늘 그려졌다(휴대폰 기계 앞 화면 그리기 호출 증가)
test('small counters fit their footprint and each bakes into a few meshes', () => {
  const scene = new THREE.Scene();
  buildCoinCounters(scene);
  const groups = scene.children.filter((o) => o.name.startsWith('coin-counter-'));
  expect(groups).toHaveLength(4);
  for (const g of groups) expect(g.children.length).toBeLessThanOrEqual(8);
  const box = new THREE.Box3().setFromObject(scene);
  expect(box.max.y).toBeGreaterThan(2.0);
  for (const c of COUNTERS) {
    const near = new THREE.Box3(new THREE.Vector3(c.x - 0.9, 0.3, c.z - 0.6), new THREE.Vector3(c.x + 0.9, 2, c.z + 0.6));
    expect(near.intersectsBox(box)).toBe(true);
  }
});
