import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { buildMinimap, mapPoint, mapSize, zoneRects } from './minimap';

beforeAll(stubCanvas);

// 매장 지도(설계 2026-11-02 §6): 위가 북쪽(−z), 돌지 않는다. 홀 전체(±room_half)가 지도 한 칸
test('map places zones and me where they are', () => {
  expect(mapPoint(-22, -22, 160)).toEqual([0, 0]);
  expect(mapPoint(0, 0, 160)).toEqual([80, 80]);
  expect(mapPoint(22, 22, 112)).toEqual([112, 112]);
  const z = Object.fromEntries(zoneRects().map((r) => [r.zone, r]));
  expect(z.doll.x1).toBeLessThan(-8); // 인형은 서쪽
  expect(z.figure.x0).toBeGreaterThan(8); // 피규어는 동쪽
  expect(z.ring.z1).toBeLessThan(-12); // 고리·미는 뽑기는 북쪽
  expect(z.pusher.z1).toBeLessThan(-12);
  expect(mapSize(390, 844)).toBe(112);
  expect(mapSize(1280, 800)).toBe(160);
});

// 기계 앞 화면(판 중·판 사이)에서는 버튼·시간 표시를 가리지 않게 숨긴다. 들어오기 전(나 없음)도 숨김
test('the map hides at a machine', () => {
  const map = buildMinimap({ appendChild: () => {} }, 160);
  map.frame({ me: { x: 0, z: 5, heading: 0 }, others: [{ x: 3, z: 3 }], atMachine: false }, 0);
  expect(map.el.style.display).toBe('block');
  map.frame({ me: { x: 0, z: 5, heading: 0 }, others: [], atMachine: true }, 1);
  expect(map.el.style.display).toBe('none');
  map.frame({ me: null, others: [], atMachine: false }, 2);
  expect(map.el.style.display).toBe('none');
});
