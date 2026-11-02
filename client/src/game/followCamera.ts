import * as THREE from 'three';
import type { Vec2 } from './movement';

// 동물의 숲처럼 캐릭터 뒤 위에서 대각선(약 40°, 세로 화면은 더 위에서 약 47°)으로 내려다본다 — 천장은 없다 (설계 2026-10-31 §3.7, 2차 결정).
// 캐릭터가 화면 가운데 조금 아래, 앞쪽 통로와 기계가 넉넉히 보이게 캐릭터보다 조금 앞을 바라본다
// 어디서나 같은 높이(사용자 2026-11-02: 광장에서 저절로 빠졌다 기계 줄에서 당기니 어지러웠다) — 예전 기계 줄 앞 시점
// (PC 6.8·6.6, 세로 9.5·7.5)보다 약 10% 가깝게
const WIDE = new THREE.Vector3(0, 6.1, 5.9);
const TALL = new THREE.Vector3(0, 8.5, 6.7);
export const CAMERA_OFFSETS = { WIDE, TALL };
const LOOK_HEIGHT = 0.8, LOOK_AHEAD = 0.6;
const target = new THREE.Vector3(), offset = new THREE.Vector3();

// 내 캐릭터 뒤 위에서 부드럽게 따라가며 바라본다
export function followCamera(camera: THREE.PerspectiveCamera, at: Vec2, dt: number): void {
  const tall = camera.aspect < 1;
  offset.copy(tall ? TALL : WIDE);
  target.set(at.x, 0, at.z).add(offset);
  camera.position.lerp(target, Math.min(1, dt * 6));
  camera.lookAt(camera.position.x - offset.x, LOOK_HEIGHT, camera.position.z - offset.z - LOOK_AHEAD);
}
