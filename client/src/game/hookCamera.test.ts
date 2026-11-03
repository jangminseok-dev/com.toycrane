import * as THREE from 'three';
import { expect, test } from 'vitest';
import { FIGURE } from '../data/figures';
import { HOOK } from '../data/hooks';
import { RINGS } from '../data/rings';
import { FIGURE_CONTROLS } from '../world/figureControls';
import { figureCameraPose } from './figureCamera';
import { HOOK_MACHINE } from './hookPlay';

// 고리 걸기 시점(사용자 2026-11-02 사진 208: ①을 떼고 옆 시점이 되면 버튼이 화면 아래에 잘려 ②를 누를 수 없었다) —
// 정면·옆 모두 상자와 버튼 둘이 PC(가로 1.6~1.9)·휴대폰(세로) 화면 안에, 집게가 쉬는 높이도 화면 안에
const spot = RINGS[2];
const toWorld = (p: readonly [number, number, number]) => new THREE.Vector3(...p).applyAxisAngle(new THREE.Vector3(0, 1, 0), spot.ry).add(new THREE.Vector3(spot.x, 0, spot.z));
const BOX = toWorld([0, HOOK.shelf.y + HOOK.box.h / 2, HOOK.start.z]);
const CLAW_TOP = toWorld([0, FIGURE.claw.rest_y, HOOK.start.z]); // ②로 안쪽으로 옮기는 동안 집게와 고리를 함께 본다
function onScreen(side: number, aspect: number, p: THREE.Vector3): boolean {
  const cam = new THREE.PerspectiveCamera(aspect < 1 ? 60 : 45, aspect, 0.1, 100), pose = figureCameraPose(spot, side, aspect, HOOK_MACHINE.camera);
  cam.position.copy(pose.pos); cam.lookAt(pose.look); cam.updateMatrixWorld(true);
  const n = p.clone().project(cam);
  return Math.abs(n.x) <= 0.92 && n.y >= -0.9 && n.y <= 0.9 && n.z < 1;
}

test('the hook machine keeps the box and both buttons on screen from the front and the side', () => {
  for (const side of [0, 1]) for (const aspect of [1.6, 1.86, 390 / 844]) {
    expect(onScreen(side, aspect, BOX), `box ${side} ${aspect}`).toBe(true);
    expect(onScreen(side, aspect, toWorld(FIGURE_CONTROLS.one)), `one ${side} ${aspect}`).toBe(true);
    expect(onScreen(side, aspect, toWorld(FIGURE_CONTROLS.two)), `two ${side} ${aspect}`).toBe(true);
    expect(onScreen(side, aspect, CLAW_TOP), `claw ${side} ${aspect}`).toBe(true);
  }
});

// 옆 시점은 피규어처럼 옆면이 보이게(사용자 2026-11-03 사진: 39°는 너무 대각선) — 정면에서 60° 넘게 돌아가고,
// 카메라에서 상자·버튼·집게로 가는 시선이 오른쪽 옆 기계(R-4) 몸통을 뚫지 않는다. 몸통은 machine.ts 치수: 폭 1.26m, 아래 몸통·조작대(높이 0.95m까지) 앞 끝 0.77m,
// 그 위 유리 칸·간판은 앞 0.56m까지, 높이 2.45m
test('the hook side view looks from well to the side without looking through the next machine', () => {
  const next = RINGS[3];
  expect(next.row).toBe(spot.row);
  const local = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), next.ry).add(new THREE.Vector3(next.x, 0, next.z));
  const cabinet = [new THREE.Box3().setFromPoints([local(-0.63, 0, -0.555), local(0.63, 0.95, 0.77)]), new THREE.Box3().setFromPoints([local(-0.63, 0.95, -0.555), local(0.63, 2.45, 0.56)])];
  for (const aspect of [1.86, 390 / 844]) {
    const pose = figureCameraPose(spot, 1, aspect, HOOK_MACHINE.camera), front = figureCameraPose(spot, 0, aspect, HOOK_MACHINE.camera);
    const toLook = (p: { pos: THREE.Vector3; look: THREE.Vector3 }) => new THREE.Vector2(p.pos.x - p.look.x, p.pos.z - p.look.z);
    const turned = (Math.abs(toLook(pose).angle() - toLook(front).angle()) * 180) / Math.PI;
    expect(turned, `angle ${aspect}`).toBeGreaterThan(60);
    expect(cabinet.some((b) => b.containsPoint(pose.pos)), `camera inside ${aspect}`).toBe(false);
    for (const [name, p] of [['box', BOX], ['one', toWorld(FIGURE_CONTROLS.one)], ['two', toWorld(FIGURE_CONTROLS.two)], ['claw', CLAW_TOP]] as const) {
      for (const b of cabinet) {
        const hit = new THREE.Ray(pose.pos, p.clone().sub(pose.pos).normalize()).intersectBox(b, new THREE.Vector3());
        expect(hit === null || hit.distanceTo(pose.pos) > p.distanceTo(pose.pos), `${name} ${aspect}`).toBe(true);
      }
    }
  }
});

// 옆 시점에서 상자가 유리 칸 앞 오른쪽 기둥(기계 안 x 0.57, z 0.5) 뒤에 숨지 않는다 — 시작 자리부터 집게가 끌고 가는 앞 왼쪽(집 −0.44, 0.34)까지.
// 사진(2026-11-03 휴대폰 R-8, 62° 시점): 앞 왼쪽으로 끌려온 상자가 기둥 뒤에 거의 다 가렸다. 시선이 기둥 가운데에서 8cm 넘게 비켜 가면 기둥(굵기 3cm)은 상자 끝만 스친다
test('the hook box stays clear of the front post from the side on its way to the front left', () => {
  const post = toWorld([0.57, 0, 0.5]);
  const path = [[0, -0.1], [0.15, -0.1], [-0.15, -0.05], [-0.3, 0], [-0.44, 0.05], [0, 0.05], [-0.2, -0.25]] as const;
  for (const aspect of [1.86, 390 / 844]) {
    const eye = figureCameraPose(spot, 1, aspect, HOOK_MACHINE.camera).pos, a = new THREE.Vector2(eye.x, eye.z), c = new THREE.Vector2(post.x, post.z);
    for (const [x, z] of path) {
      const box = toWorld([x, 0, z]), d = new THREE.Vector2(box.x, box.z).sub(a), t = c.clone().sub(a).dot(d) / d.lengthSq();
      const passes = t <= 0 || t >= 1 ? Infinity : a.clone().add(d.multiplyScalar(t)).distanceTo(c);
      expect(passes, `${x},${z} ${aspect}`).toBeGreaterThan(0.08);
    }
  }
});
