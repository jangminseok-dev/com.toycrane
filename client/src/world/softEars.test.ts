import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { makeDoll } from './dolls';
import { bendEars } from './softEars';

beforeAll(stubCanvas);

// 귀는 단단한 벽이 아니라 말랑한 부분: 손가락이 닿으면 바깥으로 휘었다가, 떨어지면 돌아온다 (설계 2026-10-31 §3.6)
test('an ear touched by a finger bends outward and springs back', () => {
  const bear = makeDoll('bear')!;
  const ear = bear.children.find((o) => o.name === 'ear')!;
  const base = ear.position.clone();
  const probe = new THREE.Object3D();
  probe.position.copy(ear.position); bear.add(probe); bear.updateMatrixWorld(true);
  for (let i = 0; i < 30; i++) bendEars(bear, [probe], 1 / 60);
  expect(ear.position.distanceTo(base)).toBeGreaterThan(0.02);
  for (let i = 0; i < 90; i++) bendEars(bear, [], 1 / 60);
  expect(ear.position.distanceTo(base)).toBeLessThan(0.002);
});
