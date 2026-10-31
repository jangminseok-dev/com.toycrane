import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { DOLLS, EFFECTS } from '../data/catalog';
import { stubCanvas } from '../test/canvasStub';
import { BODY_W, HEAD, PLAIN, dollHits, makeDoll } from './dolls';
import { outlineMat } from './toon';

beforeAll(stubCanvas);
const meshes = (g: THREE.Object3D) => { let n = 0; g.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; }); return n; };

test('every catalog doll builds a model', () => {
  for (const id of Object.keys(DOLLS)) expect(meshes(makeDoll(id)!)).toBeGreaterThan(5);
});
test('lite dolls skip small parts', () => {
  expect(meshes(makeDoll('bear', PLAIN, true)!)).toBeLessThan(meshes(makeDoll('bear')!));
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


// ---- 인형 변형 (설계 2026-10-31 인형 채우기 §4.2·§4.4): 색 6 · 표정 5 · 특수효과 8 · 진짜 황금 ----
const bodyOf = (g: THREE.Object3D) => g.getObjectByName('body') as THREE.Mesh;
const bodyColorOf = (g: THREE.Object3D) => (bodyOf(g).material as THREE.MeshToonMaterial).color.getHex();
const meshesWith = (g: THREE.Object3D, ok: (m: THREE.Material) => boolean) => {
  const found: THREE.Mesh[] = [];
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && ok(m.material as THREE.Material)) found.push(m); });
  return found;
};
// 얼굴 부품(이름이 face-로 시작)의 이름·크기 목록
const facePartsSignature = (g: THREE.Object3D) => {
  const parts: string[] = [];
  g.traverse((o) => { if (o.name.startsWith('face-')) parts.push(`${o.name}:${o.scale.toArray().map((v) => v.toFixed(3)).join(',')}:${o.position.x.toFixed(2)}`); });
  return parts.sort().join('|');
};

test('each palette color paints the body', () => {
  const tint = (c: number) => bodyColorOf(makeDoll('bear', { ...PLAIN, color: c })!);
  expect(tint(0)).not.toBe(tint(3));
  expect(tint(3)).toBe(new THREE.Color(DOLLS.bear.palette[3].color).getHex());
  expect(tint(0)).toBe(new THREE.Color(DOLLS.bear.palette[0].color).getHex());
});

test('a squirrel of another color keeps its stripes', () => {
  const mat = (c: number) => bodyOf(makeDoll('squirrel', { ...PLAIN, color: c })!).material as THREE.MeshToonMaterial;
  expect(mat(2).map).toBeTruthy();
  expect(mat(2)).not.toBe(mat(0));
});

test('gold dolls are made of shiny metal and wear a big crown', () => {
  const g = makeDoll('bear', { ...PLAIN, rare: 'gold' })!;
  expect(meshesWith(g, (m) => m instanceof THREE.MeshMatcapMaterial).length).toBeGreaterThan(3);
  expect(g.getObjectByName('crown')!.scale.x).toBeGreaterThan(1.2);
});

test('rare dolls wear a small crown and plain ones none', () => {
  expect(makeDoll('bunny', { ...PLAIN, rare: 'star' })!.getObjectByName('crown')!.scale.x).toBeCloseTo(1);
  expect(makeDoll('bunny')!.getObjectByName('crown')).toBeUndefined();
});

test('all eight effects build and differ', () => {
  const mats = EFFECTS.map((e) => bodyOf(makeDoll('cat', { ...PLAIN, rare: e.id })!).material);
  expect(new Set(mats).size).toBe(8);
});

test('rare dolls sparkle unless drawn in the pile', () => {
  expect(makeDoll('cat', { ...PLAIN, rare: 'sakura' })!.userData.spin.length).toBeGreaterThan(0);
  expect(makeDoll('cat', { ...PLAIN, rare: 'sakura' }, true)!.userData.spin).toHaveLength(0);
});

test('faces change the face parts', () => {
  for (const kind of ['bear', 'penguin']) {
    const sig = (f: number) => facePartsSignature(makeDoll(kind, { ...PLAIN, face: f })!);
    expect(new Set([0, 1, 2, 3, 4].map(sig)).size, kind).toBe(5);
  }
});

test('the pile keeps the faces too', () => {
  const sig = (f: number) => facePartsSignature(makeDoll('bear', { ...PLAIN, face: f }, true)!);
  expect(new Set([0, 1, 2, 3, 4].map(sig)).size).toBe(5);
});

test('chubby hit spheres are wider', () => {
  expect(dollHits('bear', 'c').solid[1].r).toBeGreaterThan(dollHits('bear').solid[1].r);
  expect(dollHits('bear', 's').solid[1].r).toBeCloseTo(dollHits('bear').solid[1].r * BODY_W.s);
});

test('a crowned doll adds the crown to its hit spheres', () => {
  const top = (rare: string) => Math.max(...dollHits('bunny', 'n', rare).solid.map((h) => h.c.y + h.r));
  expect(top('gold')).toBeGreaterThan(top('') + 0.1);
});
