import { expect, test } from 'vitest';
import { clawPath } from './clawPath';

// 내려가는 동안(k 0~1) 앞쪽 60%에 걸쳐, 노린 자리에서 서버가 정한 실제 자리로 흔들리며 옮겨 간다
test('claw starts where I aimed and settles where it landed', () => {
  const from = { x: 0, z: 0 }, to = { x: 0.05, z: -0.03 };
  expect(clawPath(from, to, 0)).toEqual(from);
  const end = clawPath(from, to, 0.6);
  expect(end.x).toBeCloseTo(0.05); expect(end.z).toBeCloseTo(-0.03);
  expect(clawPath(from, to, 1)).toEqual(end);
});

test('claw wobbles on the way, even when it lands right on the aim', () => {
  const p = clawPath({ x: 0.1, z: 0.1 }, { x: 0.1, z: 0.1 }, 0.1);
  expect(Math.hypot(p.x - 0.1, p.z - 0.1)).toBeGreaterThan(0.005);
});
