import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { MACHINES } from '../data/storeLayout';
import { stubCanvas } from '../test/canvasStub';
import { buildBigZone } from './bigZone';

beforeAll(stubCanvas);

test('big zone builds 35 machines in two fade rows', () => {
  const zone = buildBigZone(new THREE.Scene());
  expect(zone.occluders).toHaveLength(2);
  expect(MACHINES.every((m) => zone.worldOf(m.id))).toBe(true);
});

test('setContents skips unknown dolls', () => {
  const zone = buildBigZone(new THREE.Scene());
  expect(() => {
    zone.setContents('A-1', [['bunny', 0, 0, 0], ['gone-doll', 0.1, 0.1, 0]]);
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

// 기계 하나 결과마다 행 전체(섬 198개 인형)를 다시 합치면 휴대폰이 멈춘다 — 그 기계가 든 묶음만 다시 합친다 (최종 리뷰 I5)
test('a contents change rebuilds only its block of machines', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  for (const m of MACHINES) zone.setContents(m.id, [['bear', 0, 0, 0]]);
  zone.update(0);
  const groups: THREE.Object3D[] = [];
  scene.traverse((o) => { if (o.name.startsWith('dolls-')) groups.push(o); });
  const blocks = () => groups.map((b) => b.children.slice());
  const before = blocks();
  zone.setContents('C-6', [['cat', 0.1, 0.1, 0]]);
  zone.update(0.1);
  const after = blocks();
  const changed = before.filter((meshes, i) => meshes.some((m, k) => m !== after[i][k]));
  expect(changed).toHaveLength(1);
  expect(groups.length).toBeGreaterThanOrEqual(6);
});

// 서버가 정한 얹힌 높이(y)대로 그린다 — 위층 인형이 바닥 인형보다 높이 있다
test('dolls are drawn at their resting height', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  zone.setContents('C-6', [['bear', 0, 0, 0, 0.22]]);
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
