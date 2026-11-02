import { COUNTERS, OBSTACLES } from '../data/storeLayout';
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

// 기계 사이 좁은 틈처럼 여유 때문에 막힌 칸에서 출발하면(사람은 지나간다) 길을 못 찾아 직진하다 벽에 막혔다(사용자 2026-11-02 '계속 제자리걸음'):
// 장애물 몸통은 피해 가장 가까운 트인 칸을 찾는다 — 그 칸이 첫 꺾이는 점. 2m 안에 없으면 그대로
const STEP_OUT = Math.round(2 / CELL), DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const solid = (i: number, j: number) => OBSTACLES.some(([x0, z0, x1, z1]) => at(i) > x0 && at(i) < x1 && at(j) > z0 && at(j) < z1);
function nearestFree(g: Uint8Array, start: number): number {
  const seen = new Set([start]), queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q], ci = Math.floor(c / N), cj = c % N;
    if (!g[c]) return c;
    if (Math.abs(ci - Math.floor(start / N)) >= STEP_OUT || Math.abs(cj - (start % N)) >= STEP_OUT) continue;
    for (const [di, dj] of DIRS) {
      const i = ci + di, j = cj + dj, n = i * N + j;
      if (i < 0 || j < 0 || i >= N || j >= N || seen.has(n) || solid(i, j)) continue;
      seen.add(n); queue.push(n);
    }
  }
  return start;
}

// from에서 to까지 꺾이는 점들 (마지막은 to 그대로). 길이 없으면 [to]
export function routeTo(from: Vec2, to: Vec2): Vec2[] {
  const g = grid(), goal = cellOf(to.x) * N + cellOf(to.z), first = cellOf(from.x) * N + cellOf(from.z);
  const start = g[first] ? nearestFree(g, first) : first;
  const out: Vec2[] = start !== first ? [{ x: at(Math.floor(start / N)), z: at(start % N) }] : [];
  const prev = new Int32Array(N * N).fill(-2);
  prev[start] = -1;
  const queue = [start];
  for (let q = 0; q < queue.length && prev[goal] === -2; q++) {
    const c = queue[q], ci = Math.floor(c / N), cj = c % N;
    for (const [di, dj] of DIRS) {
      const i = ci + di, j = cj + dj, n = i * N + j;
      if (i < 0 || j < 0 || i >= N || j >= N || prev[n] !== -2 || (g[n] && n !== goal)) continue;
      if (di && dj && (g[ci * N + j] || g[i * N + cj])) continue; // 모서리를 비스듬히 스치지 않게
      prev[n] = c; queue.push(n);
    }
  }
  if (prev[goal] === -2) return [...out, to];
  const cells: number[] = [];
  for (let c = goal; c !== -1; c = prev[c]) cells.unshift(c);
  const dirOf = (a: number, b: number) => `${Math.floor(b / N) - Math.floor(a / N)},${(b % N) - (a % N)}`;
  for (let k = 1; k < cells.length - 1; k++) {
    if (dirOf(cells[k - 1], cells[k]) !== dirOf(cells[k], cells[k + 1])) out.push({ x: at(Math.floor(cells[k] / N)), z: at(cells[k] % N) });
  }
  out.push(to);
  return out;
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

// '교환소 가기': 걸어서 가장 가까운 교환소(창구까지 길이 가장 짧은 곳)와 그 길
export function nearestCounter(from: Vec2): { counter: number; route: Vec2[] } {
  const length = (pts: Vec2[]) => pts.reduce((sum, p, i) => sum + Math.hypot(p.x - (i ? pts[i - 1].x : from.x), p.z - (i ? pts[i - 1].z : from.z)), 0);
  let best: { counter: number; route: Vec2[]; len: number } | null = null;
  for (const c of COUNTERS) {
    const route = routeTo(from, { x: c.window[0], z: c.window[1] }), len = length(route);
    if (!best || len < best.len) best = { counter: c.id, route, len };
  }
  return { counter: best!.counter, route: best!.route };
}
