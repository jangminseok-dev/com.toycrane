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
