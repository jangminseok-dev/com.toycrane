import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { MACHINES } from '../data/storeLayout';
import { stubCanvas } from '../test/canvasStub';
import { buildBigZone } from './bigZone';
import { CONTROLS } from './machine';

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
