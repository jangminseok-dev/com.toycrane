import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { drawnTexts, stubCanvas } from '../test/canvasStub';
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
