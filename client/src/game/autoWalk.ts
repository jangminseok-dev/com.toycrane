import { OBSTACLES } from '../data/storeLayout';
import { MAP_HALF } from '../world/layout';
import type { Vec2 } from './movement';

// 저절로 걷기 (설계 2026-10-31 §3.11 "코인이 없어요 · 교환소로"): 0.25m 격자에서 장애물(탑·기계·교환소·장식, 0.35m 여유)을 피해
// 8방향으로 가는 가장 짧은 길을 찾고, 방향이 바뀌는 곳마다 꺾이는 점들을 차례로 따라간다
const CELL = 0.25, MARGIN = 0.35, ARRIVE = 0.15;
const N = Math.round((MAP_HALF * 2) / CELL) + 1;
const at = (i: number) => -MAP_HALF + i * CELL;
const cellOf = (v: number) => Math.max(0, Math.min(N - 1, Math.round((v + MAP_HALF) / CELL)));
let blocked: Uint8Array | null = null;
function grid(): Uint8Array {
  if (blocked) return blocked;
  blocked = new Uint8Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = at(i), z = at(j);
    blocked[i * N + j] = OBSTACLES.some(([x0, z0, x1, z1]) => x > x0 - MARGIN && x < x1 + MARGIN && z > z0 - MARGIN && z < z1 + MARGIN) ? 1 : 0;
  }
  return blocked;
}

// from에서 to까지 꺾이는 점들 (마지막은 to 그대로). 길이 없으면 [to]
export function routeTo(from: Vec2, to: Vec2): Vec2[] {
  const g = grid(), start = cellOf(from.x) * N + cellOf(from.z), goal = cellOf(to.x) * N + cellOf(to.z);
  const prev = new Int32Array(N * N).fill(-2);
  prev[start] = -1;
  const queue = [start];
  for (let q = 0; q < queue.length && prev[goal] === -2; q++) {
    const c = queue[q], ci = Math.floor(c / N), cj = c % N;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const i = ci + di, j = cj + dj, n = i * N + j;
      if (i < 0 || j < 0 || i >= N || j >= N || prev[n] !== -2 || (g[n] && n !== goal)) continue;
      if (di && dj && (g[ci * N + j] || g[i * N + cj])) continue; // 모서리를 비스듬히 스치지 않게
      prev[n] = c; queue.push(n);
    }
  }
  if (prev[goal] === -2) return [to];
  const cells: number[] = [];
  for (let c = goal; c !== -1; c = prev[c]) cells.unshift(c);
  const dirOf = (a: number, b: number) => `${Math.floor(b / N) - Math.floor(a / N)},${(b % N) - (a % N)}`;
  const pts: Vec2[] = [];
  for (let k = 1; k < cells.length - 1; k++) {
    if (dirOf(cells[k - 1], cells[k]) !== dirOf(cells[k], cells[k + 1])) pts.push({ x: at(Math.floor(cells[k] / N)), z: at(cells[k] % N) });
  }
  pts.push(to);
  return pts;
}

// 꺾이는 점을 하나씩 내준다. 손으로 움직이면(cancel) 멈춘다
export class AutoWalk {
  private points: Vec2[] = [];
  counter: number | null = null; // 이 길 끝에서 줄 설 교환소

  start(points: Vec2[], counter: number): void {
    this.points = [...points];
    this.counter = counter;
  }

  cancel(): void {
    this.points = [];
    this.counter = null;
  }

  next(pos: Vec2): Vec2 | null {
    while (this.points.length > 1 && Math.hypot(this.points[0].x - pos.x, this.points[0].z - pos.z) < ARRIVE) this.points.shift();
    return this.points[0] ?? null;
  }
}
