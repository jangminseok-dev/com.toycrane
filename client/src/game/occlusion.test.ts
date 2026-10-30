import * as THREE from 'three';
import { expect, test } from 'vitest';
import { blocksView } from './occlusion';

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
