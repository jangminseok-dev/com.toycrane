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
