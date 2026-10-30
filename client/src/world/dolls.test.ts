import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { DOLLS } from '../data/catalog';
import { stubCanvas } from '../test/canvasStub';
import { makeDoll } from './dolls';

beforeAll(stubCanvas);
const meshes = (g: THREE.Object3D) => { let n = 0; g.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; }); return n; };

test('every catalog doll builds a model', () => {
  for (const id of Object.keys(DOLLS)) expect(meshes(makeDoll(id)!)).toBeGreaterThan(5);
});
test('rare dolls wear a crown', () => {
  expect(makeDoll('starbunny')!.getObjectByName('crown')).toBeDefined();
  expect(makeDoll('bunny')!.getObjectByName('crown')).toBeUndefined();
});
test('lite dolls skip small parts', () => {
  expect(meshes(makeDoll('bear', true)!)).toBeLessThan(meshes(makeDoll('bear')!));
});
test('unknown doll id gives null', () => expect(makeDoll('nope')).toBeNull());
