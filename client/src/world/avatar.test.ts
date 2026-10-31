import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { makeAvatar } from './avatar';

beforeAll(stubCanvas);

test('avatar exposes a rig for motions', () => {
  const a = makeAvatar(0, '토끼');
  expect(a.rig.head).toBeDefined();
  expect(a.rig.held).toBeNull();
  expect(a.rig.handR.x).toBeCloseTo(0.52);
});

// 조르는 사람 이름표 옆 꼬리표 '조르는 중' — 붙였다 떼면 GPU 자원도 돌려준다
test('a tag can be added under the name and removed', () => {
  const a = makeAvatar(0, '토끼');
  a.setTag('조르는 중');
  expect(a.root.getObjectByName('tag')).toBeDefined();
  a.setTag(null);
  expect(a.root.getObjectByName('tag')).toBeUndefined();
});

// 앞을 가리면 거의 투명하게 — 그 아바타 재질만 복제해 흐리고, 다른 사람(같은 재질을 쓰는)은 그대로 (교환소 개편 설계 §4.7.2)
test('fading one avatar leaves the others alone and comes back', () => {
  const a = makeAvatar(0, '토끼'), b = makeAvatar(0, '곰돌이');
  const body = (x: ReturnType<typeof makeAvatar>) => { let m: THREE.Mesh | null = null; x.rig.bob.traverse((o) => { if (!m && (o as THREE.Mesh).isMesh) m = o as THREE.Mesh; }); return m!; };
  const original = body(a).material as THREE.Material;
  a.setFade(0.15);
  expect((body(a).material as THREE.Material).opacity).toBeCloseTo(0.15);
  expect((body(a).material as THREE.Material).transparent).toBe(true);
  expect((body(b).material as THREE.Material).opacity).toBe(1);
  a.setFade(1);
  expect(body(a).material).toBe(original);
});
