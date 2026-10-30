import { expect, test } from 'vitest';
import { LocalPlayer } from './localPlayer';

test('tick moves along dir, correct snaps to server position', () => {
  const me = new LocalPlayer({ x: 0, z: 3 });
  me.dir = { x: 1, z: 0 };
  me.tick(0.5);
  expect(me.pos).toEqual({ x: 1.6, z: 3 });
  me.correct({ x: -2, z: 4 });
  expect(me.pos).toEqual({ x: -2, z: 4 });
});

// 줄 자리처럼 정해진 곳으로는 입력 없이 걸어가고, 그 자리에서 멈춘다(넘어가지 않음)
test('auto target walks toward it and stops there', () => {
  const p = new LocalPlayer({ x: 5, z: 5 });
  p.autoTarget = { x: 6, z: 5 };
  p.drive({ x: 0, z: 0 }, 0.25);
  expect(p.pos.x).toBeCloseTo(5.8); expect(p.dir).toEqual({ x: 1, z: 0 });
  p.drive({ x: 0, z: 0 }, 0.25);
  expect(p.pos.x).toBeCloseTo(6);
  p.drive({ x: 0, z: 0 }, 0.25);
  expect(p.dir).toEqual({ x: 0, z: 0 });
});

test('hand input wins over the auto target', () => {
  const p = new LocalPlayer({ x: 5, z: 5 });
  p.autoTarget = { x: 6, z: 5 };
  p.drive({ x: 0, z: 1 }, 0.25);
  expect(p.pos).toEqual({ x: 5, z: 5.8 });
});
