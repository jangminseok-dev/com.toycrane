import { beforeAll, expect, test } from 'vitest';
import { loadRapier } from '../src/physics/rapier';
import { MachineWorld, type Rapier } from '../src/physics/machineWorld';
import { aimRate, fillMachine, overlaps, seededRandom } from './world';

// 확률 맞추기 (물리 뽑기 설계 §5·§8.1): SIM_TRIALS(기본 300, 맞출 때 1000)
let R: Rapier;
beforeAll(async () => { R = await loadRapier(); });
const trials = Number(process.env.SIM_TRIALS ?? 300);
const between = (v: number, lo: number, hi: number) => { expect(v).toBeGreaterThanOrEqual(lo); expect(v).toBeLessThanOrEqual(hi); };

test('head aim wins three or four in ten', () => { const r = aimRate(R, { trials }); console.log('head', r); between(r, 0.30, 0.40); });
// 몸통 겨냥 = 머리 중심에서 12cm 옆 (8cm는 아직 머리에 걸린다). 머리 확률이 우선이라 윗선을 0.26까지 (Task 8 ruling).
// 2026-11-01 인형이 구르지 않게 감쇠를 올린 뒤(사용자 요청) 서 있는 인형이 손가락 쪽으로 기울어 들어오지 않아 7%로 내려갔다 — 아랫선 0.05 (머리 3~4/10·먼 쪽·희귀가 우선, 누운 인형 몸통 잡기는 장면 시뮬이 지킨다)
test('body aim wins less often than the head', () => { const r = aimRate(R, { trials, aimOff: 0.12 }); console.log('body', r); between(r, 0.03, 0.26); }); // 150판에서는 4%(6판)까지 흔들린다
test('rare and gold are harder', () => {
  const rare = aimRate(R, { trials, look: { rare: 'star' } }), gold = aimRate(R, { trials, look: { rare: 'gold' } });
  console.log('rare', rare, 'gold', gold);
  between(rare, 0.13, 0.22); between(gold, 0.08, 0.15);
});
test('far dolls win more than near ones', () => {
  const near = aimRate(R, { trials, where: 'near' }), far = aimRate(R, { trials, where: 'far' });
  console.log('near', near, 'far', far);
  expect(far).toBeGreaterThan(near);
});
test('no interpenetration after settling', () => {
  let total = 0;
  for (let seed = 1; seed <= 20; seed++) { const w = new MachineWorld(R, fillMachine('bear', seededRandom(seed))); w.settle(8); total += overlaps(w); w.dispose(); }
  expect(total).toBe(0);
});
