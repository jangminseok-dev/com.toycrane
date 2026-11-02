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

// 사용자 2026-11-02(사진 214): 캐릭터를 카툰식으로 더 귀엽게 — 색마다 머리 모양이 다르고(단발·양갈래 똥머리·포니테일·바보털),
// 얼굴은 큰 눈과 반짝임·눈썹·웃는 입·볼터치·귀. 디테일이 늘어도 한 명의 삼각형·그리기 호출은 예전(29,632·25) 안
const tris = (o: THREE.Object3D) => { let n = 0; o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && m.geometry?.attributes?.position) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; }); return n; };
const meshes = (o: THREE.Object3D) => { let n = 0; o.traverse((c) => { if ((c as THREE.Mesh).isMesh) n++; }); return n; };
test('each colour gets its own hair style and the avatar stays light', () => {
  // 머리 모양마다 머리 겉크기가 다르다(단발은 옆으로, 똥머리는 위로, 포니테일은 뒤로, 바보털은 꼭대기로)
  const heads = [0, 1, 2, 3].map((c) => new THREE.Box3().setFromObject(makeAvatar(c, 'x').rig.head).getSize(new THREE.Vector3()).toArray().map((v) => v.toFixed(2)).join(','));
  expect(new Set(heads).size).toBe(4);
  for (let c = 0; c < 8; c++) {
    const a = makeAvatar(c, 'x');
    expect(tris(a.root)).toBeLessThanOrEqual(29632);
    expect(meshes(a.root)).toBeLessThanOrEqual(25);
  }
});
