import { expect, test, vi } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { DollStage, ViewerSpin, sharedRenderer } from './dollViewer';

stubCanvas();
// 가방 인형 크게 보기(설계 2026-11-24 bag-viewer-new): 좌우로 끌면 360도 넘게 계속 돌고, 위아래는 ±20°, 확대는 1~2배, 손대기 전엔 천천히 저절로 돈다
test('dragging spins all the way round, tilt and zoom are clamped', () => {
  const s = new ViewerSpin();
  for (let i = 0; i < 10; i++) s.drag(100, 0);
  expect(s.yaw).toBeGreaterThan(Math.PI * 2);
  s.drag(0, 10_000); expect(s.pitch).toBeCloseTo((20 * Math.PI) / 180);
  s.drag(0, -20_000); expect(s.pitch).toBeCloseTo((-20 * Math.PI) / 180);
  s.pinch(10); expect(s.zoom).toBe(2);
  s.pinch(0.01); expect(s.zoom).toBe(1);
  s.wheel(-500); expect(s.zoom).toBeGreaterThan(1);
});

test('it turns by itself until touched', () => {
  const s = new ViewerSpin();
  s.tick(1); expect(s.yaw).toBeGreaterThan(0);
  const y = s.yaw; s.drag(0, 0); s.tick(1);
  expect(s.yaw).toBe(y);
});

// 검토(2026-11-25): 열 때마다 렌더러를 새로 만들고 버리면, three가 함께 쓰는 인형 자원에 붙인 dispose 수신기가 버린 렌더러를 붙잡아
// 열고 닫을수록 메모리가 는다 — 렌더러는 하나만 만들어 계속 쓰고, 닫을 땐 인형을 빼고 그림판을 줄인다
test('the viewer makes one renderer and reuses it', () => {
  let made = 0;
  const make = () => { made++; return { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), dispose: vi.fn(), forceContextLoss: vi.fn() }; };
  const a = sharedRenderer(make), b = sharedRenderer(make);
  expect(made).toBe(1);
  expect(a).toBe(b);
});

test('closing the stage removes the doll and shrinks the renderer without destroying it', () => {
  const renderer = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), dispose: vi.fn(), forceContextLoss: vi.fn() };
  const stage = new DollStage(renderer, { doll: 'bear', color: 2, rare: 'star' });
  expect(stage.hasDoll()).toBe(true);
  stage.frame(0.016);
  expect(renderer.render).toHaveBeenCalledTimes(1);
  stage.dispose();
  expect(stage.hasDoll()).toBe(false);
  expect(renderer.dispose).not.toHaveBeenCalled();
  expect(renderer.setSize).toHaveBeenLastCalledWith(1, 1, false);
});
