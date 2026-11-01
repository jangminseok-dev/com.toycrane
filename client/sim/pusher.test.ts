import * as THREE from 'three';
import { appendFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { CLAW } from '../src/data/claw';
import { DOLLS } from '../src/data/catalog';
import { PUSHER } from '../src/data/pushers';
import { MACHINE_SPEC } from '../src/data/storeLayout';
import type { DollSpot } from '../src/net/protocol';
import { ClawBody } from '../src/physics/clawBody';
import { runCycle } from '../src/physics/clawCycle';
import { PusherWorld } from '../src/physics/pusherWorld';
import { loadRapier, type Rapier } from '../src/physics/rapier';
import { headOf } from '../src/world/dolls';
import { DOLL_FLOOR } from '../src/world/machine';
import { openDolls, seededRandom, withPoses, type Rng } from './world';

// 미는 뽑기 판수(설계 ring-hook §4): 영리한 사람(칸에서 위가 열린 미니 인형의 머리를 겨냥, 눈대중 오차 ±1.5cm)은 처음 기계에서
// 50%선 4~6판, 아무 데나 누르는 사람은 그보다 오래. 겨누는 동안(aimSeconds)에도 판이 오가며 민다(진짜처럼). SIM_TRIALS(기본 40), SIM_OUT
// 맞추기용: PUSHER_PATCH='{"ledge":{"z1":0.3}}'처럼 수치 일부를 바꿔 돌려 본다(shared/pusher.json은 그대로)
if (process.env.PUSHER_PATCH) {
  const patch = JSON.parse(process.env.PUSHER_PATCH) as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) Object.assign(PUSHER as Record<string, unknown>, { [k]: typeof v === 'object' && v ? { ...(PUSHER as Record<string, object>)[k], ...v } : v });
}
let R: Rapier;
beforeAll(async () => { R = await loadRapier(); });
const trials = Number(process.env.SIM_TRIALS ?? 40), CAP = 30, AIM_SECONDS = 8;
const KINDS = Object.keys(DOLLS), { ledge } = PUSHER, [W, D] = MACHINE_SPEC.play_half;

// 처음 기계: 칸에 count개(섞인 24종), 턱 앞쪽에 on_ledge개 — 서버 pusher_crane.new_stock과 같은 규칙
function freshMachine(rng: Rng): DollSpot[] {
  const spots: DollSpot[] = [], spot = (uid: number, x: number, z: number): DollSpot => [KINDS[Math.floor(rng() * KINDS.length)], x, null, z, 0, 0, 0, 1, Math.floor(rng() * 6), 'n', Math.floor(rng() * 5), '', uid];
  for (let uid = 1; uid <= PUSHER.count; uid++) spots.push(spot(uid, ledge.x1 + 0.06 + rng() * (W - ledge.x1 - 0.06), (rng() * 2 - 1) * D));
  for (let k = 0; k < PUSHER.on_ledge; k++) spots.push(spot(PUSHER.count + k + 1, ledge.x0 + 0.08 + rng() * (ledge.x1 - ledge.x0 - 0.14), ledge.z0 + 0.04 + rng() * 0.08));
  const w = new PusherWorld(R, spots);
  w.settle(3); // 화면(main.ts settleMachine)과 같은 앉히기 — 판이 한 주기 동안 아무것도 못 밀 때까지(출구로 떨어진 건 칸으로 다시)
  const out = withPoses(w);
  w.dispose();
  return out;
}
const headOfMini = (s: DollSpot) => new THREE.Vector3(0, headOf(s[0]).c * PUSHER.doll_scale, 0).applyQuaternion(new THREE.Quaternion(s[4], s[5], s[6], s[7])).add(new THREE.Vector3(s[1], s[2] ?? DOLL_FLOOR, s[3]));

type Player = (spots: DollSpot[], rng: Rng) => [number, number];
const smart: Player = (spots, rng) => {
  const pile = openDolls(spots.filter((s) => s[1] > ledge.x1 && (s[2] ?? 0) < DOLL_FLOOR + 0.05));
  if (!pile.length) return [0.2, 0];
  const pick = pile[Math.floor(rng() * pile.length)], h = headOfMini(pick), err = () => (rng() * 2 - 1) * 0.015;
  return [Math.max(-W, Math.min(W, h.x + err())), Math.max(-D, Math.min(D, h.z + err()))];
};
const random: Player = (_s, rng) => [(rng() * 2 - 1) * W, (rng() * 2 - 1) * D];

function playsToWin(player: Player, seed: number): number {
  const rng = seededRandom(seed);
  let spots = freshMachine(rng);
  for (let n = 1; n <= CAP; n++) {
    const w = new PusherWorld(R, spots);
    w.setHoleOpen(true);
    for (let t = 0; t < AIM_SECONDS; t += 1 / 60) w.step(1 / 60); // 겨누는 동안에도 판이 오간다
    const early = w.fallen().length;
    const [x, z] = player(withPoses(w), rng);
    const r = runCycle(w, new ClawBody(R, w), x, z, { carryTo: { x: PUSHER.drop[0], z: PUSHER.drop[1] }, settle: PUSHER.settle, baseForce: CLAW.base_force * PUSHER.grip });
    if (early > 0 || r.won.length > 0) { w.dispose(); return n; }
    spots = r.poses.map((p) => { const s = w.spotOf(p.uid)!; return [s[0], p.p[0], p.p[1], p.p[2], ...p.q, s[8], s[9], s[10], s[11], s[12]] as DollSpot; });
    w.dispose();
  }
  return CAP + 1;
}

const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];

test('a careful player wins a mini doll in about four to six plays', () => {
  const smartPlays = Array.from({ length: trials }, (_, i) => playsToWin(smart, 11 + i));
  const randomPlays = Array.from({ length: Math.max(15, trials / 3) }, (_, i) => playsToWin(random, 901 + i));
  const line = `${process.env.PUSHER_PATCH ?? ''} pusher smart p10 ${pct(smartPlays, 0.1)} p50 ${pct(smartPlays, 0.5)} p90 ${pct(smartPlays, 0.9)} random p50 ${pct(randomPlays, 0.5)}`;
  console.log(line);
  if (process.env.SIM_OUT) appendFileSync(process.env.SIM_OUT, `${line}\n`);
  expect(pct(smartPlays, 0.5)).toBeGreaterThanOrEqual(4);
  expect(pct(smartPlays, 0.5)).toBeLessThanOrEqual(6);
  expect(pct(randomPlays, 0.5)).toBeGreaterThan(pct(smartPlays, 0.5)); // 칸이 빽빽해 아무 데나 내려도 뭔가 잡힌다(미니 인형 기계의 성격, 사용자 '좀 더 잘 잡히게') — 그래도 잘 집는 쪽이 빠르다
});
