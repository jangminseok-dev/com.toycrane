import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { HOOK, ringSideOf } from '../data/hooks';
import { RINGS } from '../data/rings';
import { hingeOf } from '../physics/hookWorld';
import { stubCanvas } from '../test/canvasStub';
import { buildHookZone } from './hookZone';

beforeAll(stubCanvas);

// 고리 걸기 10대(계획 12 Task 6): 줄마다 몸통·속을 합쳐 굽고 상자·고리 판·집게·버튼은 인스턴스 — 메시 64개 이하
test('ten hook machines draw in a few meshes', () => {
  const scene = new THREE.Scene(), zone = buildHookZone(scene);
  let n = 0;
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; });
  expect(n).toBeLessThanOrEqual(64); // 피규어 구역과 같은 기준(고리 판 인스턴스 둘이 상자 기계 공용에 더해짐)
  for (const r of RINGS) expect([zone.worldOf(r.id).position.x, zone.worldOf(r.id).position.z]).toEqual([r.x, r.z]);
});

// 그림의 고리 날개는 물리와 같은 쪽(r1 오른쪽, r2 왼쪽)에, 상자를 옮기면 날개도 따라간다
test('the ring tab is drawn on the side the world uses', () => {
  const scene = new THREE.Scene(), zone = buildHookZone(scene);
  for (const id of ['R-1', 'R-6']) {
    const flaps = scene.getObjectsByProperty('isInstancedMesh', true).filter((o) => (o as THREE.InstancedMesh).count === 5 && o.parent?.name === `hook-row-${RINGS.find((r) => r.id === id)!.row}`) as THREE.InstancedMesh[];
    expect(flaps.length).toBeGreaterThan(0);
    zone.setBox(id, [0.1, HOOK.shelf.y + HOOK.box.h / 2, 0, 0, 0, 0, 1]);
    const side = ringSideOf(id), hinge = hingeOf(side).at;
    expect(side).toBe(id === 'R-1' ? 'right' : 'left');
    expect(Math.sign(hinge[0])).toBe(side === 'right' ? 1 : -1);
  }
});

// 고리 걸기 집게 스티커는 '피규어'가 아니라 '고리'(Task 14) — 집게 색은 피규어와 같은 진한 색
test('the hook claw sticker says ring, not figure', () => {
  const scene = new THREE.Scene();
  buildHookZone(scene);
  expect((scene.getObjectByName('hook-claw-stickers') as THREE.InstancedMesh).material).toMatchObject({ userData: { text: '고리' } });
  expect(((scene.getObjectByName('hook-claw-arms') as THREE.InstancedMesh).material as THREE.MeshToonMaterial).transparent).toBe(false);
});

// 선반을 둘러싼 투명판(앞·옆·뒤)은 없앤다(사용자 2026-11-02 사진 226 '저 유리가 어떤 기능을 해?') — 선반이 기계 옆벽·뒤 진열대까지
// 닿아 옆·뒤로 떨어질 곳이 없고, 막는 물리 벽은 기계 유리·진열 상자 자리에 있다. 선반 위 공간에 투명한 것이 서 있지 않다
test('no glass panes stand around the hook shelf', async () => {
  const { makeHookMachineParts } = await import('./hookMachine');
  const { CABINET_INNER } = await import('../physics/figureClaw');
  const { shelf, exit } = HOOK;
  expect(shelf.half_x).toBeGreaterThanOrEqual(CABINET_INNER - 0.03);
  expect(shelf.back_z).toBeLessThanOrEqual(-0.36); // 진열대 앞면까지
  expect(exit.front_z).toBeGreaterThanOrEqual(0.45); // 기계 앞 유리 바로 안쪽까지
  const { statics } = makeHookMachineParts(RINGS[0], 0xff8a3d);
  statics.position.set(0, 0, 0); statics.rotation.set(0, 0, 0); statics.updateMatrixWorld(true);
  const above = new THREE.Box3(new THREE.Vector3(-shelf.half_x + 0.01, shelf.y + 0.02, shelf.back_z + 0.01), new THREE.Vector3(shelf.half_x - 0.01, shelf.y + 0.4, exit.front_z - 0.01));
  const glass: string[] = [];
  statics.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.name === 'glass') return; // 몸통 유리(기계 가장자리 — 경계 상자는 몸통 전체라 빼고 본다)
    if (m.isMesh && (m.material as THREE.Material).transparent && new THREE.Box3().setFromObject(m).intersectsBox(above)) glass.push(m.name || m.geometry.type);
  });
  expect(glass).toEqual([]);
});
