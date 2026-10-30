import * as THREE from 'three';
import { expect, test } from 'vitest';
import { OcclusionFader, blocksView } from './occlusion';

// 허브 탑과 같은 상자: 가로세로 2.6m, 높이 2.8m
const tower = new THREE.Box3(new THREE.Vector3(-1.3, 0, -1.3), new THREE.Vector3(1.3, 2.8, 1.3));
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

test('tower blocks the view when I stand behind it', () => {
  expect(blocksView(v(0, 11, 4), v(0, 1, -2), tower)).toBe(true);
});

test('tower does not block when I stand in front of it', () => {
  expect(blocksView(v(0, 11, 8), v(0, 1, 2), tower)).toBe(false);
});

test('tower does not block when I stand beside it', () => {
  expect(blocksView(v(3, 11, 4), v(3, 1, -2), tower)).toBe(false);
});

// 시선은 나까지만: 내 뒤쪽에 있는 탑은 가리지 않는다
test('tower beyond me does not count', () => {
  expect(blocksView(v(0, 3, 9), v(0, 1, 2), tower)).toBe(false);
});

// 여러 가림막(탑·기계 행·교환소) 중 내 캐릭터를 가리는 것만 흐려진다
test('fader fades only the occluder that blocks', () => {
  const ops: Record<string, number> = {};
  const box = (name: string, b: THREE.Box3) => ({ box: b, setOpacity: (o: number) => { ops[name] = o; } });
  const fader = new OcclusionFader([box('tower', tower), box('far', new THREE.Box3(v(8, 0, 8), v(9, 3, 9)))]);
  for (let i = 0; i < 60; i++) fader.update(1 / 30, v(0, 11, 4), { x: 0, z: -2 });
  expect(ops.tower).toBeCloseTo(0.25);
  expect(ops.far).toBe(1);
});
