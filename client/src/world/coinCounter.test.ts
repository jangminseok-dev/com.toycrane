import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { buildCoinCounters } from './coinCounter';

beforeAll(stubCanvas);

// 허브 왼쪽 위·오른쪽 아래에서 서로 마주 보는 교환소 (shared/store_layout.json counters)
test('two counters face each other', () => {
  const counters = buildCoinCounters(new THREE.Scene());
  expect(counters).toHaveLength(2);
  const c = counters.map((o) => o.box.getCenter(new THREE.Vector3()));
  expect([c[0].x, c[0].z]).toEqual([expect.closeTo(-2.9, 0), expect.closeTo(-3.7, 0)]);
  expect([c[1].x, c[1].z]).toEqual([expect.closeTo(2.9, 0), expect.closeTo(3.7, 0)]);
});

// 합쳐 그린 결과에 카운터 본체(간판 높이 2.45m 근처)까지 들어 있어야 한다
test('baked counters include the booth itself', () => {
  const scene = new THREE.Scene();
  buildCoinCounters(scene);
  const top = new THREE.Box3().setFromObject(scene).max.y;
  expect(top).toBeGreaterThan(2.5);
});
