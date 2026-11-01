import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { RING, pegXY } from '../data/rings';
import type { CardWire, RingMsg } from '../net/protocol';
import { stubCanvas } from '../test/canvasStub';
import { buildRingZone } from '../world/ringZone';
import { RingPlay } from './ringPlay';

beforeAll(stubCanvas);
const board = (kind: string): CardWire[] => Array.from({ length: 12 }, () => [kind, 0, '']);
const make = () => {
  const zone = buildRingZone(new THREE.Scene()), sent: string[] = [];
  const play = new RingPlay(zone, { send: (m) => sent.push(m), onDrop: () => {}, onOverdue: () => {} });
  play.setBoards({ 'R-1': board('bear') });
  return { zone, play, sent };
};

// 고리 한 판(설계 2026-11-02 §3): ① 누르는 동안 오른쪽, ② 누르는 동안 위로, ②를 떼면 멈춘 자리를 act로 보낸다
test('hook moves right then up and pokes on release', () => {
  const { play, sent } = make();
  play.start('R-1', 20, 0);
  expect(play.press(2)).toBe(false); // ①부터
  expect(play.press(1)).toBe(true);
  play.frame(1, 1); play.release(1, 1);
  expect(play.press(1)).toBe(false); // 한 번씩
  expect(play.press(2)).toBe(true);
  play.frame(0.5, 1.5); play.release(2, 1.5);
  const [hx, hy] = RING.hook.home;
  expect(sent).toHaveLength(1);
  const act = JSON.parse(sent[0]);
  expect(act).toMatchObject({ t: 'act', m: 'R-1' });
  expect(act.x).toBeCloseTo(hx + RING.hook.speed, 2);
  expect(act.y).toBeCloseTo(hy + RING.hook.speed * 0.5, 2);
  expect(play.session).toBeNull();
});

// 서버가 정한 결과를 모두가 같은 찌르기로 그린다 — 걸려서 빠지면 카드가 출구로 날아가고 그 걸이에 새 카드
test('a ring message replays the poke and swaps the caught card', async () => {
  const { zone, play } = make();
  const [x, y] = pegXY(4), next = board('bear');
  next[4] = ['penguin', 2, ''];
  const msg: RingMsg = { t: 'ring', m: 'R-1', pegs: next, x, y, peg: 4, caught: true };
  const done = play.finished('R-1');
  play.onRing(msg);
  expect(play.cycling()).toBe(false); // 남의 판도 그리지만 내 판이 아니면 캐릭터를 묶지 않는다
  for (let t = 0; t < 3; t += 0.05) play.frame(0.05, t);
  await done;
  expect(zone.boardOf('R-1')[4]).toEqual(['penguin', 2, '']);
});
