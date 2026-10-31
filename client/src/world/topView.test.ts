import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { buildBigZone } from './bigZone';
import { TOP_LAYER, buildTopView, topViewCamera } from './topView';
import { spot } from '../test/spots';

beforeAll(stubCanvas);

// 위에서 본 화면 (설계 2026-10-31 §3.9): 기계 앞에서 보는 것과 같은 방향 — 화면 위쪽이 기계 안쪽, 오른쪽이 오른쪽
test('the top view looks straight down with the machine back at the top', () => {
  const anchor = new THREE.Group(); anchor.position.set(-4, 0, -6.55); anchor.rotation.y = Math.PI;
  anchor.updateMatrixWorld(true);
  const cam = topViewCamera(anchor);
  const screen = (x: number, z: number) => anchor.localToWorld(new THREE.Vector3(x, 1.0, z)).project(cam);
  const backRight = screen(0.3, -0.3), frontLeft = screen(-0.3, 0.3);
  expect(backRight.x).toBeGreaterThan(0.3); expect(backRight.y).toBeGreaterThan(0.3);
  expect(frontLeft.x).toBeLessThan(-0.3); expect(frontLeft.y).toBeLessThan(-0.3);
  expect(Math.abs(screen(0.5, 0.45).x)).toBeLessThanOrEqual(1); // 펠트 끝까지 화면 안
});

// 위에서 본 화면에는 기계 속 인형만(무거운 기계 몸통·다른 기계는 빼고) 그린다
test('doll piles are drawn on the top-view layer', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  zone.setContents('C-6', [spot('bear', 0, 0, 0)]);
  zone.update(0);
  const piles: THREE.Object3D[] = [];
  scene.traverse((o) => { if (o.parent?.name.startsWith('dolls-') && (o as THREE.Mesh).isMesh) piles.push(o); });
  expect(piles.length).toBeGreaterThan(0);
  const probe = new THREE.Layers(); probe.set(TOP_LAYER);
  expect(piles.every((m) => m.layers.test(probe))).toBe(true);
});

// 빛도 그 층에 켜야 위에서 본 화면의 인형이 검은 그림자로 나오지 않는다 (three.js는 카메라 층으로 빛도 거른다)
test('store lights also light the top view', () => {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(), new THREE.DirectionalLight());
  const fakeRenderer = { getRenderTarget: () => null, setRenderTarget: () => {}, render: () => {}, getClearColor: (c: THREE.Color) => c, setClearColor: () => {}, shadowMap: { autoUpdate: true } } as unknown as THREE.WebGLRenderer;
  const view = buildTopView(fakeRenderer, scene, new THREE.Group(), 0xffffff);
  const probe = new THREE.Layers(); probe.set(TOP_LAYER);
  for (const l of scene.children.filter((o) => (o as THREE.Light).isLight)) expect(l.layers.test(probe)).toBe(true);
  view.dispose();
});

// 구멍에 빠져 바닥 아래 받는 상자에 있는 인형은 모니터에 보이면 안 된다 — 카메라는 펠트 조금 아래까지만 본다
test('the top view does not see below the felt', () => {
  const anchor = new THREE.Group(); anchor.updateMatrixWorld(true);
  const cam = topViewCamera(anchor);
  const depth = (y: number) => anchor.localToWorld(new THREE.Vector3(0, y, 0)).project(cam).z;
  expect(Math.abs(depth(0.9))).toBeLessThan(1);
  expect(depth(0.3)).toBeGreaterThan(1);
});
