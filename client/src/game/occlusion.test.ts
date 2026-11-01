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

// 탑에 몸을 붙여 서면(걷기 판정이 내 중심을 탑 면에 딱 붙임) 시선 끝이 상자 면 위에 놓인다 — 소수점 오차로 가림이 프레임마다
// 켜졌다 꺼졌다 해서 탑이 번쩍거렸다(사용자 2026-11-01). 면에 붙은 나(앞면이든 옆면이든)는 가려지지 않은 것으로 본다
test('standing pressed against the tower does not flicker the fade', () => {
  for (const at of [v(0, 1.2, 1.3), v(0.4, 0.4, 1.3), v(1.3, 1.2, 0.2), v(-1.3, 0.4, -0.5)]) {
    for (let k = 0; k < 20; k++) {
      const eye = v(at.x + Math.sin(k) * 1e-4, 15, at.z + 14 + Math.cos(k) * 1e-4);
      expect(blocksView(eye, at, tower), `${at.x},${at.z}`).toBe(false);
    }
  }
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

// 기계 앞 화면(한 판 중)에서는 흐림을 모두 푼다 — 걸어오다 흐려진 내 기계 줄이 반투명하게 남으면 안 된다
test('clearing restores every faded occluder', () => {
  let opacity = 1;
  const box = new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 3, 1));
  const fader = new OcclusionFader([{ box, setOpacity: (o) => { opacity = o; } }]);
  for (let i = 0; i < 30; i++) fader.update(0.05, new THREE.Vector3(0, 2, 5), { x: 0, z: -5 });
  expect(opacity).toBeLessThan(0.5);
  for (let i = 0; i < 30; i++) fader.clear(0.05);
  expect(opacity).toBe(1);
});
