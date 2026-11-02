import { expect, test } from 'vitest';
import { MACHINE_SPEC } from '../data/storeLayout';
import { CLAW_EDGE, PlaySession } from './playSession';

// 레버(조이스틱) 1개 + 하강 버튼 1개 (설계 2026-10-31 §3.10, 3차 결정): 집게는 상품 구멍 위에서 시작해 레버로 자유롭게 움직인다
test('the claw starts above the prize hole', () => {
  expect(new PlaySession('A-1', 20, 0).claw).toEqual({ x: MACHINE_SPEC.hole[0], z: MACHINE_SPEC.hole[1] });
});

test('the lever moves the claw freely at claw speed inside the play area', () => {
  const s = new PlaySession('A-1', 20, 0);
  const x0 = s.claw.x, z0 = s.claw.z;
  s.update(1, { x: 1, z: 0 }, 1); expect(s.claw.x).toBeCloseTo(x0 + MACHINE_SPEC.claw_speed);
  s.update(0.5, { x: 0, z: -1 }, 1.5); expect(s.claw.z).toBeCloseTo(z0 - MACHINE_SPEC.claw_speed * 0.5);
  s.update(1, { x: -1, z: 0 }, 2.5); expect(s.claw.x).toBeCloseTo(x0); // 되돌아갈 수도 있다
  s.update(10, { x: 1, z: 1 }, 3); expect(s.claw).toEqual({ x: MACHINE_SPEC.play_half[0] - CLAW_EDGE, z: MACHINE_SPEC.play_half[1] - CLAW_EDGE }); // 벌린 손가락이 유리를 뚫지 않게 벽에서 띄운다
});

test('drops once when time runs out', () => {
  const s = new PlaySession('A-1', 20, 0);
  expect(s.update(0.05, { x: 0, z: 0 }, 19.9)).toBeNull();
  expect(s.update(0.05, { x: 0, z: 0 }, 20.1)).toBe('drop');
  expect(s.update(0.05, { x: 0, z: 0 }, 20.3)).toBeNull();
  expect(s.requestDrop(20.3)).toBeNull();
});

// 느린 휴대폰(15fps)이나 숨긴 탭에서도 실제 시간으로 잰다 — 프레임 시간을 쌓으면 서버 마감(23초)을 넘긴다 (2단계 최종 리뷰 M2)
test('time runs on the wall clock, not on clamped frames', () => {
  const s = new PlaySession('A-1', 20, 100);
  expect(s.update(0.05, { x: 0, z: 0 }, 115)).toBeNull();
  expect(s.remaining).toBeCloseTo(5);
  expect(s.update(0.05, { x: 0, z: 0 }, 120.01)).toBe('drop');
});

test('pressing the drop button works once and stops the lever', () => {
  const s = new PlaySession('A-1', 20, 0);
  expect(s.requestDrop(3)).toBe('drop');
  expect(s.requestDrop(4)).toBeNull();
  const at = { ...s.claw };
  s.update(1, { x: 1, z: 0 }, 5);
  expect(s.claw).toEqual(at);
});

// 물리 뽑기 설계 §4.4: 내린 뒤에는 집게 한 바퀴(물리)가 돈다 — 레버는 더 이상 집게를 못 움직이고, 결과 대기는 보고(done)를 보낸 때부터 잰다
test('after the drop the lever no longer moves the claw and the phase is cycle', () => {
  const s = new PlaySession('A-1', 20, 0);
  s.update(1, { x: 1, z: 0 }, 1);
  const at = { ...s.claw };
  expect(s.phase).toBe('lever');
  expect(s.requestDrop(2)).toBe('drop');
  expect(s.phase).toBe('cycle');
  s.update(1, { x: -1, z: 0 }, 3);
  expect(s.claw).toEqual(at);
});

test('the result wait starts when the report is sent, not at the drop', () => {
  const s = new PlaySession('A-1', 20, 0);
  s.requestDrop(2);
  expect(s.resultOverdue(15)).toBe(false); // 한 바퀴(최대 15초)가 도는 중
  s.markDone(16);
  expect(s.resultOverdue(23)).toBe(false);
  expect(s.resultOverdue(24.5)).toBe(true);
});

// 미는 뽑기(설계 ring-hook §4): 집게는 늘 턱 위 놓는 자리(drop)에서 시작한다 — 잡은 인형을 놓고 돌아오는 곳
test('a pusher play starts above the drop spot', () => {
  const s = new PlaySession('P-1', 20, 0, { x: -0.34, z: -0.08 });
  expect(s.claw).toEqual({ x: -0.34, z: -0.08 });
});

// 사용자 2026-11-02(사진 205·206): 미는 뽑기 집게는 미는 쪽(턱 위)으로는 레버로 못 간다 — 놓을 때만 간다. 판을 시작하면 턱 위 쉬는 자리에서 칸으로
// 저절로 미끄러져 나가고(그동안 잡기는 안 먹음), 그 뒤로는 레버로 칸 안에서만 움직인다
test('a pusher claw glides off the ledge and stays over the pile', () => {
  const range = { x: [-0.06, 0.39] as [number, number], z: [-0.33, 0.33] as [number, number] };
  const s = new PlaySession('P-1', 20, 0, { x: -0.34, z: -0.08 }, range);
  expect(s.requestDrop(0)).toBeNull(); // 아직 턱 위
  s.update(0.5, { x: -1, z: 0 }, 0.5); // 왼쪽(턱 쪽)으로 밀어도 칸 쪽으로 나간다
  expect(s.claw.x).toBeGreaterThan(-0.34);
  s.update(1, { x: -1, z: 0 }, 1.5);
  expect(s.claw.x).toBeCloseTo(-0.06);
  s.update(1, { x: -1, z: 0 }, 2.5);
  expect(s.claw.x).toBeCloseTo(-0.06); // 턱 쪽으로 돌아가지 않는다
  s.update(1, { x: 1, z: 1 }, 3.5);
  expect(s.claw.z).toBeLessThanOrEqual(0.33);
  expect(s.requestDrop(3.5)).toBe('drop');
});
