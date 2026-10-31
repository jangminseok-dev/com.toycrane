import { expect, test } from 'vitest';
import fixtures from '../../../shared/protocol_fixtures.json';
import { decode, encodeDrop, encodeMove, encodePlay, encodeQueue, encodeStand, encodeTake, encodeUnqueue } from './protocol';

const fx = fixtures as Record<string, unknown>;

test('decodes every server fixture', () => {
  for (const k of ['server_welcome', 'server_join', 'server_move', 'server_correct', 'server_leave', 'server_queue', 'server_queue_no', 'server_coins',
    'server_play_ok', 'server_play_no', 'server_play', 'server_result', 'server_machine', 'server_free', 'server_bag'])
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
