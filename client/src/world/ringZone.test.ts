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
