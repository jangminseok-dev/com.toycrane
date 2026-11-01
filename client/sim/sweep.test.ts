import { beforeAll, test } from 'vitest';
import { CLAW } from '../src/data/claw';
import { loadRapier } from '../src/physics/rapier';
import type { Rapier } from '../src/physics/machineWorld';
import { appendFileSync } from 'node:fs';
import { aimRate } from './world';
let R: Rapier; beforeAll(async () => { R = await loadRapier(); });
const trials = Number(process.env.SIM_TRIALS ?? 150);
// 손으로 돌리는 탐색: FORCES, TWO, SPREADS, RARE, GOLD 환경변수로 표를 바꿔 가며 성공률을 찍는다
const KIND = process.env.KIND;
test.skipIf(!!KIND)('sweep', () => {
  for (const f of (process.env.FORCES ?? String(CLAW.base_force)).split(',').map(Number)) {
  CLAW.quality.two = Number(process.env.TWO ?? CLAW.quality.two);
  CLAW.rare.rare = Number(process.env.RARE ?? CLAW.rare.rare); CLAW.rare.gold = Number(process.env.GOLD ?? CLAW.rare.gold);
  for (const spread of (process.env.SPREADS ?? String(CLAW.spread)).split(',').map(Number)) {
    CLAW.spread = spread;
    const head = aimRate(R, { trials, baseForce: f }), body = aimRate(R, { trials, aimOff: Number(process.env.AIMOFF ?? 0.08), baseForce: f });
    const rare = aimRate(R, { trials, baseForce: f, look: { rare: 'star' } }), gold = aimRate(R, { trials, baseForce: f, look: { rare: 'gold' } });
    const near = aimRate(R, { trials, baseForce: f, where: 'near' }), far = aimRate(R, { trials, baseForce: f, where: 'far' });
    const line = `force ${f} two ${CLAW.quality.two} spread ${spread} rare ${CLAW.rare.rare} gold ${CLAW.rare.gold}: head ${head.toFixed(3)} body ${body.toFixed(3)} rare ${rare.toFixed(3)} gold ${gold.toFixed(3)} near ${near.toFixed(3)} far ${far.toFixed(3)}`;
    console.log(line);
    if (process.env.SWEEP_OUT) appendFileSync(process.env.SWEEP_OUT, line + '\n'); // vitest가 지나가는 테스트의 콘솔을 삼킬 때를 위해 파일로도
  }
  }
});

// 종류별 배율 찾기 (인형 리뉴얼 설계 §6): KIND=<id> FACTORS=1.2,1.4 — 그 종의 머리 겨냥만 잰다
test.runIf(!!KIND)('sweep one kind', () => {
  for (const k of (process.env.FACTORS ?? '1').split(',').map(Number)) {
    CLAW.kind[KIND!] = k;
    const line = `kind ${KIND} factor ${k}: head ${aimRate(R, { trials, kind: KIND }).toFixed(3)}`;
    console.log(line);
    if (process.env.SWEEP_OUT) appendFileSync(process.env.SWEEP_OUT, line + '\n');
  }
});
