// 상주 직원 일정 → 그 순간의 자리·방향·동작(설계 2026-11-24 store-staff). 서버가 정한 시각과 같은 길찾기(routeTo)만 쓰므로 모든 화면이 같다.
// 구간: 대기 → 걷기(dep~arr, 앞 일이 있으면 그 기계 옆에서) → 정리 손짓(arr~put) → 인사(put~end) → 다음 일 또는 대기 자리로 돌아가기
import { machineAt, postOf, sideSpot, walkSeconds, type StaffZone } from '../data/staff';
import type { StaffJobWire, StaffZonePlan } from '../net/protocol';
import { routeTo } from './autoWalk';
import type { Vec2 } from './movement';

export type StaffPhase = 'idle' | 'walk' | 'work' | 'bow';
export type StaffPose = { x: number; z: number; face: number; phase: StaffPhase; k: number };

const routes = new Map<string, Vec2[]>();
function route(from: Vec2, to: Vec2): Vec2[] {
  const key = `${from.x},${from.z}>${to.x},${to.z}`;
  let r = routes.get(key);
  if (!r) routes.set(key, (r = [from, ...routeTo(from, to)]));
  return r;
}

// 길을 k(0~1)만큼 걸은 자리와 그때 향하는 방향
function along(path: Vec2[], k: number): StaffPose {
  const lens = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.z - path[i].z));
  let left = Math.min(Math.max(k, 0), 1) * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    const a = path[i], b = path[i + 1], f = lens[i] ? Math.min(left / lens[i], 1) : 1;
    if (left <= lens[i] || i === lens.length - 1) return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, face: Math.atan2(b.x - a.x, b.z - a.z), phase: 'walk', k };
    left -= lens[i];
  }
  const p = path[path.length - 1];
  return { x: p.x, z: p.z, face: 0, phase: 'walk', k };
}

const facing = (from: Vec2, to: Vec2) => Math.atan2(to.x - from.x, to.z - from.z);
const idleAt = (zone: StaffZone): StaffPose => { const p = postOf(zone); return { x: p.x, z: p.z, face: facing(p, { x: 0, z: 0 }), phase: 'idle', k: 0 }; }; // 광장 쪽을 본다
const startOf = (zone: StaffZone, j: StaffJobWire) => (j.from ? sideSpot(j.from) : postOf(zone));

function walkBack(zone: StaffZone, j: StaffJobWire, t: number): StaffPose | null {
  const side = sideSpot(j.m), post = postOf(zone), dur = walkSeconds(side, post);
  return t < j.end + dur ? along(route(side, post), (t - j.end) / dur) : null;
}

export function staffPose(zone: StaffZone, plan: StaffZonePlan | null, t: number): StaffPose {
  if (!plan || !plan.jobs.length) return idleAt(zone);
  const { jobs } = plan;
  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i], prev = jobs[i - 1];
    if (t < j.dep) { // 앞 일과 이 일 사이(또는 첫 일 전)
      if (prev && !j.from) return walkBack(zone, prev, t) ?? idleAt(zone);
      if (prev && j.from) { const s = sideSpot(prev.m); return { x: s.x, z: s.z, face: facing(s, machineAt(prev.m)), phase: 'idle', k: 0 }; }
      if (j.from) { const s = sideSpot(j.from); return { x: s.x, z: s.z, face: facing(s, machineAt(j.from)), phase: 'idle', k: 0 }; }
      return idleAt(zone);
    }
    const side = sideSpot(j.m), face = facing(side, machineAt(j.m));
    if (t < j.arr) return along(route(startOf(zone, j), side), (t - j.dep) / (j.arr - j.dep));
    if (t < j.put) return { x: side.x, z: side.z, face, phase: 'work', k: (t - j.arr) / (j.put - j.arr) };
    if (t < j.end) return { x: side.x, z: side.z, face, phase: 'bow', k: (t - j.put) / (j.end - j.put) };
  }
  return walkBack(zone, jobs[jobs.length - 1], t) ?? idleAt(zone);
}

// 판 화면(기계 앞, atMachine)에선 손님처럼 직원도 숨기고, 그 기계로 일하러 오는 직원만(일정이 끝나 돌아가기까지) 보인다 — 남이 화면을 막지 않게(사용자 2026-11-03)
export function staffVisible(plan: StaffZonePlan | null, atMachine: string | null, t: number): boolean {
  if (!atMachine) return true;
  return !!plan && t < plan.back && plan.jobs.some((j) => j.m === atMachine);
}
