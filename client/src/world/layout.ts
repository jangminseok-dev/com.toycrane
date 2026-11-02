// 매장 치수와 구역 — 값은 공용 배치 파일(shared/store_layout.json의 hall, 서버 domain/store_rules.py와 같은 값)
import { HALL } from '../data/storeLayout';

export const ROOM_HALF = HALL.room_half;       // 벽까지 반폭 (38m 홀 — 44m는 걷기 멀어 구역마다 3m 당김, 2026-11-02)
export const MAP_HALF = HALL.map_half;         // 걸을 수 있는 반폭
export const TOWER_HALF = HALL.tower_half;     // 광장 진열탑 반폭
export const SPAWN_RADIUS = HALL.spawn_radius; // 탑 둘레 스폰 링
export const PLAZA_RADIUS = HALL.plaza_radius; // 가운데 둥근 광장
export const WALK_SPEED = 3.2;    // m/s
export const ROOM_HEIGHT = 3.4;

export type Zone = 'doll' | 'figure' | 'north' | 'plaza' | 'rest' | 'path';

// 가운데 둥근 광장, 서쪽 인형, 동쪽 피규어, 북쪽 고리·미는 뽑기, 남쪽 두 모서리 쉼터, 나머지는 길 (설계 2026-11-01 §3)
export function zoneAt(x: number, z: number): Zone {
  if (Math.hypot(x, z) <= PLAZA_RADIUS) return 'plaza';
  if (x <= -8 && Math.abs(z) <= 12.3) return 'doll';
  if (x >= 8.5 && Math.abs(z) <= 10) return 'figure';
  if (z <= -11) return 'north';
  if (Math.abs(x) >= 10 && z >= 10) return 'rest';
  return 'path';
}
