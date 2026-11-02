import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { drawnTexts, stubCanvas } from '../test/canvasStub';
import { variantOf } from '../data/figures';
import { playReveal } from './figureReveal';

beforeAll(stubCanvas);
const effects = (s: THREE.Scene) => { let n = 0; s.traverse((o) => { if (o.name === 'figure-effect') n++; }); return n; };

// 9단계 상자 까기(설계 §3.5): 일반은 효과 없이 평범하게, 희귀·황금은 둘레 제자리 반짝임 + 글자 이름표. 끝나면 치우고 done
test('a normal reveal shows no effect', () => {
  const scene = new THREE.Scene();
  let finished = false;
  const r = playReveal(scene, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1.4, 1.5), 'bunny', '', () => { finished = true; });
  for (let t = 0; t < 1.5; t += 0.1) r.update(0.1);
  expect(effects(scene)).toBe(0);
  expect(scene.children.length).toBeGreaterThan(0);
  while (r.update(0.1));
  expect(finished).toBe(true);
  expect(scene.children.length).toBe(0);
});

test('rare and gold reveals sparkle in place with a label', () => {
  for (const [rare, label] of [['star', '희귀!'], ['gold', '황금!']] as const) {
    drawnTexts.length = 0;
    const scene = new THREE.Scene();
    const r = playReveal(scene, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1.4, 1.5), 'cat', rare, () => {});
    for (let t = 0; t < 1.5; t += 0.1) r.update(0.1);
    expect(effects(scene), rare).toBe(1);
    expect(drawnTexts, rare).toContain(label);
    while (r.update(0.1));
  }
});

// 상자 까기에 나오는 상자는 그 기계의 상자 모양(설계 §8.4) — 정사각형 기계면 정사각형 상자를 깐다
test('the reveal box matches the machine box', () => {
  const scene = new THREE.Scene();
  const r = playReveal(scene, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1.4, 1.5), 'cat', '', () => {}, 'square');
  r.update(0.1);
  const box = scene.getObjectByName('reveal-box') as THREE.Mesh;
  box.geometry.computeBoundingBox();
  const size = box.geometry.boundingBox!.getSize(new THREE.Vector3()), b = variantOf('square').box;
  expect([size.x, size.y, size.z].map((v) => +v.toFixed(6))).toEqual([b.w, b.d, b.h]);
  while (r.update(0.1));
});

// 사용자 2026-11-02 '결과가 너무 빨리 나와 — 상자 열리는 효과가 나오면서 결과가': 상자가 나타나 한동안 들썩이며 뜸을 들이고(피규어는 아직
// 안 보임), 열리는 순간 한 번 알리고(onOpen — 터지는 효과·소리), 그 뒤 피규어가 올라온다. 끝(done)은 4.5초 넘어서 — 그다음에 결과 카드
test('the box waits and shakes before it opens, then the figure rises', () => {
  const scene = new THREE.Scene();
  let finished = 0, opened = 0, openedAt = -1, t = 0;
  const r = playReveal(scene, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1.4, 1.5), 'bunny', '', () => { finished = t; }, 'long', () => { opened++; openedAt = t; });
  const box = () => scene.getObjectByName('reveal-box')!, fig = () => scene.children[0].children.find((c) => c.name !== 'reveal-box' && c.name !== 'figure-effect')!;
  const wobble: number[] = [];
  for (; t < 1.4; t += 0.05) { r.update(0.05); wobble.push(Math.abs(box().rotation.z)); }
  expect(fig().visible).toBe(false); // 아직 안 열렸다
  expect(opened).toBe(0);
  expect(Math.max(...wobble)).toBeGreaterThan(0.05); // 들썩인다
  while (r.update(0.05)) { t += 0.05; if (opened && t < openedAt + 1) expect(t).toBeGreaterThan(1.4); }
  expect(opened).toBe(1);
  expect(openedAt).toBeGreaterThan(1.4);
  expect(finished).toBeGreaterThan(4.5);
});
