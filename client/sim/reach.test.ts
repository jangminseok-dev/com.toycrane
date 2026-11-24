import { beforeAll, test } from 'vitest';
import { appendFileSync } from 'node:fs';
import { MACHINE_SPEC } from '../src/data/storeLayout';
import type { DollSpot } from '../src/net/protocol';
import { ClawBody } from '../src/physics/clawBody';
import { runCycle } from '../src/physics/clawCycle';
import { loadRapier } from '../src/physics/rapier';
import { MachineWorld, type Rapier } from '../src/physics/machineWorld';
import { fillMachine, headAt, openDolls, seededRandom, settleSpots } from './world';

// 손으로 돌리는 탐색(인형 기계 재배치 설계 2026-11-24): 유리 쪽 인형이 집게 가운데 범위(play_half − 0.07)를 몇 cm 벗어나면 못 잡는지.
// 인형 하나를 벽 쪽에 두고 앉힌 뒤, 실제로 앉은 가운데가 범위를 벗어난 정도(cm)별로 그 머리를 겨냥한(범위로 자른) 한 바퀴의 성공률을 찍는다.
// REACH=1 SIM_TRIALS=120 SWEEP_OUT=<파일> npx vitest run --config vitest.sim.config.ts sim/reach.test.ts
let R: Rapier; beforeAll(async () => { R = await loadRapier(); });
const EDGE = 0.07;
test.runIf(!!process.env.REACH)('reach', () => {
  const trials = Number(process.env.SIM_TRIALS ?? 120), rng = seededRandom(11);
  const [W, D] = MACHINE_SPEC.play_half, RW = W - EDGE, RD = D - EDGE, [hx, hz] = MACHINE_SPEC.hole;
  const bins = new Map<number, { n: number; won: number }>(); // 2cm 띠(아래쪽 끝 cm) → 판 수·성공
  for (let i = 0, guard = 0; i < trials && guard < trials * 20; guard++) {
    const side = Math.floor(rng() * 4), o = Number(process.env.O_MIN ?? -0.02) + rng() * Number(process.env.O_SPAN ?? 0.12);
    const along = (rng() * 2 - 1) * (side < 2 ? RD : RW);
    const [tx, tz] = side === 0 ? [RW + o, along] : side === 1 ? [-(RW + o), along] : side === 2 ? [along, RD + o] : [along, -(RD + o)];
    if (Math.abs(tx - hx) < 0.3 && Math.abs(tz - hz) < 0.3) continue; // 구멍 둘레는 빼고
    const fill = fillMachine('bear', rng).slice(0, 8).filter((s) => Math.hypot(s[1] - tx, s[3] - tz) >= 0.22);
    const target: DollSpot = ['bear', tx, null, tz, 0, 0, 0, 1, 0, 'n', 0, '', 99];
    const spots = settleSpots(R, [...fill, target]);
    const t = spots.find((s) => s[12] === 99)!;
    if (!openDolls(spots).includes(t)) continue;
    const over = Math.max(Math.abs(t[1]) - RW, Math.abs(t[3]) - RD);
    const head = headAt(t), x = Math.min(Math.max(head.x, -RW), RW), z = Math.min(Math.max(head.z, -RD), RD);
    const world = new MachineWorld(R, spots);
    const r = runCycle(world, new ClawBody(R, world), x, z, {});
    world.dispose();
    const key = Math.floor(over * 50) * 2; // 2cm 띠
    const b = bins.get(key) ?? { n: 0, won: 0 };
    b.n++; b.won += r.won.includes(99) ? 1 : 0; bins.set(key, b);
    i++;
  }
  for (const [k, b] of [...bins].sort((a, c) => a[0] - c[0])) {
    const line = `over ${k}~${k + 2}cm: ${b.won}/${b.n} = ${(b.won / b.n).toFixed(2)}`;
    console.log(line);
    if (process.env.SWEEP_OUT) appendFileSync(process.env.SWEEP_OUT, line + '\n');
  }
});
