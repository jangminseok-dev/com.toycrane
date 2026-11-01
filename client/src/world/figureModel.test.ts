import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { figureName, makeFigure } from './figureModel';

beforeAll(stubCanvas);
const meshes = (g: THREE.Object3D) => { const out: THREE.Mesh[] = []; g.traverse((o) => { if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh); }); return out; };
const mat = (m: THREE.Mesh) => m.material as THREE.Material;

// 9단계 피규어 생김새 C(설계 §3.6): 우리 인형 모양 그대로, 천 주름(꼭짓점 색) 없이 무광 비닐, 외곽선 유지, 둥근 받침대
test('figures are matte vinyl without fabric creases', () => {
  const g = makeFigure('bunny', '');
  const body = meshes(g).filter((m) => mat(m) instanceof THREE.MeshStandardMaterial);
  expect(body.length).toBeGreaterThan(3);
  for (const m of body) {
    const s = mat(m) as THREE.MeshStandardMaterial;
    expect(s.vertexColors).toBe(false);
    expect(s.roughness).toBeGreaterThanOrEqual(0.55);
  }
  expect(meshes(g).some((m) => mat(m).side === THREE.BackSide)).toBe(true); // 외곽선
  expect(g.getObjectByName('figure-base')).toBeDefined();
  expect(g.getObjectByName('aura')).toBeUndefined(); // 인형 희귀 둘레 반짝이는 쓰지 않는다(효과는 상자 까기에서)
});

// 황금: 광이 살짝 있는 금도금 — 매장에 반사 환경이 없어 금속감은 낮게(높이면 어둡게 보인다)
test('gold figure is lightly glossy gold', () => {
  const g = makeFigure('bear', 'gold');
  const body = meshes(g).filter((m) => mat(m) instanceof THREE.MeshStandardMaterial && m.name !== 'figure-base');
  expect(body.length).toBeGreaterThan(3);
  for (const m of body) {
    const s = mat(m) as THREE.MeshStandardMaterial;
    expect(s.metalness).toBeGreaterThanOrEqual(0.3); expect(s.metalness).toBeLessThanOrEqual(0.5);
    expect(s.roughness).toBeGreaterThanOrEqual(0.3); expect(s.roughness).toBeLessThanOrEqual(0.5);
    expect(s.color.r).toBeGreaterThan(0.8); expect(s.color.b).toBeLessThan(0.4);
  }
});

test('figure names read naturally', () => {
  expect(figureName('bunny', '')).toBe('토끼 피규어');
  expect(figureName('bunny', 'star')).toBe('별빛 토끼 피규어');
  expect(figureName('bunny', 'gold')).toBe('황금 토끼 피규어');
  for (const n of [figureName('cat', 'sakura'), figureName('dino', '')]) expect(n).not.toMatch(/[·぀-ヿ]/);
});
