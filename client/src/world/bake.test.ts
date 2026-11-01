import * as THREE from 'three';
import { expect, test } from 'vitest';
import { bakeByMaterial, fadeMaterials, materialCloner } from './bake';
import { toon } from './toon';

test('bake merges meshes that share a material', () => {
  const root = new THREE.Group(), a = toon(0xff0000), b = toon(0x00ff00);
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), a), new THREE.Mesh(new THREE.BoxGeometry(), a), new THREE.Mesh(new THREE.BoxGeometry(), b));
  expect(bakeByMaterial(root)).toHaveLength(2);
});

// 기계 줄·교환소·장식이 나를 가려 흐려질 때(사용자 2026-11-01, 기계 사이를 지나다니게 된 뒤 자주 보임): 외곽선 껍질(뒷면)은 감추고
// 원래 불투명한 몸은 깊이를 계속 쓴다 — 반투명 껍질이 몸 위에 겹겹이 그려져 기계가 짙은 보라 유리처럼 보였다. 원래 투명한 유리는 그대로
test('fading hides outline shells and keeps solid bodies writing depth', () => {
  const cloner = materialCloner(), remap = cloner.remap;
  const body = remap(new THREE.MeshToonMaterial({ color: 0xff88aa }));
  const shell = remap(new THREE.MeshBasicMaterial({ color: 0x3b2a5a, side: THREE.BackSide }));
  const glass = remap(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false }));
  fadeMaterials(cloner.materials, 0.5);
  expect(shell.visible).toBe(false);
  expect([body.transparent, body.depthWrite, body.opacity]).toEqual([true, true, 0.5]);
  expect([glass.transparent, glass.depthWrite]).toEqual([true, false]);
  fadeMaterials(cloner.materials, 1);
  expect(shell.visible).toBe(true);
  expect([body.transparent, body.depthWrite, body.opacity]).toEqual([false, true, 1]);
});
