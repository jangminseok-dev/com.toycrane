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

// 한 판 하는 동안 다른 사람 캐릭터는 모두 숨긴다 — 그동안 들어온 사람도(사용자 2026-11-03: 앞을 막아서는 방해, 보고 있다는 느낌만 남기고 싶다).
// 보고 있는 사람은 얼굴(ui/peekFaces)로만 알리므로 이름·색·자리를 알려 준다
test('everyone else is hidden during my play and shown again after', () => {
  const scene = new THREE.Scene(), remotes = new RemotePlayers(scene);
  remotes.add(view('p2', 0, 0), 0);
  remotes.hideAll(true);
  remotes.add(view('p3', 5, 0), 0);
  expect(scene.children.filter((o) => o.visible)).toHaveLength(0);
  expect(remotes.people()).toEqual([{ id: 'p2', nick: '곰돌이', color: 1, x: 0, z: 0 }, { id: 'p3', nick: '토끼', color: 1, x: 5, z: 0 }]);
  remotes.hideAll(false);
  expect(scene.children.filter((o) => o.visible)).toHaveLength(2);
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

// 매장 지도의 다른 사람 점: 화면에 보이는 자리(부드럽게 따라간 자리)
test('remotes report where they are shown for the map', () => {
  const remotes = new RemotePlayers(new THREE.Scene());
  remotes.add(view('p2', 1, 2), 0); remotes.add(view('p3', -5, 4), 0);
  expect(remotes.positions()).toEqual([{ x: 1, z: 2 }, { x: -5, z: 4 }]);
  remotes.remove('p2');
  expect(remotes.positions()).toEqual([{ x: -5, z: 4 }]);
});
