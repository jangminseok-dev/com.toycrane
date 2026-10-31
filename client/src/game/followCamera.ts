import * as THREE from 'three';
import type { Vec2 } from './movement';

// 동물의 숲처럼 캐릭터 뒤 위에서 대각선(약 40°, 세로 화면은 더 위에서 약 47°)으로 내려다본다 — 천장은 없다 (설계 2026-10-31 §3.7, 2차 결정).
// 캐릭터가 화면 가운데 조금 아래, 앞쪽 통로와 기계가 넉넉히 보이게 캐릭터보다 조금 앞을 바라본다
const WIDE = new THREE.Vector3(0, 6.8, 6.6);
const TALL = new THREE.Vector3(0, 9.5, 7.5);
export const CAMERA_OFFSETS = { WIDE, TALL };
const LOOK_HEIGHT = 0.8, LOOK_AHEAD = 0.6;
const target = new THREE.Vector3();

// 내 캐릭터 뒤 위에서 부드럽게 따라가며 바라본다
export function followCamera(camera: THREE.PerspectiveCamera, at: Vec2, dt: number): void {
  const offset = camera.aspect < 1 ? TALL : WIDE;
  target.set(at.x, 0, at.z).add(offset);
  camera.position.lerp(target, Math.min(1, dt * 6));
  camera.lookAt(camera.position.x - offset.x, LOOK_HEIGHT, camera.position.z - offset.z - LOOK_AHEAD);
}
