import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { DOLLS } from '../data/catalog';
import { stubCanvas } from '../test/canvasStub';
import { BODY_W, PLAIN, dollHits, headOf, isRoundDoll, makeDoll } from './dolls';
import { SPECIES } from './plush/species';
import { PLUSH_OUTLINE } from './plush/kit';
import { bakePlush } from './plushBake';

beforeAll(stubCanvas);
const meshes = (g: THREE.Object3D) => { let n = 0; g.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; }); return n; };
const tris = (g: THREE.Object3D) => { let n = 0; g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) n += (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3; }); return n; };

// 인형 리뉴얼(2026-11-01): 게임 인형은 새 인형(world/plush)을 그대로 쓴다 — 모양·변형 시험은 plush/*.test.ts에
test('every catalog doll builds a new plush model', () => {
  for (const id of Object.keys(DOLLS)) {
    const g = makeDoll(id)!;
    expect(meshes(g), id).toBeGreaterThan(2);
    expect(g.children.some((o) => (o as THREE.Mesh).material === PLUSH_OUTLINE), id).toBe(true);
  }
}, 60_000);
test('lite dolls use fewer triangles', () => {
  expect(tris(makeDoll('bear', PLAIN, true)!)).toBeLessThan(tris(makeDoll('bear')!) / 3);
}, 60_000);
// 기계 속 무더기(216마리)용 판은 휴대폰 삼각형 수를 지킨다 (인형 리뉴얼 Task 14: 평균 16,213이던 것을 큰 덩어리는 그대로 두고 팔·다리·작은 공만 낮춤)
test('pile dolls stay light on triangles', () => {
  const counts = Object.keys(DOLLS).map((id) => tris(makeDoll(id, PLAIN, true)!));
  expect(counts.reduce((a, b) => a + b, 0) / counts.length).toBeLessThan(9000);
  expect(Math.max(...counts)).toBeLessThan(13000);
}, 60_000);
test('unknown doll id gives null', () => expect(makeDoll('nope')).toBeNull());

test('round dolls and head spheres come from the species', () => {
  for (const id of Object.keys(DOLLS)) {
    expect(isRoundDoll(id), id).toBe(SPECIES[id].round);
    const head = headOf(id);
    const top = Math.max(...dollHits(id).solid.map((h) => h.c.y + h.r));
    expect(head.c, id).toBeGreaterThan(0.3);
    expect(head.c + head.r, id).toBeLessThanOrEqual(top + 0.05);
  }
}, 60_000);

test('standing dolls have a big plush head', () => {
  const head = headOf('bear');
  const below = dollHits('bear').solid.filter((h) => h.c.y < 0.5);
  expect(head.r).toBeGreaterThan(Math.max(...below.map((h) => h.r)));
  expect(Math.max(...dollHits('bear').solid.map((h) => h.c.y + h.r))).toBeLessThan(0.34 / 0.3); // 서버 DOLL_H 안
}, 60_000);

test('bear ears are soft parts the claw can bend', () => {
  const ears = makeDoll('bear')!.children.filter((o) => o.name === 'ear');
  expect(ears).toHaveLength(2);
  expect(ears[0].userData.ear.r).toBeGreaterThan(0.05);
  expect(dollHits('bear').ears).toHaveLength(2);
}, 60_000);

test('chubby hit spheres are wider', () => {
  const r = (body: 'n' | 'c' | 's') => Math.max(...dollHits('bear', body).solid.map((h) => h.r));
  expect(r('c')).toBeCloseTo(r('n') * BODY_W.c);
  expect(r('s')).toBeCloseTo(r('n') * BODY_W.s);
}, 60_000);

test('a crowned doll adds the crown to its hit spheres', () => {
  const top = (rare: string) => Math.max(...dollHits('bunny', 'n', rare).solid.map((h) => h.c.y + h.r));
  expect(top('gold')).toBeGreaterThan(top('') + 0.1);
}, 60_000);

// 미는 뽑기 미니 인형(설계 ring-hook §4): 한 기계에 28개, 네 대면 112개 — 휴대폰 걷기 삼각형(180만)을 지키려고 인형 기계 무더기용(lite)의 절반 이하
test('mini dolls use at most half the triangles of machine dolls', () => {
  const tri = (detail: boolean | 'mini') => Object.keys(DOLLS).reduce((n, k) => n + bakePlush(makeDoll(k, PLAIN, detail)!).reduce((t, m) => t + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0), 0);
  expect(tri('mini')).toBeLessThanOrEqual(tri(true) * 0.5);
}, 60_000);
