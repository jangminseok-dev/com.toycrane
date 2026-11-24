// 상주 직원 설정(shared/staff.json, 서버 domain/staff.py와 같은 파일·같은 공식) — 설계 2026-11-24 store-staff
import staff from '../../../shared/staff.json';
import type { Vec2 } from '../game/movement';
import { FIGURES } from './figures';
import { PUSHERS } from './pushers';
import { RINGS } from './rings';
import { MACHINES, frontSpot } from './storeLayout';

export type StaffZone = 'doll' | 'figure' | 'hook' | 'pusher';
export const STAFF_ZONES: StaffZone[] = ['doll', 'figure', 'hook', 'pusher'];
export type StaffSpec = {
  posts: Record<StaffZone, [number, number]>; // 구역마다 대기 자리
  side: Record<StaffZone, number>; inset: number; // 기계 앞자리에서 왼쪽으로 비켜설 거리(구역마다), 기계 쪽으로 들어갈 거리
  speed: number; route_factor: number; walk_min: number; walk_max: number; // 걷는 시간 = 직선 × route_factor / speed
  work: number; bow: number; queue_max: number; calls_every: number; // 정리·인사 초, 기다리는 일 수, 부른 뒤 다시 부를 때까지 판 수
};
export const STAFF = staff as unknown as StaffSpec;

const spots = new Map<string, { x: number; z: number; ry: number; zone: StaffZone }>([
  ...MACHINES.map((m) => [m.id, { ...m, zone: 'doll' as const }] as const),
  ...FIGURES.map((m) => [m.id, { ...m, zone: 'figure' as const }] as const),
  ...RINGS.map((m) => [m.id, { ...m, zone: 'hook' as const }] as const),
  ...PUSHERS.map((m) => [m.id, { ...m, zone: 'pusher' as const }] as const),
]);

export function zoneOf(machineId: string): StaffZone | null {
  return spots.get(machineId)?.zone ?? null;
}

export function postOf(zone: StaffZone): Vec2 {
  const [x, z] = STAFF.posts[zone];
  return { x, z };
}

// 직원이 일하는 자리: 기계 앞자리에서 기계를 보는 손님의 왼쪽으로 side[구역] m, 기계 쪽으로 inset m — 기계 앞면 바로 옆(카메라 앞을 가리지 않게)
export function sideSpot(machineId: string): Vec2 {
  const m = spots.get(machineId)!, f = frontSpot(m), side = STAFF.side[m.zone], inset = STAFF.inset;
  return { x: f.x - Math.cos(m.ry) * side - Math.sin(m.ry) * inset, z: f.z + Math.sin(m.ry) * side - Math.cos(m.ry) * inset };
}

// 기계 자리(직원이 일할 때 바라보는 곳)
export function machineAt(machineId: string): Vec2 {
  const m = spots.get(machineId)!;
  return { x: m.x, z: m.z };
}

export function walkSeconds(a: Vec2, b: Vec2): number {
  const t = (Math.hypot(b.x - a.x, b.z - a.z) * STAFF.route_factor) / STAFF.speed;
  return Math.min(Math.max(t, STAFF.walk_min), STAFF.walk_max);
}
