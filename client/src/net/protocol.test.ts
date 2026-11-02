import { expect, test } from 'vitest';
import fixtures from '../../../shared/protocol_fixtures.json';
import { PROTOCOL, decode, encodeBeg, encodeCounterBeg, encodeDone, encodeGive, encodeMove, encodePlay, encodePose, encodeStand, encodeTake, encodeTick, lookOf, needsReload, uidOf, type DollSpot, type MachineMsg } from './protocol';

const fx = fixtures as Record<string, unknown>;

test('decodes every server fixture', () => {
  for (const k of ['server_welcome', 'server_join', 'server_move', 'server_correct', 'server_leave', 'server_coins',
    'server_play_ok', 'server_play_no', 'server_play', 'server_result', 'server_result_staff', 'server_result_miss', 'server_machine', 'server_free', 'server_bag', 'server_spawn', 'server_stock',
    'server_take_no', 'server_cbeg', 'server_cbeg_no', 'server_beg', 'server_gave', 'server_give_no', 'server_done_no', 'server_pose', 'server_figure'])
    expect(decode(JSON.stringify(fx[k]))).toEqual(fx[k]);
});

test('rejects garbage', () => {
  expect(decode('not json')).toBeNull();
  expect(decode('{"t":"jump"}')).toBeNull();
  expect(decode('{"t":"move","id":"p2"}')).toBeNull(); // 좌표 빠짐
});

test('encodeMove matches client fixture shape', () =>
  expect(JSON.parse(encodeMove({ x: 1.504, z: -2 }, { x: 0.70712, z: -0.70712 }))).toEqual({ t: 'move', x: 1.5, z: -2, dx: 0.707, dz: -0.707 }));

test('counter, begging and giving messages match client fixtures', () => {
  expect(JSON.parse(encodeTake(0))).toEqual(fx.client_take);
  expect(JSON.parse(encodeCounterBeg(0))).toEqual(fx.client_cbeg);
  expect(JSON.parse(encodeBeg(true))).toEqual(fx.client_beg);
  expect(JSON.parse(encodeGive('p2', 3))).toEqual(fx.client_give);
});

test('the old queue and drop-result messages are gone', () => {
  expect(decode('{"t":"queue","c":0,"ids":[]}')).toBeNull();
  expect(decode('{"t":"result","m":"A-3","id":"p1","x":0.1,"z":0,"o":"win","part":"head","k":"bunny"}')).toBeNull();
  expect(PROTOCOL).toBe(14); // 매장 38m·진열탑 줄임·피규어 앞 벽(배치가 바뀜, 2026-11-02) — 옛 배치를 든 화면은 새로 고친다
});

test('play messages match client fixtures', () => {
  expect(JSON.parse(encodePlay('A-3'))).toEqual(fx.client_play);
  expect(JSON.parse(encodeStand())).toEqual(fx.client_stand);
});

// 판 보고(done)와 중계(pose): 인형 자리 = [번호, x, y, z, qx, qy, qz, qw] — 보고는 소수 3자리, 중계는 2자리 (물리 뽑기 설계 §4.5)
test('done and pose match client fixtures', () => {
  expect(JSON.parse(encodeDone('A-3', [7], [{ uid: 8, p: [0.2004, 0.87, 0.1], q: [0, 0, 0, 1] }]))).toEqual(fx.client_done);
  expect(JSON.parse(encodePose('A-3', [0.1, 1.6, 0.2, 0.4], [{ uid: 7, p: [0.2, 1.3, 0.1], q: [0, 0, 0, 1] }]))).toEqual(fx.client_pose);
});


// 기계 속 인형 한 칸 = [캐릭터, x, y|null, z, qx, qy, qz, qw, 색, 체형, 표정, 희귀, 번호] — y가 null이면 아직 안 앉은(떨어뜨린) 인형 (물리 뽑기 설계 §4.5)
test('machine dolls carry pose and variant', () => {
  const m = decode(JSON.stringify(fx.server_machine)) as MachineMsg;
  expect(m.dolls[0]).toHaveLength(13);
  expect(lookOf(m.dolls[0] as DollSpot)).toEqual({ color: 3, body: 's', face: 4, rare: '' });
  expect(uidOf(m.dolls[1] as DollSpot)).toBe(8);
  expect(m.dolls[1][2]).toBeNull();
});

test('old ten-field dolls are no longer understood', () => {
  expect(decode('{"t":"machine","m":"A-1","dolls":[["bear",0.2,0.1,0.5,0.0,3,"s",4,"",7]]}')).toBeNull();
  expect(decode('{"t":"machine","m":"A-1","dolls":[["bear",0,0,0,0,0,0,1,0,"x",0,"",1]]}')).toBeNull(); // 모르는 체형
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

// 9단계 피규어 뽑기: 상자 메시지에는 상자 자리와 직원이 옮겼는지뿐 — 경품은 뽑힌 순간 result로만 온다(설계 §3.4).
// 화면은 정해진 네 키만 받아들인다(서버가 무엇을 더 붙여 보내도 화면 코드로 새지 않게)
test('figure messages carry no prize', () => {
  const fig = fx.server_figure as Record<string, unknown>;
  const got = decode(JSON.stringify({ ...fig, k: 'bunny', rv: 'gold' })) as Record<string, unknown>;
  expect(Object.keys(got).sort()).toEqual(['box', 'm', 'nudged', 't']);
  expect(decode(JSON.stringify({ ...fig, box: [0, 1, 0, 0, 0, 1] }))).toBeNull();
  expect(decode(JSON.stringify({ ...fig, box: [0, 1, 0, 0, 0, 0, 'x'] }))).toBeNull();
  expect(decode(JSON.stringify({ t: 'figure', m: 'F-1', box: fig.box }))).toBeNull();
  const w = fx.server_welcome as Record<string, unknown>;
  expect(decode(JSON.stringify({ ...w, figures: { 'F-1': [0, 1, 0] } }))).toBeNull();
});


// 미는 뽑기 15판 보장: 직원이 꺼내 준 인형이 든 결과는 staff로 알 수 있다(내 화면에 안내)
test('a staff gift result says so', () => {
  const r = decode(JSON.stringify(fx.server_result_staff));
  expect(r?.t === 'result' && r.staff).toBe(true);
  const plain = decode(JSON.stringify(fx.server_result));
  expect(plain?.t === 'result' && plain.staff).toBeFalsy();
});

// 연달아 못 뽑은 판 수(인형 기계·미는 뽑기): 있을 때만 miss로 온다 — 없으면 0(뽑았거나 처음)
test('a result carries the miss count when there is one', () => {
  const r = decode(JSON.stringify(fx.server_result_miss));
  expect(r?.t === 'result' && r.miss).toBe(3);
  const plain = decode(JSON.stringify(fx.server_result));
  expect(plain?.t === 'result' && (plain.miss ?? 0)).toBe(0);
});
