import { beforeAll, test } from 'vitest';
import { CLAW } from '../src/data/claw';
import { loadRapier } from '../src/physics/rapier';
import type { Rapier } from '../src/physics/machineWorld';
import { aimRate } from './world';
let R: Rapier; beforeAll(async () => { R = await loadRapier(); });
const trials = Number(process.env.SIM_TRIALS ?? 150);
// 손으로 돌리는 탐색: FORCES, TWO, SPREADS, RARE, GOLD 환경변수로 표를 바꿔 가며 성공률을 찍는다
test('sweep', () => {
  for (const f of (process.env.FORCES ?? String(CLAW.base_force)).split(',').map(Number)) {
  CLAW.quality.two = Number(process.env.TWO ?? CLAW.quality.two);
  CLAW.rare.rare = Number(process.env.RARE ?? CLAW.rare.rare); CLAW.rare.gold = Number(process.env.GOLD ?? CLAW.rare.gold);
  for (const spread of (process.env.SPREADS ?? String(CLAW.spread)).split(',').map(Number)) {
    CLAW.spread = spread;
    const head = aimRate(R, { trials, baseForce: f }), body = aimRate(R, { trials, aimOff: Number(process.env.AIMOFF ?? 0.08), baseForce: f });
    const rare = aimRate(R, { trials, baseForce: f, look: { rare: 'star' } }), gold = aimRate(R, { trials, baseForce: f, look: { rare: 'gold' } });
    const near = aimRate(R, { trials, baseForce: f, where: 'near' }), far = aimRate(R, { trials, baseForce: f, where: 'far' });
    console.log(`force ${f} two ${CLAW.quality.two} spread ${spread} rare ${CLAW.rare.rare} gold ${CLAW.rare.gold}: head ${head.toFixed(3)} body ${body.toFixed(3)} rare ${rare.toFixed(3)} gold ${gold.toFixed(3)} near ${near.toFixed(3)} far ${far.toFixed(3)}`);
  }
  }
});
