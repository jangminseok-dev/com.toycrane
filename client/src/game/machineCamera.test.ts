import { expect, test } from 'vitest';
import { MACHINES } from '../data/storeLayout';
import { machineCameraPose } from './machineCamera';

const at = (id: string) => machineCameraPose(MACHINES.find((m) => m.id === id)!);
const r = (v: { x: number; y: number; z: number }) => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)];

// 집게를 움직이는 동안은 내 캐릭터를 숨기고 기계 정면 눈높이(기계 좌표 (0, 1.7, 2.0))에서 유리 칸(0, 1.3, 0)을 본다.
// 휴대폰 세로 화면에서도 유리 칸 전체가 들어오고, 집게는 간판 아래로 보인다. 기계가 돌아 있으면 같이 돈다
test('camera faces the glass at eye level', () => {
  // 큰 홀: 기계는 광장(+x, ry π/2)을 본다 — 카메라는 기계 앞 2m, 눈높이 1.7
  expect(r(at('A-1').pos)).toEqual([-15.2, 1.7, -9.45]);
  expect(r(at('A-1').look)).toEqual([-17.2, 1.3, -9.45]);
  expect(r(at('C-1').pos)).toEqual([-11.4, 1.7, 4.05]);
});

test('claw shows under the sign', () => {
  const { pos } = at('A-1'), m = MACHINES.find((x) => x.id === 'A-1')!;
  const dist = Math.hypot(pos.x - m.x, pos.z - m.z); // 기계 가운데에서 카메라까지(기계가 보는 쪽으로)
  const k = (dist - 0.555) / dist; // 간판 앞면(기계 안 0.555)을 지날 때, 집게 머리(0, 1.7, 0)를 보는 시선
  expect(pos.y + (1.7 - pos.y) * k).toBeLessThan(1.95); // 간판 아래 끝
});
