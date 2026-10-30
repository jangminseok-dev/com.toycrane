import * as THREE from 'three';
import { expect, test } from 'vitest';
import { bakeByMaterial } from './bake';
import { toon } from './toon';

test('bake merges meshes that share a material', () => {
  const root = new THREE.Group(), a = toon(0xff0000), b = toon(0x00ff00);
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), a), new THREE.Mesh(new THREE.BoxGeometry(), a), new THREE.Mesh(new THREE.BoxGeometry(), b));
  expect(bakeByMaterial(root)).toHaveLength(2);
});
