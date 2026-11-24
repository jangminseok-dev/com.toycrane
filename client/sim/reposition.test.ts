import { beforeAll, expect, test } from 'vitest';
import { CLAW } from '../src/data/claw';
import { MACHINE_SPEC } from '../src/data/storeLayout';
import type { DollSpot } from '../src/net/protocol';
import { loadRapier } from '../src/physics/rapier';
import type { Rapier } from '../src/physics/machineWorld';
import { seededRandom, settledMachine, settleSpots, spawnSpot } from './world';

// 인형 기계 재배치(설계 2026-11-24 '실패로 볼 것'): 직원이 옮긴 인형(집게 가운데 범위 안에서 떨어뜨림)이 앉은 뒤 다시 못 닿는 자리가 되면 안 된다.
// 다른 인형 위에 떨어져 굴러가는 몫은 물리라 0이 될 수 없다(2026-11-24: 옮긴 인형 4.4%, 더 안쪽 5·10cm에도 3.1%, 새로 채운 인형은 6.0%) —
// 그런 인형은 판 끝 정리·직원 부르기가 다시 옮긴다. 그래서 새로 채운 인형보다 덜, 그리고 5% 이하인지만 본다.
// 서버 crane.unreachable과 같은 판정 — 앉은 가운데가 집게 가운데 범위를 out보다 더 벗어남
let R: Rapier; beforeAll(async () => { R = await loadRapier(); });
const { edge, out } = CLAW.reposition, RW = MACHINE_SPEC.play_half[0] - edge, RD = MACHINE_SPEC.play_half[1] - edge;
const unreachable = (s: DollSpot) => s[2] !== null && (Math.abs(s[1]) > RW + out || Math.abs(s[3]) > RD + out);
test('a doll the staff moved settles where the claw reaches', () => {
  const trials = Number(process.env.SIM_TRIALS ?? 120), rng = seededRandom(23);
  let moved = 0, bad = 0, fresh = 0, freshBad = 0;
  for (let i = 0; i < trials; i++) {
    const spots = settledMachine(R, 'bear', rng);
    fresh += spots.length; freshBad += spots.filter(unreachable).length;
    const pick = new Set([spots[Math.floor(rng() * spots.length)][12], spots[Math.floor(rng() * spots.length)][12]]);
    const keep = spots.filter((s) => !pick.has(s[12]));
    const again = spots.map((s) => {
      if (!pick.has(s[12])) return s;
      const [x, z] = spawnSpot(keep, rng, 0);
      const d: DollSpot = [s[0], x, null, z, 0, 0, 0, 1, s[8], s[9], s[10], s[11], s[12]];
      keep.push(d);
      return d;
    });
    for (const s of settleSpots(R, again)) if (pick.has(s[12])) { moved++; bad += unreachable(s) ? 1 : 0; }
  }
  console.log(`moved ${moved} unreachable after settle ${bad}; fresh ${fresh} unreachable ${freshBad}`);
  expect(bad / moved).toBeLessThanOrEqual(0.05);
  expect(bad / moved).toBeLessThan(freshBad / fresh);
}, 1_800_000);
