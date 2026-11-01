import { appendFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { DOLLS } from '../src/data/catalog';
import { loadRapier } from '../src/physics/rapier';
import type { Rapier } from '../src/physics/machineWorld';
import { aimRate } from './world';

// 종류마다 머리 겨냥 10판에 3~4번 (인형 리뉴얼 설계 §6) — SIM_KINDS(쉼표, 없으면 24종), SIM_TRIALS(기본 300, 맞출 때 1000)
let R: Rapier;
beforeAll(async () => { R = await loadRapier(); });
const trials = Number(process.env.SIM_TRIALS ?? 300);
const kinds = process.env.SIM_KINDS ? process.env.SIM_KINDS.split(',') : Object.keys(DOLLS);

for (const kind of kinds) {
  test(`${kind} head aim wins three or four in ten`, () => {
    const r = aimRate(R, { trials, kind });
    console.log('kind', kind, r);
    if (process.env.SIM_OUT) appendFileSync(process.env.SIM_OUT, `${kind} ${trials} ${r.toFixed(3)}\n`); // vitest가 지나가는 시험의 콘솔을 삼킬 때를 위해 파일로도
    expect(r, kind).toBeGreaterThanOrEqual(0.30);
    expect(r, kind).toBeLessThanOrEqual(0.40);
  }, 3_600_000);
}
