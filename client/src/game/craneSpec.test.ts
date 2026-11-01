import { expect, test } from 'vitest';
import { CLAW } from '../data/claw';
import { PUSHER } from '../data/pushers';
import { MACHINE_SPEC } from '../data/storeLayout';
import { DOLL_FLOOR, DOLL_SCALE } from '../world/machine';
import { craneSpec } from './craneSpec';

// 설계 ring-hook §4: 미는 뽑기는 미니 인형, 집게는 턱 위 놓는 자리에서 서고 늘 그리로 옮겨 놓으며, 판이 다 밀 때까지 기다리고, 조금 더 잘 잡는다
test('pusher machines use mini dolls, start and drop on the ledge and wait for the plate', () => {
  const p = craneSpec('P-1'), d = craneSpec('A-1');
  expect([p.pusher, d.pusher]).toEqual([true, false]);
  expect([p.dollScale, d.dollScale]).toEqual([PUSHER.doll_scale, DOLL_SCALE]);
  expect(p.start).toEqual({ x: PUSHER.drop[0], z: PUSHER.drop[1] });
  expect(d.start).toEqual({ x: MACHINE_SPEC.hole[0], z: MACHINE_SPEC.hole[1] });
  expect([p.rest.x, p.rest.z]).toEqual(PUSHER.drop);
  expect(p.cycle).toEqual({ carryTo: p.start, settle: PUSHER.settle, baseForce: CLAW.base_force * PUSHER.grip });
  expect(d.cycle).toEqual({});
  expect(p.floorAt(-0.34, 0)).toBeCloseTo(DOLL_FLOOR + PUSHER.ledge.h);
  expect(p.floorAt(-0.34, -0.3)).toBeCloseTo(DOLL_FLOOR + PUSHER.ledge.h + PUSHER.plate.h); // 판 집 위
  expect(p.floorAt(0.2, 0)).toBe(DOLL_FLOOR);
  expect(d.floorAt(-0.34, 0)).toBe(DOLL_FLOOR);
});
