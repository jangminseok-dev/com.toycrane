import * as THREE from 'three';
import { expect, test } from 'vitest';
import { FIGURE_CONTROLS, buildFigureControls } from './figureControls';

// 9단계 피규어 조작대 버튼 ①(빨강) ②(파랑): 손가락·마우스로 누르는 진짜 버튼 — 지금 누를 버튼만 빛난다
test('picks button one and two and lights the next one', () => {
  const anchor = new THREE.Group();
  anchor.position.set(13.2, 0, 2.7); anchor.rotation.y = -Math.PI / 2;
  const c = buildFigureControls(anchor);
  anchor.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  for (const [b, at] of [[1, FIGURE_CONTROLS.one], [2, FIGURE_CONTROLS.two]] as const) {
    const p = anchor.localToWorld(new THREE.Vector3(at[0], at[1], at[2]));
    ray.set(p.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, -1, 0));
    expect(c.pick(ray)).toBe(b);
  }
  ray.set(anchor.localToWorld(new THREE.Vector3(-0.4, 2, 0)), new THREE.Vector3(0, -1, 0));
  expect(c.pick(ray)).toBeNull();
  c.setPhase('one'); c.update(0.2);
  expect(c.glow(1)).toBeGreaterThan(0); expect(c.glow(2)).toBe(0);
  c.setPhase('two'); c.update(0.2);
  expect(c.glow(1)).toBe(0); expect(c.glow(2)).toBeGreaterThan(0);
  c.setPressed(2);
  expect(c.domeY(2)).toBeLessThan(FIGURE_CONTROLS.two[1]);
  c.dispose();
  expect(anchor.children).toHaveLength(0);
});
