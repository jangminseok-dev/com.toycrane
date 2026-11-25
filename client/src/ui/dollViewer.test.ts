import { expect, test, vi } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { DollStage, ViewerSpin } from './dollViewer';

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

// 닫을 때 그래픽 자원을 모두 버린다 — 열고 닫기를 여러 번 해도 휴대폰 메모리가 남지 않게
test('closing the stage disposes the renderer and the doll', () => {
  const renderer = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), dispose: vi.fn(), forceContextLoss: vi.fn() };
  const stage = new DollStage(renderer, { doll: 'bear', color: 2, rare: 'star' });
  expect(stage.hasDoll()).toBe(true);
  stage.frame(0.016);
  expect(renderer.render).toHaveBeenCalledTimes(1);
  stage.dispose();
  expect(renderer.dispose).toHaveBeenCalled();
  expect(renderer.forceContextLoss).toHaveBeenCalled();
  expect(stage.hasDoll()).toBe(false);
});
