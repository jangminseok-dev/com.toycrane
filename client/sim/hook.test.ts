import * as THREE from 'three';
import { appendFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { FIGURE } from '../src/data/figures';
import { HOOK, type RingSide } from '../src/data/hooks';
import type { BoxWire } from '../src/net/protocol';
import { FigureClaw } from '../src/physics/figureClaw';
import { runFigureCycle } from '../src/physics/figureCycle';
import { HookWorld, holeFromHinge, hookStart } from '../src/physics/hookWorld';
import { loadRapier, type Rapier } from '../src/physics/rapier';

// 고리 걸기 판수(설계 ring-hook §3): 영리한 사람(고리 구멍 가운데에 팔 끝을 넣으려 함, 눈대중 오차 ±1.5cm, 팔은 닿는 쪽 아무거나)은
// 50%선 5~7판, 90%선 18판 안. 아무 데나 누르는 사람은 그보다 2배 넘게 걸린다. 8판 동안 거의 안 움직이면 직원이 반듯이 다시 놓는다(서버 규칙).
// SIM_TRIALS(기본 60), SIM_OUT(파일로도)
let R: Rapier;
beforeAll(async () => { R = await loadRapier(); });
const trials = Number(process.env.SIM_TRIALS ?? 60), CAP = 30;
const SIDES: RingSide[] = ['right', 'left'];
const TIP = 0.155; // 벌린 팔 끝이 집게 가운데에서 떨어진 거리(x)
const [hx, hz] = FIGURE.play_half, home = FIGURE.claw.home; // 집게 범위는 피규어 기계와 같다(같은 몸통·집게)

function rng(seed: number) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// 고리 구멍 가운데(월드): 날개(접는 선 자리) + 바깥 방향으로 구멍까지
function holeOf(w: HookWorld): THREE.Vector3 {
  const p = w.flap.translation(), q = w.flap.rotation(), u = holeFromHinge();
  const local = new THREE.Vector3(w.side === 'right' ? u : -u, 0, 0);
  return local.applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)).add(new THREE.Vector3(p.x, p.y, p.z));
}

type Player = (w: HookWorld, rand: () => number) => [number, number];
const smart: Player = (w, rand) => {
  const h = holeOf(w), err = () => (rand() * 2 - 1) * 0.015;
  // 반대쪽 팔 끝이 옆벽에 걸리지 않는 쪽만(벽에 걸리면 집게가 못 내려간다 — 보이니 영리한 사람은 피한다)
  const wall = HOOK.shelf.half_x - 0.02, options = [h.x - TIP, h.x + TIP].filter((x) => x >= home[0] && x <= hx && Math.abs(x) + TIP <= wall);
  const x = options.length ? options[Math.floor(rand() * options.length)] : clamp(h.x - TIP, home[0], hx);
  return [clamp(x + err(), home[0], hx), clamp(h.z + err(), -hz, home[1])];
};
const random: Player = (_w, rand) => [home[0] + rand() * (hx - home[0]), -hz + rand() * (home[1] + hz)];

// 한 상자를 뽑을 때까지 판수(CAP판까지)
function playsToWin(player: Player, seed: number): number {
  const rand = rng(seed), side = SIDES[seed % SIDES.length];
  let box: BoxWire = hookStart(rand), still = 0, lying = 0, best = box[2];
  for (let n = 1; n <= CAP; n++) {
    const w = new HookWorld(R, box, side);
    const [x, z] = player(w, rand);
    const r = runFigureCycle(w, new FigureClaw(R, w, x, z), x, z);
    w.dispose();
    if (r.won) return n;
    // 직원: 8판 동안 출구 쪽(+z)으로 2cm도 못 나왔거나, 3판 동안 쓰러져(고리가 위를 못 봄) 있으면 처음 자리에 반듯이 세운다(서버 hook.py after_play)
    if (r.box[2] > best + HOOK.stuck.progress) { best = r.box[2]; still = 0; } else still++;
    lying = isLying(r.box) ? lying + 1 : 0;
    if (still >= HOOK.stuck.plays || lying >= HOOK.stuck.lying_plays) { box = hookStart(rand); best = box[2]; still = 0; lying = 0; } else box = r.box;
  }
  return CAP + 1;
}

// 쓰러짐: 상자 위쪽(y축)이 45°보다 더 누움
const isLying = (b: BoxWire) => 1 - 2 * (b[3] * b[3] + b[5] * b[5]) < Math.SQRT1_2;

const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];

test('a careful player wins the ring box in about five to seven plays', () => {
  const smartPlays = Array.from({ length: trials }, (_, i) => playsToWin(smart, 101 + i));
  const randomPlays = Array.from({ length: Math.max(20, trials / 3) }, (_, i) => playsToWin(random, 501 + i));
  const line = `hook smart p10 ${pct(smartPlays, 0.1)} p50 ${pct(smartPlays, 0.5)} p90 ${pct(smartPlays, 0.9)} random p50 ${pct(randomPlays, 0.5)}`;
  console.log(line);
  if (process.env.SIM_OUT) appendFileSync(process.env.SIM_OUT, `${line}\n`);
  expect(pct(smartPlays, 0.5)).toBeGreaterThanOrEqual(5);
  expect(pct(smartPlays, 0.5)).toBeLessThanOrEqual(7);
  expect(pct(smartPlays, 0.9)).toBeLessThanOrEqual(18); // 걸리면 한두 판, 안 걸리면 오래 — 고리 걸기의 성격(계획 12 Task 5 Ruling)
  expect(pct(randomPlays, 0.5)).toBeGreaterThan(2 * pct(smartPlays, 0.5));
});
