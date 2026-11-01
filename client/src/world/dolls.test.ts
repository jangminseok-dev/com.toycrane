import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { DOLLS } from '../data/catalog';
import { stubCanvas } from '../test/canvasStub';
import { BODY_W, PLAIN, dollHits, headOf, isRoundDoll, makeDoll } from './dolls';
import { SPECIES } from './plush/species';
import { PLUSH_OUTLINE } from './plush/kit';

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
