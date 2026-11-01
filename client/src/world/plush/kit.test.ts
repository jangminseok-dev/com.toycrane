import * as THREE from 'three';
import { expect, test } from 'vitest';
import { CEL, PLUSH_OUTLINE, PLUSH_VC, PlushBuilder, plushMat } from './kit';

// 인형 리뉴얼 설계 §3 (v13 결): 2단 셀 음영 · 굵은 뒷면 외곽선 · 제 몸 그림자는 받지 않음
const meshesOf = (g: THREE.Object3D) => g.children.filter((o): o is THREE.Mesh => (o as THREE.Mesh).isMesh);

test('plush materials share the two-step cel shading and are cached per color', () => {
  expect(plushMat(0xc4a6ee)).toBe(plushMat(0xc4a6ee));
  expect(plushMat(0xc4a6ee).gradientMap).toBe(CEL);
  expect([...(CEL.image.data as Uint8Array)]).toEqual([...Array(8).fill(165), ...Array(8).fill(255)]);
  expect(PLUSH_VC.vertexColors).toBe(true);
  expect(PLUSH_OUTLINE.side).toBe(THREE.BackSide);
  expect(PLUSH_OUTLINE.color.getHex()).toBe(0x3f2a4f);
});

test('a builder merges parts per material and adds one outline mesh', () => {
  const b = new PlushBuilder({ lite: false })
    .sphere(0.6, [0, 1.2, 0], [1.12, 0.94, 0.96], [0, 0, 0], { name: 'head' })
    .sphere(0.11, [0.5, 1.61, 0.02], [1, 1, 0.32], [0, 0, 0], { slot: 'inner', outline: false, hit: 'none' })
    .tube([[0.2, 0.8, 0], [0.4, 0.5, 0.2], [0.36, 0.4, 0.3]], 0.11);
  const built = b.build((s) => plushMat(s === 'inner' ? 0xfff4e2 : 0xc4a6ee));
  const meshes = meshesOf(built.group);
  expect(meshes.filter((m) => m.material === PLUSH_OUTLINE)).toHaveLength(1);
  expect(meshes.filter((m) => m.material !== PLUSH_OUTLINE)).toHaveLength(2);
  expect(built.surface).toHaveLength(2);
  expect(built.head.c).toBeCloseTo(1.2); expect(built.head.r).toBeGreaterThan(0.5);
  expect(built.solid.length).toBeGreaterThanOrEqual(3); // 머리 1 + 관 2~3
  expect(meshes.every((m) => m.castShadow && !m.receiveShadow)).toBe(true);
});

test('lite builds use fewer triangles', () => {
  const tri = (lite: boolean) => {
    const g = new PlushBuilder({ lite }).sphere(0.5, [0, 1, 0]).build(() => plushMat(0xffffff)).group;
    let n = 0;
    g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) n += m.geometry.index ? m.geometry.index.count / 3 : m.geometry.getAttribute('position').count / 3; });
    return n;
  };
  expect(tri(true)).toBeLessThan(tri(false) / 3);
});

test('a pear torso is one closed lathe and gets body hit balls', () => {
  const built = new PlushBuilder({ lite: false }).pear([[0.02, 0], [0.3, 0.43], [0.6, 0.36], [0.88, 0]], 0.94, 0.02).build(() => plushMat(0xffffff));
  expect(built.solid.length).toBeGreaterThanOrEqual(1);
  expect(built.solid.length).toBeLessThanOrEqual(3);
});
