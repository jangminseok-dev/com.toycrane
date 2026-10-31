import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { DOLLS } from '../data/catalog';
import { stubCanvas } from '../test/canvasStub';
import { HEAD, dollHits, makeDoll } from './dolls';
import { outlineMat } from './toon';

beforeAll(stubCanvas);
const meshes = (g: THREE.Object3D) => { let n = 0; g.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; }); return n; };

test('every catalog doll builds a model', () => {
  for (const id of Object.keys(DOLLS)) expect(meshes(makeDoll(id)!)).toBeGreaterThan(5);
});
test('lite dolls skip small parts', () => {
  expect(meshes(makeDoll('bear', true)!)).toBeLessThan(meshes(makeDoll('bear')!));
});
test('unknown doll id gives null', () => expect(makeDoll('nope')).toBeNull());

// ---- 천 인형 비율 + 집게가 닿는 공 (설계 2026-10-31 §3.6·§4.2) ----
// 귀·꼬리(말랑해서 밀림)·왕관·반짝이·외곽선을 뺀 모델의 맨 위
const headTopOf = (doll: THREE.Object3D) => {
  doll.updateMatrixWorld(true);
  let top = -Infinity;
  const walk = (o: THREE.Object3D) => {
    if (['ear', 'tail', 'crown', 'aura'].includes(o.name)) return;
    const m = o as THREE.Mesh;
    if (m.isMesh && m.material !== outlineMat) { m.geometry.computeBoundingBox(); top = Math.max(top, m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld).max.y); }
    o.children.forEach(walk);
  };
  walk(doll);
  return top;
};

test('the head hit sphere matches the model head top', () => {
  for (const id of Object.keys(DOLLS)) {
    const top = headTopOf(makeDoll(id)!);
    const hits = dollHits(id).solid.filter((h) => h.part !== 'crown');
    const hitTop = Math.max(...hits.map((h) => h.c.y + h.r));
    expect(Math.abs(hitTop - top), id).toBeLessThan(0.08);
  }
});

test('standing dolls have a big plush head', () => {
  const [body, head] = dollHits('bear').solid;
  expect(head.r).toBeGreaterThan(body.r);
  expect(HEAD.standing.c + HEAD.standing.r).toBeLessThan(0.34 / 0.3); // 서버 DOLL_H 안
});

test('bear ears are soft parts the claw can bend', () => {
  const ears = makeDoll('bear')!.children.filter((o) => o.name === 'ear');
  expect(ears).toHaveLength(2);
  expect(ears[0].userData.ear.r).toBeCloseTo(0.12);
  expect(dollHits('bear').ears).toHaveLength(2);
});
