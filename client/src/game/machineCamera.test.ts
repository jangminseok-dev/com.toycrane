import { expect, test } from 'vitest';
import { MACHINES } from '../data/storeLayout';
import { blocksView, machineCameraPose } from './machineCamera';

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

// Review Focus 5 (교환소 개편 설계 §4.7.2): 내 카메라와 내 기계 사이에 선 사람만 가린다고 본다 — 옆 기계 앞, 카메라 뒤는 아니다
test('someone between my camera and my machine blocks the view, the next machine does not', () => {
  const m = MACHINES.find((x) => x.id === 'C-6')!; // 큰 홀(38m): x −9.6, z −4.05, ry π/2(광장 쪽 +x를 봄)
  expect(blocksView(m, { x: -8.45, z: -4.05 })).toBe(true); // 기계 앞자리
  expect(blocksView(m, { x: -7.65, z: -4.35 })).toBe(true);
  expect(blocksView(m, { x: -8.45, z: -1.35 })).toBe(false); // 옆 기계(C-7) 앞
  expect(blocksView(m, { x: -6.95, z: -4.05 })).toBe(false); // 카메라 뒤
});
