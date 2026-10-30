import { expect, test } from 'vitest';
import fixtures from '../../../shared/protocol_fixtures.json';
import { decode, encodeMove } from './protocol';

const fx = fixtures as Record<string, unknown>;

test('decodes every server fixture', () => {
  for (const k of ['server_welcome', 'server_join', 'server_move', 'server_correct', 'server_leave'])
    expect(decode(JSON.stringify(fx[k]))).toEqual(fx[k]);
});

test('rejects garbage', () => {
  expect(decode('not json')).toBeNull();
  expect(decode('{"t":"jump"}')).toBeNull();
  expect(decode('{"t":"move","id":"p2"}')).toBeNull(); // 좌표 빠짐
});

test('encodeMove matches client fixture shape', () =>
  expect(JSON.parse(encodeMove({ x: 1.504, z: -2 }, { x: 0.70712, z: -0.70712 }))).toEqual({ t: 'move', x: 1.5, z: -2, dx: 0.707, dz: -0.707 }));
