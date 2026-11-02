import { test } from 'vitest';
import { appendFileSync } from 'node:fs';
import { OBSTACLES, COUNTERS } from '../src/data/storeLayout';
import { MAP_HALF } from '../src/world/layout';
import { AutoWalk, nearestCounter } from '../src/game/autoWalk';
import { step, clampToFloor } from '../src/game/movement';
const OUT = process.env.WALK_OUT!;
test('walk to counter from everywhere', () => {
  let starts = 0, stuck = 0; const fails: string[] = [];
  for (let x = -MAP_HALF + 0.5; x <= MAP_HALF - 0.5; x += 0.5) for (let z = -MAP_HALF + 0.5; z <= MAP_HALF - 0.5; z += 0.5) {
    if (OBSTACLES.some(([x0, z0, x1, z1]) => x > x0 - 0.05 && x < x1 + 0.05 && z > z0 - 0.05 && z < z1 + 0.05)) continue;
    starts++;
    let pos = clampToFloor({ x, z });
    const { counter, route } = nearestCounter(pos), w = new AutoWalk(); w.start(route, counter);
    const goal = COUNTERS[counter].window;
    let ok = false, t = 0;
    for (; t < 120; t += 1 / 60) {
      const target = w.next(pos); if (!target) break;
      const dx = target.x - pos.x, dz = target.z - pos.z, d = Math.hypot(dx, dz) || 1;
      pos = step(pos, { x: dx / d, z: dz / d }, 1 / 60);
      if (Math.hypot(pos.x - goal[0], pos.z - goal[1]) < 0.3) { ok = true; break; }
    }
    if (!ok) { stuck++; if (fails.length < 40) fails.push(`start (${x},${z}) ended (${pos.x.toFixed(2)},${pos.z.toFixed(2)}) counter ${counter} route ${JSON.stringify(route.map((p) => [+p.x.toFixed(2), +p.z.toFixed(2)]))}`); }
  }
  appendFileSync(OUT, `starts ${starts} stuck ${stuck}\n${fails.join('\n')}\n`);
});
