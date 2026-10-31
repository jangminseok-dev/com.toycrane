import { expect, test } from 'vitest';
import fixtures from '../../../shared/protocol_fixtures.json';
import { PROTOCOL, decode, encodeDrop, encodeMove, encodePlay, encodeQueue, encodeStand, encodeTake, encodeTick, encodeUnqueue, lookOf, needsReload, type DollSpot, type MachineMsg } from './protocol';

const fx = fixtures as Record<string, unknown>;

test('decodes every server fixture', () => {
  for (const k of ['server_welcome', 'server_join', 'server_move', 'server_correct', 'server_leave', 'server_queue', 'server_queue_no', 'server_coins',
    'server_play_ok', 'server_play_no', 'server_play', 'server_result', 'server_machine', 'server_free', 'server_bag', 'server_spawn', 'server_stock'])
    expect(decode(JSON.stringify(fx[k]))).toEqual(fx[k]);
});

test('rejects garbage', () => {
  expect(decode('not json')).toBeNull();
  expect(decode('{"t":"jump"}')).toBeNull();
  expect(decode('{"t":"move","id":"p2"}')).toBeNull(); // 좌표 빠짐
});

test('encodeMove matches client fixture shape', () =>
  expect(JSON.parse(encodeMove({ x: 1.504, z: -2 }, { x: 0.70712, z: -0.70712 }))).toEqual({ t: 'move', x: 1.5, z: -2, dx: 0.707, dz: -0.707 }));

test('queue messages match client fixtures', () => {
  expect(JSON.parse(encodeQueue(0))).toEqual(fx.client_queue);
  expect(JSON.parse(encodeUnqueue())).toEqual(fx.client_unqueue);
  expect(JSON.parse(encodeTake())).toEqual(fx.client_take);
});

test('play messages match client fixtures', () => {
  expect(JSON.parse(encodePlay('A-3'))).toEqual(fx.client_play);
  expect(JSON.parse(encodeDrop(0.1204, -0.0501))).toEqual(fx.client_drop);
  expect(JSON.parse(encodeStand())).toEqual(fx.client_stand);
});


// 기계 속 인형 한 칸 = [캐릭터, x, z, 몸 돌림, 높이, 색, 체형, 표정, 희귀, 번호] (설계 2026-10-31 인형 채우기 §4.4)
test('machine dolls carry their variant', () => {
  const m = decode(JSON.stringify(fx.server_machine)) as MachineMsg;
  expect(m.dolls[0]).toHaveLength(10);
  expect(lookOf(m.dolls[0] as DollSpot)).toEqual({ color: 3, body: 's', face: 4, rare: '' });
});

test('old five-field dolls are no longer understood', () => {
  expect(decode('{"t":"machine","m":"A-1","dolls":[["bear",0,0,0,0]]}')).toBeNull();
  expect(decode('{"t":"machine","m":"A-1","dolls":[["bear",0,0,0,0,0,"x",0,"",1]]}')).toBeNull(); // 모르는 체형
});

test('tick wakes the store', () => expect(JSON.parse(encodeTick())).toEqual(fx.client_tick));

// 배포로 메시지 형식이 바뀌면 열려 있던 화면이 스스로 새로고침한다
test('a welcome from another protocol version asks for a reload', () => {
  expect(needsReload(JSON.stringify({ t: 'welcome', v: PROTOCOL - 1 }))).toBe(true);
  expect(needsReload(JSON.stringify({ t: 'welcome', v: PROTOCOL }))).toBe(false);
  expect(needsReload(JSON.stringify({ t: 'move', v: 1 }))).toBe(false);
  expect(needsReload('not json')).toBe(false);
  expect((fx.server_welcome as { v: number }).v).toBe(PROTOCOL);
});
