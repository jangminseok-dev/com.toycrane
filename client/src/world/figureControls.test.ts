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

// 사용자 2026-11-02(사진 221·222) '반짝이는 걸 더 잘 보이게 — 저걸 눌러야 하는구나': 지금 누를 버튼 둘레로 버튼 색 고리가 퍼져 나간다.
// 누르는 동안·집게가 도는 동안은 멈추고, 다른 버튼에는 없다. 반짝임도 한껏 밝아지는 때가 있다
test('the button to press next sends out rings', () => {
  const anchor = new THREE.Group();
  const c = buildFigureControls(anchor);
  const cue = (i: 1 | 2) => anchor.getObjectByName(`press-cue-${i}`)!;
  c.setPhase('one');
  c.update(0.3);
  expect(cue(1).visible).toBe(true); expect(cue(2).visible).toBe(false);
  const sizes = [0.1, 0.4, 0.7].map((t) => { c.update(t); return cue(1).children[0].scale.x; });
  expect(new Set(sizes.map((s) => s.toFixed(2))).size).toBe(3); // 퍼진다
  expect(Math.max(...[0, 0.05, 0.1, 0.15, 0.2, 0.25].map((t) => { c.update(t); return c.glow(1); }))).toBeGreaterThanOrEqual(1);
  c.setPhase('moving-one'); c.update(1);
  expect(cue(1).visible).toBe(false); // 누르는 동안은 멈춤
  c.setPhase('two'); c.update(1.2);
  expect(cue(2).visible).toBe(true); expect(cue(1).visible).toBe(false);
  c.setPhase('cycle'); c.update(1.4);
  expect(cue(2).visible).toBe(false);
});
