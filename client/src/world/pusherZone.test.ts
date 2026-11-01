import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { PUSHERS } from '../data/pushers';
import type { ItemWire } from '../net/protocol';
import { stubCanvas } from '../test/canvasStub';
import { buildPusherZone } from './pusherZone';

beforeAll(stubCanvas);
const items: ItemWire[] = [[1, 'bear', 0, '', -0.1, 0], [2, 'penguin', 3, 'gold', 0.2, 0.1]];

// 미는 뽑기 4대(설계 2026-11-02 §4): 몸통은 재질별로 합쳐 굽고, 미니 인형은 4대 전부 그림판 한 장 + 한 도형, 미는 판·버튼은 인스턴스
test('four pushers draw in a few meshes', () => {
  const scene = new THREE.Scene(), zone = buildPusherZone(scene);
  let n = 0;
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; });
  expect(n).toBeLessThanOrEqual(30);
  for (const p of PUSHERS) expect([zone.worldOf(p.id).position.x, zone.worldOf(p.id).position.z]).toEqual([p.x, p.z]);
});

// 선반 위 인형은 서버가 둔 자리(기계 좌표 x, z)에 선다
test('the shelf shows its prizes where the server put them', () => {
  const zone = buildPusherZone(new THREE.Scene());
  zone.setShelf('P-2', items);
  expect(zone.shelfOf('P-2')).toEqual(items);
  expect(zone.shown('P-2').map((s) => [s.item[0], s.x, s.y, s.z])).toEqual([[1, -0.1, 0, 0], [2, 0.2, 0, 0.1]]);
  zone.setShelf('P-2', items.slice(1));
  expect(zone.shown('P-2').map((s) => s.item[0])).toEqual([2]);
});
