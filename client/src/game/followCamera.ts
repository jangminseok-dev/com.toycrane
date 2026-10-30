import * as THREE from 'three';
import type { Vec2 } from './movement';

// 가로 화면은 뒤 위(0,7,9), 세로(휴대폰)는 벽 대신 바닥이 보이게 더 위에서(0,11,6)
const WIDE = new THREE.Vector3(0, 7, 9);
const TALL = new THREE.Vector3(0, 11, 6);
const target = new THREE.Vector3();

// 내 캐릭터 뒤 위에서 부드럽게 따라가며 바라본다
export function followCamera(camera: THREE.PerspectiveCamera, at: Vec2, dt: number): void {
  const offset = camera.aspect < 1 ? TALL : WIDE;
  target.set(at.x, 0, at.z).add(offset);
  camera.position.lerp(target, Math.min(1, dt * 6));
  camera.lookAt(camera.position.x - offset.x, 0.9, camera.position.z - offset.z);
}
