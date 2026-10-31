import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../test/canvasStub';
import { Tweens } from './tween';
import { RemotePlayers } from './remotePlayers';

beforeAll(stubCanvas);
const view = (id: string, x: number, z: number) => ({ id, nick: id === 'p2' ? '곰돌이' : '토끼', color: 1, x, z, dx: 0, dz: 0 });

// 조르는 사람: 꼬리표와 모션, 더 받을 수 있는 수를 기억하고, 가까이 가면 찾을 수 있다
test('begging remotes show a tag and can be found nearby', () => {
  const remotes = new RemotePlayers(new THREE.Scene()), tw = new Tweens();
  remotes.add(view('p2', 1, 0), 0); remotes.add(view('p3', 5, 0), 0);
  remotes.setBegging('p2', 40, tw);
  expect(remotes.roomOf('p2')).toBe(40);
  expect(remotes.beggarNear({ x: 0, z: 0 }, 1.3)).toEqual({ id: 'p2', nick: '곰돌이', room: 40 });
  expect(remotes.beggarNear({ x: 4, z: 0 }, 1.3)).toBeNull();
  remotes.setBegging('p2', null, tw);
  expect(remotes.roomOf('p2')).toBeNull();
  expect(remotes.beggarNear({ x: 0, z: 0 }, 1.3)).toBeNull();
});

// 한 판 중 내 카메라를 가리는 사람만 0.2초에 걸쳐 거의 투명하게, 벗어나면 돌아온다 (교환소 개편 설계 §4.7.2)
test('remotes blocking my view fade out and come back', () => {
  const remotes = new RemotePlayers(new THREE.Scene());
  remotes.add(view('p2', 0, 0), 0); remotes.add(view('p3', 5, 0), 0);
  const blocking = (p: { x: number; z: number }) => Math.abs(p.x) < 1;
  for (let i = 0; i < 20; i++) remotes.fade(blocking, 1 / 30);
  expect(remotes.fadeOf('p2')).toBeCloseTo(0.08);
  expect(remotes.fadeOf('p3')).toBe(1);
  for (let i = 0; i < 20; i++) remotes.fade(null, 1 / 30);
  expect(remotes.fadeOf('p2')).toBe(1);
});

// 조르던 사람이 나가거나 다시 접속해 목록을 비우면 그 사람의 조르기 모션도 멈춘다 (최종 리뷰 I2)
test('removing a begging remote stops its begging loop', async () => {
  const remotes = new RemotePlayers(new THREE.Scene()), tw = new Tweens();
  remotes.add(view('p2', 1, 0), 0);
  remotes.setBegging('p2', 40, tw);
  const rig = remotes.rigOf('p2')!;
  const run = async (secs: number) => { for (let t = 0; t < secs; t += 0.05) { tw.update(0.05); await new Promise((r) => setTimeout(r)); } };
  await run(1);
  remotes.clear();
  await run(1);
  const seen: number[] = [];
  for (let i = 0; i < 10; i++) { await run(0.05); seen.push(rig.crouch); }
  expect(seen).toEqual(Array(10).fill(0));
});
