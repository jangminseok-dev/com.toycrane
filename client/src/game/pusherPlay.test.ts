import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { PUSHER } from '../data/pushers';
import type { ItemWire, PusherMsg } from '../net/protocol';
import { stubCanvas } from '../test/canvasStub';
import { buildPusherZone } from '../world/pusherZone';
import { PusherPlay } from './pusherPlay';

beforeAll(stubCanvas);
const RANGE = PUSHER.shelf.half_w - PUSHER.plate.half_w;
const make = () => {
  const zone = buildPusherZone(new THREE.Scene()), sent: string[] = [];
  const play = new PusherPlay(zone, { send: (m) => sent.push(m), onDrop: () => {}, onOverdue: () => {} });
  play.setShelves({ 'P-1': [[1, 'bear', 0, '', 0, 0], [2, 'cat', 1, '', 0.02, 0.2]] });
  return { zone, play, sent };
};

// 미는 판은 판이 시작되면 가운데에서 오른쪽으로 갔다가 왼쪽으로 — 선반 폭 안에서만 오간다
test('the plate sweeps left and right', () => {
  const { zone, play } = make();
  play.start('P-1', 20, 0);
  const xs: number[] = [];
  for (let t = 0.1; t < 8; t += 0.1) { play.frame(0.1, t); xs.push(zone.plateOf('P-1').x); }
  expect(xs[1]).toBeGreaterThan(xs[0]);
  expect(Math.max(...xs)).toBeGreaterThan(RANGE - 0.03); // 0.1초 간격으로 보면 끝에서 한 걸음(3cm) 안
  expect(Math.min(...xs)).toBeLessThan(-RANGE + 0.03);
  for (const x of xs) expect(Math.abs(x)).toBeLessThanOrEqual(RANGE + 1e-9);
});

// '밀기'를 누르면 그 순간 미는 판 자리를 act로 보낸다(한 판에 한 번, 버튼 ②는 없다)
test('pressing push sends the plate position once', () => {
  const { zone, play, sent } = make();
  play.start('P-1', 20, 0);
  play.frame(0.5, 0.5);
  const x = zone.plateOf('P-1').x;
  expect(play.press(2)).toBe(false);
  expect(play.press(1)).toBe(true);
  play.frame(0.016, 0.516);
  expect(sent).toHaveLength(1);
  expect(JSON.parse(sent[0])).toMatchObject({ t: 'act', m: 'P-1', y: 0 });
  expect(JSON.parse(sent[0]).x).toBeCloseTo(x, 3);
  expect(play.session).toBeNull();
  expect(play.press(1)).toBe(false);
});

// 서버가 정한 밀기를 모두가 같게 그린다 — 뒤에 새 인형이 떨어지고, 미는 판이 나가며 인형이 전 자리에서 뒤 자리로, 앞 끝을 넘은 인형은 떨어져 사라진다
test('a pusher message animates items from before to after and drops the fallen', async () => {
  const { zone, play } = make();
  const drop: ItemWire = [3, 'fox', 2, '', -0.2, -0.2];
  const after: ItemWire[] = [[1, 'bear', 0, '', 0, 0.08], [3, 'fox', 2, '', -0.2, -0.2]];
  const msg: PusherMsg = { t: 'pusher', m: 'P-1', x: 0, items: after, drop, fell: [2] };
  const done = play.finished('P-1');
  play.onPusher(msg);
  expect(play.cycling()).toBe(false); // 남의 판이면 캐릭터를 묶지 않는다
  let sawMid = false, sawFall = false;
  for (let t = 0; t < 3; t += 0.05) {
    play.frame(0.05, t);
    const one = zone.shown('P-1').find((s) => s.item[0] === 1), fell = zone.shown('P-1').find((s) => s.item[0] === 2);
    if (one && one.z > 0.01 && one.z < 0.07) sawMid = true;
    if (fell && fell.y < -0.05) sawFall = true;
  }
  await done;
  expect(sawMid).toBe(true);
  expect(sawFall).toBe(true);
  expect(zone.shelfOf('P-1')).toEqual(after);
  expect(zone.shown('P-1').map((s) => s.item[0]).sort()).toEqual([1, 3]);
  expect(zone.plateOf('P-1').push).toBe(0);
});
