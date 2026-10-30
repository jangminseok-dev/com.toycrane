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
