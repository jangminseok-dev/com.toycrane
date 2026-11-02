import { beforeAll, expect, test } from 'vitest';
import { drawnTexts, stubCanvas } from '../test/canvasStub';
import { buildMinimap, mapPoint, mapSize, zoneRects } from './minimap';

beforeAll(stubCanvas);

// 매장 지도(설계 2026-11-02 §6): 위가 북쪽(−z), 돌지 않는다. 홀 전체(±room_half)가 지도 한 칸
test('map places zones and me where they are', () => {
  expect(mapPoint(-19, -19, 160)).toEqual([0, 0]);
  expect(mapPoint(0, 0, 160)).toEqual([80, 80]);
  expect(mapPoint(19, 19, 112)).toEqual([112, 112]);
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

// 지도는 왼쪽 아래(사용자 2026-11-02) — 휴대폰은 왼쪽 아래 조이스틱(쉬는 자리 바닥에서 148px까지) 위에
test('the map sits bottom-left, above the joystick on a phone', () => {
  const pc = buildMinimap({ appendChild: () => {} }, 160), phone = buildMinimap({ appendChild: () => {} }, 112);
  for (const m of [pc, phone]) { expect(m.el.style.left).toContain('14px'); expect(m.el.style.top || '').toBe(''); } // 위쪽 자리는 비어 있다
  const px = (b: string) => Number(/\+ (\d+)px/.exec(b)?.[1]);
  expect(px(pc.el.style.bottom)).toBeLessThan(40);
  expect(px(phone.el.style.bottom)).toBeGreaterThanOrEqual(156);
});

// 지도 위에 지금 내가 있는 구역 이름(사용자 2026-11-02 '맵에서 내 위치가 어떤 존인지')
// 구역 이름은 지도 위 알약이 아니라 색 덩어리 위에 바로(사용자 친구 피드백 2026-11-02 사진 257 '저기 지금 어딘지가 왜 써져 있어' — 덩어리마다 이름):
// 인형 뽑기(분홍)·피규어 뽑기(보라)는 두 줄, 고리 걸기(민트)·미는 뽑기(노랑)는 한 줄. 지도 위 알약은 없다
test('the map writes each zone name on its block, not above the map', () => {
  const added: HTMLElement[] = [], map = buildMinimap({ appendChild: (el) => { added.push(el); } }, 160);
  expect(added.map((el) => el.className)).toEqual(['minimap']);
  drawnTexts.length = 0;
  map.frame({ me: { x: -12, z: 0, heading: 0 }, others: [], atMachine: false }, 0);
  expect(drawnTexts).toEqual(['인형', '뽑기', '피규어', '뽑기', '고리 걸기', '미는 뽑기', '코인', '코인', '코인', '코인']); // 교환소 점 4개 아래에도 '코인'(사용자 2026-11-02)
});
