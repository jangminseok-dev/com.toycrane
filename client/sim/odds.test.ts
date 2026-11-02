import { appendFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { loadRapier } from '../src/physics/rapier';
import { MachineWorld, type Rapier } from '../src/physics/machineWorld';
import { aimRate, fillMachine, overlaps, seededRandom } from './world';

// 확률 맞추기 (물리 뽑기 설계 §5·§8.1): SIM_TRIALS(기본 300, 맞출 때 1000)
let R: Rapier;
beforeAll(async () => { R = await loadRapier(); });
const trials = Number(process.env.SIM_TRIALS ?? 300);
// vitest가 지나가는 시험의 콘솔을 삼킬 때를 위해 SIM_OUT 파일로도 남긴다
const note = (...v: unknown[]) => { console.log(...v); if (process.env.SIM_OUT) appendFileSync(process.env.SIM_OUT, v.join(' ') + '\n'); };
const between = (v: number, lo: number, hi: number) => { expect(v).toBeGreaterThanOrEqual(lo); expect(v).toBeLessThanOrEqual(hi); };

// 사용자 2026-11-02 '하나도 안 뽑혀 재미없다' — 머리 겨냥 3~4/10 → 5/10쯤(사람 눈대중 겨냥은 시뮬보다 서툴다)
test('head aim wins about half the time', () => { const r = aimRate(R, { trials }); note('head', r); between(r, 0.45, 0.62); });
// 몸통 겨냥 = 머리 중심에서 12cm 옆 (8cm는 아직 머리에 걸린다). 머리 확률이 우선이라 윗선을 0.26까지 (Task 8 ruling).
// 2026-11-01 인형이 구르지 않게 감쇠를 올린 뒤(사용자 요청) 서 있는 인형이 손가락 쪽으로 기울어 들어오지 않아 7%로 내려갔다 — 아랫선 0.05 (머리 3~4/10·먼 쪽·희귀가 우선, 누운 인형 몸통 잡기는 장면 시뮬이 지킨다)
test('body aim wins less often than the head', () => { const r = aimRate(R, { trials, aimOff: 0.12 }); note('body', r); between(r, 0.03, 0.26); }); // 150판에서는 4%(6판)까지 흔들린다
// 희귀·황금·먼 쪽은 서 있는 형(곰)과 동글이형 하나(펭귄)로 잰다 (인형 리뉴얼 설계 §6)
for (const kind of ['bear', 'penguin']) {
  test(`rare and gold ${kind} are harder`, () => {
    const rare = aimRate(R, { trials, kind, look: { rare: 'star' } }), gold = aimRate(R, { trials, kind, look: { rare: 'gold' } });
    note(kind, 'rare', rare, 'gold', gold);
    between(rare, 0.25, 0.42); between(gold, 0.18, 0.32); // 보통(5/10)보다 어렵게 — 집게 힘 5.4에서
  });
  test(`far ${kind} dolls win more than near ones`, () => {
    const near = aimRate(R, { trials, kind, where: 'near' }), far = aimRate(R, { trials, kind, where: 'far' });
    note(kind, 'near', near, 'far', far);
    expect(far).toBeGreaterThan(near);
  });
}
test('no interpenetration after settling', () => {
  let total = 0;
  for (let seed = 1; seed <= 20; seed++) { const w = new MachineWorld(R, fillMachine('bear', seededRandom(seed))); w.settle(8); total += overlaps(w); w.dispose(); }
  expect(total).toBe(0);
});
