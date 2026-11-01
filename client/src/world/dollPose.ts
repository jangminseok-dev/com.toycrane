import * as THREE from 'three';
import { uidOf, type DollSpot } from '../net/protocol';
import { dollHits, headOf, type Hit } from './dolls';
import { DOLL_FLOOR, DOLL_SCALE } from './machine';

// 기계 속 인형 자세(기계 안 좌표): 서버가 기록한 자리(x, y, z)와 돌림(쿼터니언) 그대로 (물리 뽑기 설계 §4.5).
// 아직 안 앉은 인형(y null)은 임시 자세 — 바닥에 선 모습, 앉은 다른 인형 머리 위(26cm 안)면 그 위에 (§9.2). 물리가 앉히면 바뀐다
const PROVISIONAL_REACH = 0.26, HEAD_TOP = 0.33;
const UP = new THREE.Vector3(0, 1, 0);
export type DollPoseResult = { position: THREE.Vector3; quaternion: THREE.Quaternion; provisional: boolean };

export function dollPose(spot: DollSpot, others: DollSpot[] = []): DollPoseResult {
  const [, x, y, z, qx, qy, qz, qw] = spot;
  if (y !== null) return { position: new THREE.Vector3(x, y, z), quaternion: new THREE.Quaternion(qx, qy, qz, qw), provisional: false };
  let floor = DOLL_FLOOR;
  for (const o of others) if (o !== spot && o[2] !== null && Math.hypot(o[1] - x, o[3] - z) < PROVISIONAL_REACH) floor = Math.max(floor, o[2] + HEAD_TOP);
  return { position: new THREE.Vector3(x, floor, z), quaternion: new THREE.Quaternion().setFromAxisAngle(UP, (uidOf(spot) * 1.7) % (Math.PI * 2)), provisional: true };
}

// 서버에 '앉은' 자리로 적혔어도 바닥에서 0.8m 넘게 위면 앉은 자리가 아니다 — 앉히기가 끝나기 직전 구멍에 빠져 천장 아래로 옮겨진 인형이
// 그대로 저장됐다(2026-11-01 배포, 원인은 고침). 자리(x, z)·변형·번호만 남기고 안 앉은 인형으로 다시 앉힌다
const FLOAT_LIMIT = 0.8;
export function grounded(spot: DollSpot): DollSpot {
  if (spot[2] === null || spot[2] <= DOLL_FLOOR + FLOAT_LIMIT) return spot;
  return [spot[0], spot[1], null, spot[3], 0, 0, 0, 1, spot[8], spot[9], spot[10], spot[11], spot[12]];
}

// 인형 머리 중심(기계 안 좌표) — 겨냥·시뮬레이션이 노리는 점
export function headAt(spot: DollSpot, others: DollSpot[] = []): THREE.Vector3 {
  const { position, quaternion } = dollPose(spot, others);
  return new THREE.Vector3(0, headOf(spot[0]).c * DOLL_SCALE, 0).applyQuaternion(quaternion).add(position);
}

// 인형마다 집게가 닿는 공(기계 안 좌표, 미터) — 자세와 DOLL_SCALE을 입힌 dollHits (체형 폭·희귀 왕관 포함)
const place = (hits: Hit[], position: THREE.Vector3, quaternion: THREE.Quaternion): Hit[] =>
  hits.map((h) => ({ ...h, c: h.c.clone().multiplyScalar(DOLL_SCALE).applyQuaternion(quaternion).add(position), r: h.r * DOLL_SCALE }));
export function solidsOf(spots: DollSpot[]): Hit[][] {
  return spots.map((spot) => { const { position, quaternion } = dollPose(spot, spots); return place(dollHits(spot[0], spot[9], spot[11]).solid, position, quaternion); });
}
export function earsOf(spots: DollSpot[]): Hit[][] {
  return spots.map((spot) => { const { position, quaternion } = dollPose(spot, spots); return place(dollHits(spot[0], spot[9], spot[11]).ears, position, quaternion); });
}
