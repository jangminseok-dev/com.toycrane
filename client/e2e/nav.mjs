// e2e 공용 길 찾기 (큰 홀, 설계 2026-11-01): 배치 파일(shared/store_layout.json)에서 매장 크기·장애물·기계 앞자리를 읽는다.
// 0.25m 격자에서 장애물(0.35m 여유)을 피해 8방향으로 가는 가장 짧은 길 → 방향이 바뀌는 곳마다 꺾이는 점들
import fs from 'node:fs';

export const LAYOUT = JSON.parse(fs.readFileSync(new URL('../../shared/store_layout.json', import.meta.url), 'utf8'));
export const HALF = LAYOUT.hall.map_half - 0.3; // 벽에 붙지 않게
const CELL = 0.25, N = Math.round((HALF * 2) / CELL) + 1;
const free = (x, z) => Math.abs(x) <= HALF && Math.abs(z) <= HALF
  && !LAYOUT.obstacles.some(([x0, z0, x1, z1]) => x > x0 - 0.35 && x < x1 + 0.35 && z > z0 - 0.35 && z < z1 + 0.35);
const cellOf = (v) => Math.max(0, Math.min(N - 1, Math.round((v + HALF) / CELL)));
const at = (i) => -HALF + i * CELL;
// 자리가 격자 사이·여유선에 걸리면 둘레에서 가장 가까운 빈 칸으로
function snap(p) {
  const i0 = cellOf(p.x), j0 = cellOf(p.z);
  let best = i0 * N + j0, bestD = Infinity;
  for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
    const i = i0 + di, j = j0 + dj;
    if (i < 0 || j < 0 || i >= N || j >= N || !free(at(i), at(j))) continue;
    const d = Math.hypot(at(i) - p.x, at(j) - p.z);
    if (d < bestD) { bestD = d; best = i * N + j; }
  }
  return best;
}

export function route(from, to) {
  const start = snap(from), goal = snap(to);
  const prev = new Map([[start, -1]]), queue = [start];
  for (let q = 0; q < queue.length && !prev.has(goal); q++) {
    const c = queue[q], ci = Math.floor(c / N), cj = c % N;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const i = ci + di, j = cj + dj, n = i * N + j;
      if (i < 0 || j < 0 || i >= N || j >= N || prev.has(n) || !free(at(i), at(j))) continue;
      prev.set(n, c); queue.push(n);
    }
  }
  if (!prev.has(goal)) return [to];
  const cells = [];
  for (let c = goal; c !== -1; c = prev.get(c)) cells.unshift(c);
  const pts = [];
  for (let k = 1; k < cells.length; k++) {
    const d = (a, b) => [Math.floor(b / N) - Math.floor(a / N), (b % N) - (a % N)].join();
    if (k === cells.length - 1 || d(cells[k - 1], cells[k]) !== d(cells[k], cells[k + 1])) pts.push({ x: at(Math.floor(cells[k] / N)), z: at(cells[k] % N) });
  }
  pts.push(to);
  return pts;
}

// 기계 앞에 서서 하는 자리 (ry를 쓴다 — 큰 홀의 인형 기계는 광장 쪽 +x를 본다)
export function frontOf(id) {
  const m = LAYOUT.machines.find((x) => x.id === id) ?? LAYOUT.figures.find((x) => x.id === id); // 인형 기계·피규어 기계(9단계)
  return { x: m.x + Math.sin(m.ry) * LAYOUT.machine.front, z: m.z + Math.cos(m.ry) * LAYOUT.machine.front };
}

// 4방향 길(1m마다 점) — 키보드로 한 축씩 걸을 때 점 사이가 짧아 장애물을 스치지 않는다
export function route4(from, to) {
  const start = snap(from), goal = snap(to);
  const prev = new Map([[start, -1]]), queue = [start];
  for (let q = 0; q < queue.length && !prev.has(goal); q++) {
    const c = queue[q], ci = Math.floor(c / N), cj = c % N;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = ci + di, j = cj + dj, n = i * N + j;
      if (i < 0 || j < 0 || i >= N || j >= N || prev.has(n) || !free(at(i), at(j))) continue;
      prev.set(n, c); queue.push(n);
    }
  }
  if (!prev.has(goal)) return [to];
  const cells = [];
  for (let c = goal; c !== -1; c = prev.get(c)) cells.unshift(c);
  return [...cells.filter((_, k) => k % 4 === 0).map((c) => ({ x: at(Math.floor(c / N)), z: at(c % N) })), to];
}

// 서버가 알려 주는 내 위치(posOf)를 보며 키보드(key(code, 초))로 goal까지 걷는다 (걷기 3.2m/s)
export async function walk(key, posOf, goal) {
  let pos = posOf();
  for (const p of route4(pos, goal)) {
    await key(p.x > pos.x ? 'KeyD' : 'KeyA', Math.abs(p.x - pos.x) / 3.2);
    await key(p.z > pos.z ? 'KeyS' : 'KeyW', Math.abs(p.z - pos.z) / 3.2);
    pos = p;
  }
  for (let k = 0; k < 8; k++) {
    await new Promise((r) => setTimeout(r, 400));
    const q = posOf(), dx = goal.x - q.x, dz = goal.z - q.z;
    if (Math.hypot(dx, dz) < 0.25) break;
    if (Math.abs(dx) > 0.1) await key(dx > 0 ? 'KeyD' : 'KeyA', Math.min(1.5, Math.abs(dx) / 3.2));
    if (Math.abs(dz) > 0.1) await key(dz > 0 ? 'KeyS' : 'KeyW', Math.min(1.5, Math.abs(dz) / 3.2));
  }
}
