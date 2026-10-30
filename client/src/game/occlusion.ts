import * as THREE from 'three';

const ray = new THREE.Ray();
const hit = new THREE.Vector3();

// 카메라(eye)에서 내 캐릭터(target)까지 시선이 상자에 막히는지 — 나보다 먼 곳의 상자는 세지 않는다
export function blocksView(eye: THREE.Vector3, target: THREE.Vector3, box: THREE.Box3): boolean {
  ray.origin.copy(eye);
  ray.direction.subVectors(target, eye).normalize();
  const p = ray.intersectBox(box, hit);
  return p !== null && eye.distanceTo(p) < eye.distanceTo(target);
}
