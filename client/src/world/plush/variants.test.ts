import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { DOLLS, EFFECTS } from '../../data/catalog';
import { stubCanvas } from '../../test/canvasStub';
import { PLAIN } from '../dolls';
import { FACE_MAT } from './faceAtlas';
import { makePlush } from './index';
import { PLUSH_OUTLINE } from './kit';

beforeAll(stubCanvas);

// 인형 변형 (인형 리뉴얼 설계 §4, 인형 채우기 설계 §4.2·§4.4): 색 6 · 표정 5 · 특수효과 8 · 진짜 황금 — 새 인형에서도 모두 살아 있다
const bodyOf = (g: THREE.Object3D) => g.getObjectByName('body') as THREE.Mesh;
const facePartsSignature = (g: THREE.Object3D) => {
  const parts: string[] = [];
  g.traverse((o) => { if (o.name.startsWith('face-')) parts.push(`${o.name}:${o.scale.toArray().map((v) => v.toFixed(3)).join(',')}:${o.position.x.toFixed(2)}`); });
  return parts.sort().join('|');
};
const surfaceMeshes = (g: THREE.Object3D) => {
  const out: THREE.Mesh[] = [];
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.material !== PLUSH_OUTLINE && m.material !== FACE_MAT && m.name !== 'stitch' && !isCrownOrAura(m)) out.push(m); });
  return out;
};
const isCrownOrAura = (o: THREE.Object3D): boolean => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.name === 'crown' || p.name === 'aura') return true; return false; };

test('each palette color paints the body', () => {
  const tint = (c: number) => (bodyOf(makePlush('bear', { ...PLAIN, color: c }, false)!.group).material as THREE.MeshToonMaterial).color.getHex();
  expect(tint(0)).not.toBe(tint(3));
  expect(tint(3)).toBe(new THREE.Color(DOLLS.bear.palette[3].color).getHex());
  expect(tint(0)).toBe(new THREE.Color(DOLLS.bear.palette[0].color).getHex());
});

test('gold dolls are made of shiny metal and wear a big crown', () => {
  const g = makePlush('bear', { ...PLAIN, rare: 'gold' }, false)!.group;
  const metal = surfaceMeshes(g);
  expect(metal.length).toBeGreaterThan(0);
  expect(metal.every((m) => m.material instanceof THREE.MeshMatcapMaterial)).toBe(true);
  expect(g.getObjectByName('crown')!.scale.x).toBeGreaterThan(1.2);
});

test('rare dolls wear a small crown and plain ones none', () => {
  expect(makePlush('bunny', { ...PLAIN, rare: 'star' }, false)!.group.getObjectByName('crown')!.scale.x).toBeCloseTo(1);
  expect(makePlush('bunny', PLAIN, false)!.group.getObjectByName('crown')).toBeUndefined();
});

test('all eight effects build and differ', () => {
  const mats = EFFECTS.map((e) => bodyOf(makePlush('cat', { ...PLAIN, rare: e.id }, false)!.group).material);
  expect(new Set(mats).size).toBe(8);
});

test('rare dolls sparkle unless drawn in the pile', () => {
  expect(makePlush('cat', { ...PLAIN, rare: 'sakura' }, false)!.group.userData.spin.length).toBeGreaterThan(0);
  expect(makePlush('cat', { ...PLAIN, rare: 'sakura' }, true)!.group.userData.spin).toHaveLength(0);
});

test('faces change the face parts', () => {
  for (const kind of ['bear', 'penguin', 'cat']) {
    const sig = (f: number) => facePartsSignature(makePlush(kind, { ...PLAIN, face: f }, false)!.group);
    expect(new Set([0, 1, 2, 3, 4].map(sig)).size, kind).toBe(5);
  }
});

test('the pile keeps the faces too', () => {
  const sig = (f: number) => facePartsSignature(makePlush('bear', { ...PLAIN, face: f }, true)!.group);
  expect(new Set([0, 1, 2, 3, 4].map(sig)).size).toBe(5);
});

test('a crowned doll adds the crown to its hit spheres', () => {
  const top = (rare: string) => Math.max(...makePlush('bunny', { ...PLAIN, rare }, false)!.solid.map((h) => h.c.y + h.r));
  expect(top('gold')).toBeGreaterThan(top('') + 0.1);
  expect(makePlush('bunny', { ...PLAIN, rare: 'star' }, false)!.solid.filter((h) => h.part === 'crown')).toHaveLength(1);
});

// Review Focus 2: 황금·효과 인형도 얼굴은 얼굴 재질 그대로
test('gold and effect dolls keep their painted faces', () => {
  for (const rare of ['gold', 'galaxy']) {
    const g = makePlush('cat', { ...PLAIN, rare }, false)!.group;
    const face: THREE.Mesh[] = [];
    g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.material === FACE_MAT) face.push(m); });
    expect(face.length, rare).toBe(1);
  }
});

test('the same look is built once and handed out as copies', () => {
  const a = makePlush('bear', { ...PLAIN, color: 2, face: 1 }, true)!.group, b = makePlush('bear', { ...PLAIN, color: 2, face: 1 }, true)!.group;
  expect(a).not.toBe(b);
  expect(bodyOf(a).geometry).toBe(bodyOf(b).geometry);
  const ear = a.children.find((o) => o.name === 'ear')!;
  expect(ear.userData.ear.c).toBeInstanceOf(THREE.Vector3); // 복사본의 귀 표지도 진짜 벡터
});
