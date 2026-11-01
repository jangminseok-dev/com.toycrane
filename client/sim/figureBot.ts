import { FIGURE, variantOf, type BoxKind } from '../src/data/figures';
import type { BoxWire } from '../src/net/protocol';
import { FigureClaw } from '../src/physics/figureClaw';
import { runFigureCycle } from '../src/physics/figureCycle';
import { FigureWorld } from '../src/physics/figureWorld';
import type { Rapier } from '../src/physics/rapier';
import { seededRandom, type Rng } from './world';

// 피규어 뽑기 자동 플레이어(9단계 판수 맞추기, 설계 §8 큰 상자 두 종류): 상자 자세를 눈으로 보고 어디를 집을지 고른다. 사람 눈대중처럼 ±1.5cm 오차.
// 긴 상자 — vertical: 세로로 빠뜨리기만(기울이기·세우기), rotate: 돌려서 빠뜨리기만(모서리 누르기)
// 정사각형 — flip: 앞 끝을 들썩여 세워 뒤집기, drag: 뒤 끝을 걸어 끌어오며 세우기(영상의 '살려오기')
// smart: 기운 상자는 높은 끝을 눌러 세우고, 아니면 그 종류의 첫 공략 — 두 판 연속 거의 안 움직이면(사람처럼) 둘째 공략으로 바꾼다. masher: 아무 데나 누름
export type Strategy = 'smart' | 'vertical' | 'rotate' | 'flip' | 'drag' | 'masher';
export const TECHNIQUES: Record<BoxKind, [Strategy, Strategy]> = { long: ['vertical', 'rotate'], square: ['flip', 'drag'] };
const AIM_ERR = 0.015, TILT = 0.015, STALL_MOVE = 0.005, STALL_TURN = 0.05, STALL_PLAYS = 2; // m, m, m, rad, 판
export type BotMemo = { stall: number; corners: boolean };
const [HALF_X, HALF_Z] = FIGURE.play_half;

type Look = { cx: number; cz: number; yaw: number; ends: { x: number; z: number; y: number; sign: number }[] };

// 상자 자세에서 사람이 보는 것: 가운데, 요 돌림, 두 끝(긴 변 양 끝)의 자리·높이
function look(b: BoxWire, kind: BoxKind): Look {
  const [x, y, z, qx, qy, qz, qw] = b, h = variantOf(kind).box.h / 2;
  // 긴 변(로컬 z) 방향 = 쿼터니언으로 돌린 (0,0,1)
  const ax = 2 * (qx * qz + qw * qy), ay = 2 * (qy * qz - qw * qx), az = 1 - 2 * (qx * qx + qy * qy);
  const ends = [1, -1].map((s) => ({ x: x + s * ax * h, y: y + s * ay * h, z: z + s * az * h, sign: s }));
  return { cx: x, cz: z, yaw: Math.atan2(ax, az), ends };
}

// 그 끝에서 가운데 쪽으로 in만큼 들어온 자리
const toward = (l: Look, e: Look['ends'][number], inward: number) => {
  const dx = l.cx - e.x, dz = l.cz - e.z, d = Math.hypot(dx, dz) || 1;
  return { x: e.x + (dx / d) * inward, z: e.z + (dz / d) * inward };
};

export function botPlay(b: BoxWire, rng: Rng, strategy: Strategy, memo: BotMemo = { stall: 0, corners: false }, kind: BoxKind = 'long'): { x: number; z: number } {
  let t: { x: number; z: number };
  const box = variantOf(kind).box, [first, second] = TECHNIQUES[kind];
  const tactic = strategy === 'smart' ? (memo.corners ? second : first) : strategy;
  if (strategy === 'masher') t = { x: (rng() * 2 - 1) * HALF_X, z: (rng() * 2 - 1) * HALF_Z };
  else {
    const l = look(b, kind), [a, c] = l.ends, high = a.y >= c.y ? a : c, low = high === a ? c : a;
    const light = box.com < 0 ? l.ends[0] : l.ends[1]; // 무게중심 반대쪽 끝(로컬 +z가 ends[0]) — 정사각형(com 0)은 로컬 −z 끝
    const front = l.ends[0].z >= l.ends[1].z ? l.ends[0] : l.ends[1], back = front === l.ends[0] ? l.ends[1] : l.ends[0];
    if (high.y - low.y > TILT && tactic !== 'rotate') t = toward(l, high, 0.02); // 기운 상자: 높은 끝을 눌러 세운다
    else if (tactic === 'rotate') {
      // 모서리 누르기: 긴 변 끝에서 폭 방향으로 반 폭만큼 옆 — 상자를 계속 같은 쪽으로 돌린다
      const e = toward(l, light, 0.03), side = box.w / 2;
      t = { x: e.x + Math.cos(l.yaw) * side, z: e.z - Math.sin(l.yaw) * side };
    } else if (tactic === 'flip') t = toward(l, front, 0.02); // 앞 끝을 들썩여 세운다
    else if (tactic === 'drag') t = toward(l, back, 0.02); // 뒤 끝을 걸어 끌어온다
    else t = toward(l, light, 0.02); // 가벼운 끝을 들썩여 걷게
  }
  const x = t.x + (rng() * 2 - 1) * AIM_ERR, z = t.z + (rng() * 2 - 1) * AIM_ERR;
  return { x: Math.min(HALF_X, Math.max(-HALF_X, x)), z: Math.min(HALF_Z, Math.max(-HALF_Z, z)) };
}

// 서버 domain/figure.py start_box와 같은 규칙(처음 자리·돌림 흔들림)
export function startBox(rng: Rng, kind: BoxKind = 'long'): BoxWire {
  const { start_jitter: j, bars } = FIGURE, { box } = variantOf(kind), a = (((rng() * 2 - 1) * j.twist_deg) * Math.PI) / 360;
  return [(rng() * 2 - 1) * j.shift, bars.y + bars.radius + box.d / 2, (rng() * 2 - 1) * j.shift, 0, Math.sin(a), 0, Math.cos(a)];
}

const turnBetween = (a: BoxWire, b: BoxWire) => 2 * Math.acos(Math.min(1, Math.abs(a[3] * b[3] + a[4] * b[4] + a[5] * b[5] + a[6] * b[6])));

// 서버 after_play의 꽉 낀 상자 도움과 같은 규칙(설계 §8 개정): 직원이 다시 반듯이 올려놓는다 — 막대 위에 눕혀(기울기 없이) 거의 곧게(twist_deg),
// 앞뒤는 가운데 가까이(shift 안), 옆 자리는 그대로(조금 옮김). 난수 순서도 서버와 같다(방향, 거리, 돌림, 부호)
export function nudgeBox(w: FigureWorld, rng: Rng): void {
  const { nudge, bars } = FIGURE, { box } = w.variant, b = w.boxPose(), a = rng() * 2 * Math.PI, d = nudge.shift[0] + rng() * (nudge.shift[1] - nudge.shift[0]);
  const tw = ((nudge.twist_deg[0] + rng() * (nudge.twist_deg[1] - nudge.twist_deg[0])) * (rng() < 0.5 ? -1 : 1) * Math.PI) / 360;
  const side = bars.half_len - box.w / 2, x = Math.min(side, Math.max(-side, b[0] + Math.cos(a) * d));
  w.box.setTranslation({ x, y: bars.y + bars.radius + box.d / 2, z: Math.sin(a) * d }, true);
  w.box.setRotation({ x: 0, y: Math.sin(tw), z: 0, w: Math.cos(tw) }, true);
  w.box.setLinvel({ x: 0, y: 0, z: 0 }, true); w.box.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

// 처음 상자부터 빠질 때까지 판 수(못 빼면 max + 1)
export function playsToWin(R: Rapier, strategy: Strategy, seed: number, max = 60, kind: BoxKind = 'long'): number {
  const rng = seededRandom(seed), w = new FigureWorld(R, startBox(rng, kind), kind), { stuck } = FIGURE;
  for (let t = 0; t < 0.5; t += 1 / 60) w.step(1 / 60);
  let still = 0;
  const memo: BotMemo = { stall: 0, corners: false };
  try {
    for (let play = 1; play <= max; play++) {
      const before = w.boxPose(), { x, z } = botPlay(before, rng, strategy, memo, kind);
      const claw = new FigureClaw(R, w, x, z), r = runFigureCycle(w, claw, x, z);
      claw.dispose();
      if (r.won) return play;
      const after = w.boxPose();
      memo.stall = Math.hypot(after[0] - before[0], after[2] - before[2]) < STALL_MOVE && turnBetween(after, before) < STALL_TURN ? memo.stall + 1 : 0;
      if (memo.stall >= STALL_PLAYS) memo.corners = !memo.corners, memo.stall = 0; // 안 통하면 다른 공략으로
      still = Math.hypot(after[0] - before[0], after[2] - before[2]) < stuck.move && turnBetween(after, before) < stuck.turn ? still + 1 : 0;
      if (still >= stuck.plays) { nudgeBox(w, rng); for (let t = 0; t < 0.5; t += 1 / 60) w.step(1 / 60); still = 0; }
    }
    return max + 1;
  } finally { w.dispose(); }
}

export const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
