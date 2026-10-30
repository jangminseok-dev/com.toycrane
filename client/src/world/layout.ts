// 매장 치수와 구역. 서버 server/src/toycrane/domain/store_rules.py와 같은 값.
export const ROOM_HALF = 13;      // 26m 정사각형 매장
export const MAP_HALF = 12.6;     // 걸을 수 있는 반폭
export const HUB_HALF = 5;        // 가운데 허브 10m
export const TOWER_HALF = 1.3;    // 4면 전광판 탑
export const SPAWN_RADIUS = 2.4;  // 스폰 링
export const WALK_SPEED = 3.2;    // m/s
export const ROOM_HEIGHT = 3.4;

export type Zone = 'big' | 'mini' | 'figure' | 'hub' | 'path';

// 위(-z) 큰인형 띠, 왼쪽 ㄴ자 미니, 오른쪽 ㄴ자 피규어, 가운데 허브, 나머지는 길
export function zoneAt(x: number, z: number): Zone {
  if (Math.abs(x) <= HUB_HALF && Math.abs(z) <= HUB_HALF) return 'hub';
  if (z < -5.5) return 'big';
  if (x < -5.5 || (z > 5.5 && x < -0.5)) return 'mini';
  if (x > 5.5 || (z > 5.5 && x > 0.5)) return 'figure';
  return 'path';
}
