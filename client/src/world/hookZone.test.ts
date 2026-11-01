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
