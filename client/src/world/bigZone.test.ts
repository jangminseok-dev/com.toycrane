import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { MACHINES } from '../data/storeLayout';
import { stubCanvas } from '../test/canvasStub';
import { LITE_CACHE_MAX, buildBigZone, liteCacheSize } from './bigZone';
import { CONTROLS } from './machine';
import { spot } from '../test/spots';

beforeAll(stubCanvas);

test('big zone builds 24 machines in two fade rows', () => {
  const zone = buildBigZone(new THREE.Scene());
  expect(zone.occluders).toHaveLength(2);
  expect(MACHINES.every((m) => zone.worldOf(m.id))).toBe(true);
});

test('setContents skips unknown dolls', () => {
  const zone = buildBigZone(new THREE.Scene());
  expect(() => {
    zone.setContents('A-1', [spot('bunny', 0, 0, 0), spot('gone-doll', 0.1, 0.1, 0)]);
    zone.update(0);
  }).not.toThrow();
});

// 겨냥 고리: 집게를 따라 바닥에 비치고, 하는 동안에만 보인다
test('aim ring follows the claw and starts hidden', () => {
  const zone = buildBigZone(new THREE.Scene());
  const aim = zone.clawOf('C-6').getObjectByName('aim')!;
  expect(aim.visible).toBe(false);
  zone.showAim('C-6', true);
  expect(aim.visible).toBe(true);
});

// 기계 하나 결과마다 행 전체(섬 99개 인형)를 다시 합치면 휴대폰이 멈춘다 — 그 기계가 든 묶음만 다시 합친다 (최종 리뷰 I5)
test('a contents change rebuilds only its block of machines', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  for (const m of MACHINES) zone.setContents(m.id, [spot('bear', 0, 0, 0)]);
  zone.update(0);
  const groups: THREE.Object3D[] = [];
  scene.traverse((o) => { if (o.name.startsWith('dolls-')) groups.push(o); });
  const blocks = () => groups.map((b) => b.children.slice());
  const before = blocks();
  zone.setContents('C-6', [spot('cat', 0.1, 0.1, 0)]);
  zone.update(0.1);
  const after = blocks();
  const changed = before.filter((meshes, i) => meshes.some((m, k) => m !== after[i][k]));
  expect(changed).toHaveLength(1);
  expect(groups.length).toBe(5); // 벽 13대 → 3묶음, 섬 11대 → 2묶음 (6대 이하씩)
});

// 서버가 정한 얹힌 높이(y)대로 그린다 — 위층 인형이 바닥 인형보다 높이 있다
test('dolls are drawn at their resting height', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  zone.setContents('C-6', [spot('bear', 0, 0, 0, 0.22)]);
  zone.update(0);
  const box = new THREE.Box3();
  scene.traverse((o) => { if (o.name.startsWith('dolls-')) box.expandByObject(o); });
  expect(box.min.y).toBeGreaterThan(0.87 + 0.15);
});

// 하는 기계에서만 움직이는 집게로 바꿔 끼우고, 끝나면 쉬는 집게로 돌려놓는다(35대 모두 움직이는 집게면 휴대폰이 무겁다)
test('a machine borrows the moving claw while in use', () => {
  const zone = buildBigZone(new THREE.Scene());
  const idle = zone.clawOf('C-6').getObjectByName('idle-claw')!;
  const rig = zone.activateClaw('C-6');
  expect(idle.visible).toBe(false);
  expect(rig.root.parent).toBe(zone.clawOf('C-6'));
  zone.releaseClaw('C-6');
  expect(idle.visible).toBe(true);
  expect(rig.root.parent).toBeNull();
});

// 간판 전구가 켜졌다 꺼지며 돈다 (행마다 인스턴싱 한 덩어리)
test('marquee bulbs chase around over time', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  const bulbs = scene.getObjectByName('bulbs-big-island') as THREE.InstancedMesh;
  zone.update(0);
  const a = Array.from(bulbs.instanceColor!.array);
  zone.update(0.2);
  expect(Array.from(bulbs.instanceColor!.array)).not.toEqual(a);
});

// 간판 전구는 2.4cm짜리라 각진 작은 구로 충분하다 — 35대 × 58개 (최종 리뷰 I5)
test('marquee bulbs are cheap little gems', () => {
  const scene = new THREE.Scene();
  buildBigZone(scene);
  const bulbs = scene.getObjectByName('bulbs-big-island') as THREE.InstancedMesh;
  const geo = bulbs.geometry;
  expect((geo.index ? geo.index.count : geo.attributes.position.count) / 3).toBeLessThanOrEqual(40);
});

// 내가 하는 기계에는 움직이는 레버·하강 버튼(machineControls)을 따로 그린다. 기계 그림의 고정 레버·버튼이 그 밑에 남으면
// 레버를 기울이거나 버튼을 누를 때 원래 자리에 하나가 더 보인다(잔상) — 하는 동안 그 기계의 고정 레버·버튼은 숨는다
test('the lever and drop button of the machine I play are not drawn twice', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  scene.updateMatrixWorld(true);
  const id = MACHINES[3].id;
  const ballAt = zone.worldOf(id).localToWorld(new THREE.Vector3(CONTROLS.lever[0], CONTROLS.lever[1] + 0.1, CONTROLS.lever[2]));
  const domeAt = zone.worldOf(id).localToWorld(new THREE.Vector3(...CONTROLS.drop));
  expect([redNear(scene, ballAt), redNear(scene, domeAt)]).toEqual([1, 1]);
  zone.hideControls(id, true);
  expect([redNear(scene, ballAt), redNear(scene, domeAt)]).toEqual([0, 0]);
  zone.hideControls(id, false);
  expect([redNear(scene, ballAt), redNear(scene, domeAt)]).toEqual([1, 1]);
});

// p에서 5cm 안에 꼭짓점이 있는 빨간(레버 공·하강 버튼 색) 그림의 수 — 여러 기계가 든 InstancedMesh는 기계마다 따로 센다
function redNear(scene: THREE.Scene, p: THREE.Vector3): number {
  let n = 0;
  const v = new THREE.Vector3(), m = new THREE.Matrix4();
  const near = (pos: THREE.BufferAttribute, world: THREE.Matrix4) => {
    for (let i = 0; i < pos.count; i++) if (v.fromBufferAttribute(pos, i).applyMatrix4(world).distanceTo(p) < 0.05) return true;
    return false;
  };
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const mat = mesh.material as THREE.MeshToonMaterial | undefined;
    if (!mesh.isMesh || !mat?.color || mat.color.getHex() !== 0xff3b5c) return;
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      const inst = mesh as THREE.InstancedMesh;
      for (let k = 0; k < inst.count; k++) { inst.getMatrixAt(k, m); if (near(pos, m.premultiply(inst.matrixWorld))) n++; }
    } else if (near(pos, mesh.matrixWorld)) n++;
  });
  return n;
}

// ---- 인형 변형 (설계 2026-10-31 인형 채우기 §4.1·§4.4, 제약 §5: 휴대폰 그리기 호출이 늘지 않게) ----
const nineDolls = (kind: string, color: number) =>
  Array.from({ length: 9 }, (_, i) => spot(kind, -0.3 + (i % 3) * 0.25, -0.25 + Math.floor(i / 3) * 0.22, i, 0, { color, face: i % 5 }));
const materialsIn = (scene: THREE.Scene, name: string) => new Set(scene.getObjectByName(name)!.children.map((c) => (c as THREE.Mesh).material)).size;

test('six machines of different colors still bake into few materials', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  for (const [k, m] of MACHINES.slice(0, 6).entries()) zone.setContents(m.id, nineDolls(m.kind, k % 6));
  zone.update(0);
  expect(materialsIn(scene, 'dolls-big-wall-0')).toBeLessThanOrEqual(6);
});

// 물리 뽑기 설계 §4.5·§9.2: 안 앉은 인형(y null)은 물리가 앉힐 차례이고, 앉힌 자리·돌림을 입히면 y가 채워진다
test('unsettled dolls are listed and settleWith fills their poses', () => {
  const zone = buildBigZone(new THREE.Scene());
  const dolls = [spot('octopus', 0, 0, 0, 0), spot('octopus', 0.2, 0.1, 0, null), spot('octopus', -0.2, 0.1, 0, null)];
  zone.setContents('C-6', dolls);
  expect(zone.unsettled('C-6').map((d) => d[12])).toEqual([dolls[1][12], dolls[2][12]]);
  zone.settleWith('C-6', [{ uid: dolls[1][12], p: [0.21, 0.9, 0.11], q: [0, 0.707, 0, 0.707] }]);
  expect(zone.unsettled('C-6').map((d) => d[12])).toEqual([dolls[2][12]]);
  const settled = zone.contentsOf('C-6').find((d) => d[12] === dolls[1][12])!;
  expect(settled.slice(1, 8)).toEqual([0.21, 0.9, 0.11, 0, 0.707, 0, 0.707]);
});

// 한 판 동안 그 기계의 인형은 무더기에서 빠져 따로 그려지고(자세를 매 프레임 입힌다), 끝나면 무더기로 돌아간다
test('live mode draws a machine\'s dolls one by one and returns them to the pile', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  const dolls = nineDolls('octopus', 0);
  zone.setContents('C-6', dolls);
  zone.update(0);
  expect(zone.pileOf('C-6')).toHaveLength(9);
  const live = zone.live('C-6');
  zone.update(0.1);
  expect(zone.pileOf('C-6')).toHaveLength(0);
  const uid = dolls[3][12];
  live.set(uid, [0.1, 1.5, 0.2], [0, 0, 0, 1]);
  let found: THREE.Object3D | undefined;
  scene.traverse((o) => { if (o.userData.uid === uid) found = o; });
  expect(found!.position.y).toBeCloseTo(1.5);
  live.remove(uid); // 구멍에 빠진 인형: 숨긴다 (꼭짓점 범위가 0으로 접힌다)
  expect(found!.visible).toBe(false);
  live.dispose();
  zone.update(0.2);
  expect(zone.pileOf('C-6')).toHaveLength(9);
});

// 희귀가 든 기계 위에는 '★ 희귀'/'★★ 황금' 이름표와 제자리 별 반짝임 — 날벌레처럼 도는 점은 없다 (교환소 개편 설계 §4.7.1)
test('machines holding a rare show a name tag and twinkles above them', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  const count = (prefix: string) => { let n = 0; scene.traverse((o) => { if (o.name.startsWith(prefix) && o.visible) n += (o as THREE.InstancedMesh).count; }); return n; };
  zone.setContents('A-1', [spot('bunny', 0, 0, 0, 0, { rare: 'star' })]);
  zone.update(0);
  expect([count('rare-tags-rare'), count('rare-tags-gold')]).toEqual([1, 0]);
  expect(count('rare-twinkles')).toBe(3);
  zone.setContents('A-2', [spot('fox', 0, 0, 0, 0, { rare: 'gold' })]);
  zone.update(0.1);
  expect([count('rare-tags-rare'), count('rare-tags-gold')]).toEqual([1, 1]);
  zone.setContents('A-1', [spot('bunny', 0, 0, 0)]);
  zone.setContents('A-2', [spot('fox', 0, 0, 0)]);
  zone.update(0.2);
  expect(count('rare-tags') + count('rare-twinkles')).toBe(0);
  expect(scene.getObjectByName('rare-sparkles-big-wall')).toBeUndefined();
});

test('chubby dolls are drawn wider', () => {
  const width = (body: 'n' | 'c' | 's') => {
    const scene = new THREE.Scene();
    const zone = buildBigZone(scene);
    zone.setContents('C-6', [spot('bear', 0, 0, 0, 0, { body })]);
    zone.update(0);
    return new THREE.Box3().setFromObject(scene.getObjectByName('dolls-big-island-0')!).getSize(new THREE.Vector3()).x;
  };
  expect(width('c')).toBeGreaterThan(width('n') * 1.08);
  expect(width('s')).toBeLessThan(width('n') * 0.94);
});

// 다람쥐는 줄무늬 그림이 있어도 색마다 재질이 따로 생기지 않는다 — 무늬는 무채색 한 장, 색은 꼭짓점 색으로 (최종 리뷰 I2)
test('squirrels of every color share one striped material', () => {
  const count = (colors: number[]) => {
    const scene = new THREE.Scene();
    const zone = buildBigZone(scene);
    zone.setContents('A-10', colors.map((c, i) => spot('squirrel', -0.3 + (i % 3) * 0.25, -0.25 + Math.floor(i / 3) * 0.22, i, 0, { color: c })));
    zone.update(0);
    return materialsIn(scene, 'dolls-big-wall-1');
  };
  expect(count([0, 1, 2, 3, 4, 5])).toBe(count([0, 0, 0, 0, 0, 0]));
});

// 인형 겉모습마다 합쳐 둔 모양은 끝없이 쌓이지 않는다 — 오래 하면 휴대폰 메모리가 넘친다 (최종 리뷰 M7)
test('baked doll shapes are kept to a bounded number', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  const kinds = MACHINES.map((m) => m.kind);
  for (let round = 0; round < 60; round++) {
    zone.setContents('C-6', Array.from({ length: 9 }, (_, i) => spot(kinds[(round * 9 + i) % kinds.length], (i % 3) * 0.2 - 0.2, Math.floor(i / 3) * 0.2 - 0.2, 0, 0, { color: (round + i) % 6, face: Math.floor(round / 6) % 5 })));
    zone.update(round);
  }
  expect(liteCacheSize()).toBeLessThanOrEqual(LITE_CACHE_MAX);
  expect(LITE_CACHE_MAX).toBeLessThan(500);
});
