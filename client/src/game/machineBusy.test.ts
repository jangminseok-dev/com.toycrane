import { expect, test } from 'vitest';
import { MachineBusy } from './machineBusy';

// 남이 하는 기계: 그 판이 끝날 시간(20초 + 여유 3초)이 지나면 버튼을 다시 보여 서버의 만료 인수가 동작하게 (최종 리뷰 I3)
test('busy machine frees itself after the round time runs out', () => {
  const b = new MachineBusy(20, 20);
  b.set('A-1', 'p1', 100);
  expect(b.who('A-1', 110)).toBe('p1');
  expect(b.who('A-1', 123.5)).toBeNull();
});

test('a leaving player clears their machine', () => {
  const b = new MachineBusy(20, 20);
  b.set('A-1', 'p1', 100); b.set('A-2', 'p2', 100);
  b.clearPlayer('p1');
  expect(b.who('A-1', 101)).toBeNull();
  expect(b.who('A-2', 101)).toBe('p2');
});

// 판이 끝나도 그 사람이 이어서 할 수 있게 서버가 20초 자리를 잡아 둔다 — 남의 화면도 그동안 "하는 중"
test('a finished round keeps the machine for the player during the hold time', () => {
  const b = new MachineBusy(20, 20);
  b.set('A-1', 'p1', 100);
  b.hold('A-1', 'p1', 110);
  expect(b.who('A-1', 129)).toBe('p1');
  expect(b.who('A-1', 130.5)).toBeNull();
});

// 물리 뽑기 설계 §4.4: 남이 하는 기계는 레버 시간 + 집게 한 바퀴(12초) + 멈춤 대기(3초) + 여유 동안 "하는 중"
test('a machine stays busy through the claw cycle and settle time', () => {
  const b = new MachineBusy(20, 20, 15);
  b.set('A-1', 'p1', 0);
  expect(b.who('A-1', 20 + 15 + 2)).toBe('p1');
  expect(b.who('A-1', 20 + 15 + 4)).toBeNull();
});

// 미는 뽑기는 놓은 뒤 판이 다 밀 때까지 더 기다린다(서버 play_rules와 같은 종류별 여유) — 인형 기계는 짧은 여유 그대로
test('each machine keeps its own claw cycle time', () => {
  const busy = new MachineBusy(20, 20, (id) => (id.startsWith('P-') ? 27 : 15));
  busy.set('A-1', 'p1', 0); busy.set('P-1', 'p2', 0);
  expect(busy.who('A-1', 38.5)).toBeNull();
  expect(busy.who('P-1', 38.5)).toBe('p2');
  expect(busy.who('P-1', 50.5)).toBeNull();
});

// 구경하는 사람 얼굴(사용자 2026-11-03): 자기 기계에서 판을 하는(또는 이어 하려고 잡아 둔) 사람은 내 판을 보는 사람으로 치지 않는다
test('players lists who is playing or holding a machine right now', () => {
  const b = new MachineBusy(20, 20);
  b.set('A-1', 'p1', 100); b.hold('A-2', 'p2', 100); b.set('A-3', 'p3', 70);
  expect(b.players(110)).toEqual(new Set(['p1', 'p2']));
});
