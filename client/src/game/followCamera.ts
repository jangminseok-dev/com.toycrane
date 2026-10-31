import * as THREE from 'three';
import type { Vec2 } from './movement';

// 천장(3.4m) 아래 통로 시점: 가로 화면은 뒤 위(0,2.6,4.4), 세로(휴대폰)는 화면이 좁아 조금 더 뒤·위(0,2.95,5.6).
// 천장 조명판·간판·안내 카드가 보이게 사람 눈높이 가까이에서, 캐릭터 앞쪽 통로를 바라본다 (설계 2026-10-31 §3.7)
const WIDE = new THREE.Vector3(0, 2.6, 4.4);
const TALL = new THREE.Vector3(0, 2.95, 5.6);
export const CAMERA_OFFSETS = { WIDE, TALL };
const LOOK_HEIGHT = 1.1, LOOK_AHEAD = 1.6;
const target = new THREE.Vector3();

// 내 캐릭터 뒤 위에서 부드럽게 따라가며 바라본다
export function followCamera(camera: THREE.PerspectiveCamera, at: Vec2, dt: number): void {
  const offset = camera.aspect < 1 ? TALL : WIDE;
  target.set(at.x, 0, at.z).add(offset);
  camera.position.lerp(target, Math.min(1, dt * 6));
  camera.lookAt(camera.position.x - offset.x, LOOK_HEIGHT, camera.position.z - offset.z - LOOK_AHEAD);
}
