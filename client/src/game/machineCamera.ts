import * as THREE from 'three';
import type { MachineSpot } from '../data/storeLayout';

// 기계 안 좌표. 어깨 너머로 보면 휴대폰 세로 화면에서 내 머리가 유리 칸을 가리고, 높이 올리면 간판 지붕이 집게를 가린다.
// 그래서 집게를 움직이는 동안은 내 캐릭터를 숨기고(main.ts) 정면 눈높이에서 유리 칸 전체를 본다
const EYE = new THREE.Vector3(0, 1.7, 2.0), GLASS = new THREE.Vector3(0, 1.3, 0);

// 기계 한 판 동안의 카메라: 기계 정면에서 유리 칸을 본다
export function machineCameraPose(m: MachineSpot): { pos: THREE.Vector3; look: THREE.Vector3 } {
  const place = (v: THREE.Vector3) => v.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), m.ry).add(new THREE.Vector3(m.x, 0, m.z));
  return { pos: place(EYE), look: place(GLASS) };
}

// 한 판 중 내 카메라와 그 기계 사이에 선 사람인가 (교환소 개편 설계 §4.7.2): 기계 좌표로 옮겨
// 기계 폭보다 조금 넓게(|x| < 0.85), 유리 앞에서 카메라 바로 뒤까지(0.45 < z < 2.3)
export function blocksView(m: MachineSpot, p: { x: number; z: number }): boolean {
  const dx = p.x - m.x, dz = p.z - m.z, c = Math.cos(m.ry), s = Math.sin(m.ry);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) < 0.85 && lz > 0.45 && lz < 2.3;
}
