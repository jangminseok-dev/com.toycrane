import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { makeAvatar, makeAvatarHead } from './avatar';

beforeAll(stubCanvas);

test('avatar exposes a rig for motions', () => {
  const a = makeAvatar(0, '토끼');
  expect(a.rig.head).toBeDefined();
  expect(a.rig.held).toBeNull();
  expect(a.rig.handR.x).toBeCloseTo(0.52);
});

// 조르는 사람 이름표 옆 꼬리표 '조르는 중' — 붙였다 떼면 GPU 자원도 돌려준다
test('a tag can be added above the name and removed', () => {
  const a = makeAvatar(0, '토끼');
  a.setTag('조르는 중');
  expect(a.root.getObjectByName('tag')).toBeDefined();
  a.setTag(null);
  expect(a.root.getObjectByName('tag')).toBeUndefined();
});

// 구경하는 사람 얼굴(사용자 2026-11-03): 화면 구석에서 빼꼼 내미는 얼굴은 그 사람 캐릭터와 같은 머리(색마다 머리 모양) — 색 번호 밖의 수도 같은 규칙으로
test('the peeking face is the same head as that character', () => {
  const geos = (o: THREE.Object3D) => { const g: THREE.BufferGeometry[] = []; o.traverse((c) => { if ((c as THREE.Mesh).isMesh) g.push((c as THREE.Mesh).geometry); }); return g; };
  expect(geos(makeAvatarHead(2))).toEqual(geos(makeAvatar(2, '토끼').rig.head));
  expect(geos(makeAvatarHead(10))).toEqual(geos(makeAvatar(2, '토끼').rig.head));
  expect(geos(makeAvatarHead(1))).not.toEqual(geos(makeAvatar(2, '토끼').rig.head));
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
