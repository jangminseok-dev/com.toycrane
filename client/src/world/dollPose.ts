import * as THREE from 'three';
import type { DollSpot } from '../net/protocol';
import { dollHits, headOf, type Hit } from './dolls';
import { DOLL_FLOOR, DOLL_SCALE } from './machine';

// 기계 속 인형 자세(기계 안 좌표): 기울기는 몸 돌림 r에서 정해 모든 화면에서 같고(얹힌 인형은 조금 더 기댄다),
// 바닥은 서버가 정한 얹힌 높이. 가로 자리는 머리 가운데가 서버의 인형 자리(x,z) 위에 오도록 —
// 서버가 그 자리에서 평면 거리로 부위를 고르므로 "머리 판정 = 화면에서 머리"가 된다 (설계 2026-10-31 §4.8)
const tilt = new THREE.Euler();
export function dollPose(spot: DollSpot): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
  const [id, x, z, r, y] = spot;
  const quaternion = new THREE.Quaternion().setFromEuler(tilt.set(Math.sin(r * 3) * 0.25 + (y > 0 ? 0.3 : 0), r, Math.cos(r * 5) * 0.25));
  const head = new THREE.Vector3(0, headOf(id).c * DOLL_SCALE, 0).applyQuaternion(quaternion);
  return { position: new THREE.Vector3(x - head.x, DOLL_FLOOR + y, z - head.z), quaternion };
}

// 인형마다 집게가 닿는 공(기계 안 좌표, 미터) — 자세와 DOLL_SCALE을 입힌 dollHits (체형 폭·희귀 왕관 포함)
const place = (hits: Hit[], position: THREE.Vector3, quaternion: THREE.Quaternion): Hit[] =>
  hits.map((h) => ({ ...h, c: h.c.clone().multiplyScalar(DOLL_SCALE).applyQuaternion(quaternion).add(position), r: h.r * DOLL_SCALE }));
export function solidsOf(spots: DollSpot[]): Hit[][] {
  return spots.map((spot) => { const { position, quaternion } = dollPose(spot); return place(dollHits(spot[0], spot[6], spot[8]).solid, position, quaternion); });
}
export function earsOf(spots: DollSpot[]): Hit[][] {
  return spots.map((spot) => { const { position, quaternion } = dollPose(spot); return place(dollHits(spot[0], spot[6], spot[8]).ears, position, quaternion); });
}
