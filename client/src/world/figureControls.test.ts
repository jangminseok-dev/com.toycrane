import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { FIGURE_CONTROLS, buildFigureControls } from './figureControls';

beforeAll(stubCanvas);

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

// 버튼이 무엇을 하는지 바로 알게(인형 기계 '잡기'처럼, 사용자 2026-11-02): ①은 '오른쪽'과 오른쪽 화살표, ②는 '안쪽'과 기계 안쪽(위) 화살표.
// 글씨는 버튼과 함께 눌려 들어가고 윗면 밖으로 삐져나가지 않는다
test('each button reads what it does and sinks with the button', () => {
  const anchor = new THREE.Group();
  const c = buildFigureControls(anchor);
  const labels = [1, 2].map((b) => anchor.getObjectByName(`figure-label-${b}`) as THREE.Mesh);
  expect(labels.map((l) => l?.userData.text)).toEqual(['오른쪽', '안쪽']);
  anchor.updateMatrixWorld(true);
  const y0 = labels[1].getWorldPosition(new THREE.Vector3()).y;
  c.setPressed(2); anchor.updateMatrixWorld(true);
  expect(labels[1].getWorldPosition(new THREE.Vector3()).y).toBeLessThan(y0 - 0.005);
  for (const l of labels) {
    l.geometry.computeBoundingBox();
    const size = l.geometry.boundingBox!.getSize(new THREE.Vector3());
    expect(Math.max(size.x, size.y)).toBeLessThanOrEqual(0.8 * 2 * 0.055 + 1e-9);
  }
});
