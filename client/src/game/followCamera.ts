import * as THREE from 'three';
import { PLAZA_RADIUS } from '../world/layout';
import type { Vec2 } from './movement';

// 동물의 숲처럼 캐릭터 뒤 위에서 대각선(약 40°, 세로 화면은 더 위에서 약 47°)으로 내려다본다 — 천장은 없다 (설계 2026-10-31 §3.7, 2차 결정).
// 캐릭터가 화면 가운데 조금 아래, 앞쪽 통로와 기계가 넉넉히 보이게 캐릭터보다 조금 앞을 바라본다
const WIDE = new THREE.Vector3(0, 6.8, 6.6);
const TALL = new THREE.Vector3(0, 9.5, 7.5);
// 큰 홀(설계 2026-11-01 §3 카메라): 탁 트인 광장에서는 높고 멀리 빠진다 — PC는 양쪽 구역 앞줄까지, 휴대폰 세로는 내 둘레 폭 10m 넘게
const WIDE_FAR = new THREE.Vector3(0, 15, 14);
const TALL_FAR = new THREE.Vector3(0, 24, 15);
export const CAMERA_OFFSETS = { WIDE, TALL, WIDE_FAR, TALL_FAR };
const LOOK_HEIGHT = 0.8, LOOK_AHEAD = 0.6, BLEND_EDGE = 2.5; // 광장 가장자리에서 2.5m에 걸쳐 가까워진다 — 인형 줄 앞자리(가운데에서 11.45m)에서는 다 가까워진 뒤
const target = new THREE.Vector3(), offset = new THREE.Vector3();

// 광장 안이면 1, 광장 가장자리에서 BLEND_EDGE m 넘게 나가면 0, 그 사이는 부드럽게
export function plazaBlend(at: Vec2): number {
  const t = Math.min(1, Math.max(0, (PLAZA_RADIUS + BLEND_EDGE - Math.hypot(at.x, at.z)) / BLEND_EDGE));
  return t * t * (3 - 2 * t);
}

// 내 캐릭터 뒤 위에서 부드럽게 따라가며 바라본다
export function followCamera(camera: THREE.PerspectiveCamera, at: Vec2, dt: number): void {
  const tall = camera.aspect < 1;
  offset.lerpVectors(tall ? TALL : WIDE, tall ? TALL_FAR : WIDE_FAR, plazaBlend(at));
  target.set(at.x, 0, at.z).add(offset);
  camera.position.lerp(target, Math.min(1, dt * 6));
  camera.lookAt(camera.position.x - offset.x, LOOK_HEIGHT, camera.position.z - offset.z - LOOK_AHEAD);
}
