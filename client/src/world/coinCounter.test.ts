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

// 합쳐 그린 결과에 카운터 본체(간판 높이 2.45m 근처)까지 들어 있어야 한다
test('baked counters include the booth itself', () => {
  const scene = new THREE.Scene();
  buildCoinCounters(scene);
  const top = new THREE.Box3().setFromObject(scene).max.y;
  expect(top).toBeGreaterThan(2.5);
});
