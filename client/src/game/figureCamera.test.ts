import * as THREE from 'three';
import { expect, test } from 'vitest';
import { FIGURE, FIGURES } from '../data/figures';
import { FIGURE_CONTROLS } from '../world/figureControls';
import { SideBlend, figureCameraPose } from './figureCamera';

// 9단계 피규어 시점(설계 §3.3.1): ①은 정면, ①을 떼면 옆 대각선 — 상자와 누를 버튼이 PC(가로)·휴대폰(세로) 화면 안에
const spot = FIGURES[3];
const toWorld = (p: readonly [number, number, number]) => new THREE.Vector3(...p).applyAxisAngle(new THREE.Vector3(0, 1, 0), spot.ry).add(new THREE.Vector3(spot.x, 0, spot.z));
const BOX = toWorld([0, FIGURE.bars.y + 0.04, 0]);
function onScreen(side: number, aspect: number, p: THREE.Vector3): boolean {
  const cam = new THREE.PerspectiveCamera(45, aspect, 0.1, 100), pose = figureCameraPose(spot, side, aspect);
  cam.position.copy(pose.pos); cam.lookAt(pose.look); cam.updateMatrixWorld(true);
  const n = p.clone().project(cam);
  return Math.abs(n.x) <= 0.95 && Math.abs(n.y) <= 0.95 && n.z < 1;
}

test('front view shows the box and both buttons on wide and tall screens', () => {
  for (const aspect of [1.6, 390 / 844]) {
    expect(onScreen(0, aspect, BOX), `box ${aspect}`).toBe(true);
    expect(onScreen(0, aspect, toWorld(FIGURE_CONTROLS.one)), `one ${aspect}`).toBe(true);
    expect(onScreen(0, aspect, toWorld(FIGURE_CONTROLS.two)), `two ${aspect}`).toBe(true);
  }
});

test('button two stays on screen from the side', () => {
  for (const aspect of [1.6, 390 / 844]) {
    expect(onScreen(1, aspect, BOX), `box ${aspect}`).toBe(true);
    expect(onScreen(1, aspect, toWorld(FIGURE_CONTROLS.two)), `two ${aspect}`).toBe(true);
  }
});

test('side view looks across the bars from the right', () => {
  for (const aspect of [1.6, 390 / 844]) {
    const f = figureCameraPose(spot, 0, aspect), s = figureCameraPose(spot, 1, aspect);
    const dir = (p: { pos: THREE.Vector3; look: THREE.Vector3 }) => p.look.clone().sub(p.pos).setY(0).normalize();
    expect(THREE.MathUtils.radToDeg(dir(f).angleTo(dir(s)))).toBeGreaterThan(30);
  }
});

test('blend moves only between presses', () => {
  const b = new SideBlend();
  expect(b.value(5)).toBe(0);
  b.start(10);
  expect(b.value(10.3)).toBeGreaterThan(0); expect(b.value(10.3)).toBeLessThan(1);
  expect(b.value(10.6)).toBe(1);
  b.stop(20);
  expect(b.value(20.6)).toBe(0);
});
