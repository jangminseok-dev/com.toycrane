import { beforeAll, describe, expect, test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { FigureClaw } from '../src/physics/figureClaw';
import { runFigureCycle } from '../src/physics/figureCycle';
import { FigureWorld } from '../src/physics/figureWorld';
import { loadRapier, type Rapier } from '../src/physics/rapier';
import { TECHNIQUES, botPlay, nudgeBox, playsToWin, quantile, startBox, type BotMemo, type Strategy } from './figureBot';
import { FIGURE } from '../src/data/figures';
import { seededRandom } from './world';

// 9단계 피규어 판수 맞추기(설계 §2·§5·§8): 큰 상자 두 종류 모두 혼자 처음부터 운 좋으면 4판, 나쁘면 15판 — 합리적인 자동 플레이어(smart)의 10%선·90%선.
// 종류마다 가게 공략 둘(긴 상자: 세로로 빠뜨리기·돌려서 빠뜨리기, 정사각형: 들어 세우기·끌어오기)이 통하고, 마구 누르기는 훨씬 오래 걸린다.
// SIM_TRIALS(기본 200)로 상자 수, SIM_OUT으로 결과 파일
const N = Number(process.env.SIM_TRIALS ?? 200);
// 맞추기용: FIGURE_PATCH='{"long":{"grip":1.1},"square":{"grip":1.3,"max_lift":0.05}}'처럼 종류별 힘(power) 일부를 바꿔 돌려 본다(shared/figure.json은 그대로)
if (process.env.FIGURE_PATCH) for (const [kind, power] of Object.entries(JSON.parse(process.env.FIGURE_PATCH) as Record<string, Record<string, number>>)) Object.assign((FIGURE.variants as Record<string, { power: Record<string, number> }>)[kind].power, power);
let R: Rapier;
const report: string[] = [];
beforeAll(async () => { R = await loadRapier(); });
const note = (line: string) => { line = `${process.env.FIGURE_PATCH ?? ''} ${line}`; report.push(line); if (process.env.SIM_OUT) writeFileSync(process.env.SIM_OUT, report.join('\n') + '\n'); };

describe.each(['long', 'square'] as const)('%s box', (kind) => {
  const plays = (s: Strategy, n: number, max = 40) => Array.from({ length: n }, (_, i) => playsToWin(R, s, 1000 + i, max, kind));
  let smartMedian = 0;

  test('a sensible player wins in about 4 to 15 plays', () => {
    const p = plays('smart', N);
    smartMedian = quantile(p, 0.5);
    note(`${kind} smart p10 ${quantile(p, 0.1)} p50 ${smartMedian} p90 ${quantile(p, 0.9)}`);
    expect(quantile(p, 0.1)).toBeGreaterThanOrEqual(3);
    expect(quantile(p, 0.1)).toBeLessThanOrEqual(5);
    expect(quantile(p, 0.9)).toBeGreaterThanOrEqual(12);
    expect(quantile(p, 0.9)).toBeLessThanOrEqual(20); // 상자·집게를 15% 키운 뒤(사용자 2026-11-02) 정사각형 꼬리가 2판쯤 길어짐 — 18 → 20
  });

  test('both shop techniques work', () => {
    for (const s of TECHNIQUES[kind]) {
      const p = plays(s, N, 30), share = p.filter((v) => v <= 30).length / N;
      note(`${kind} ${s} p50 ${quantile(p, 0.5)} within30 ${share.toFixed(2)}`);
      expect(share, s).toBeGreaterThanOrEqual(0.8); // 큰 상자에선 가게 공략이 30판 안에 80~90% — 0.9 → 0.8(사용자 2026-11-02 상자 키우기)
    }
  });

  test('mashing buttons takes far longer', () => {
    const p = plays('masher', Math.max(20, Math.round(N / 4)), 60);
    note(`${kind} masher p50 ${quantile(p, 0.5)}`);
    expect(quantile(p, 0.5)).toBeGreaterThanOrEqual(2 * (smartMedian || 7));
  });

  // 직원 도움(서버 after_play와 같은 규칙)으로 옮긴 상자는 바로 빠지지 않는다 — 여러 판 해 본 상자 20개
  test('nudged box stays on the bars', () => {
    let fell = 0;
    for (let seed = 0; seed < 20; seed++) {
      const rng = seededRandom(7000 + seed), w = new FigureWorld(R, startBox(rng, kind), kind), memo: BotMemo = { stall: 0, corners: false };
      for (let t = 0; t < 0.5; t += 1 / 60) w.step(1 / 60);
      let won = false;
      for (let k = 0; k < 3 && !won; k++) {
        const { x, z } = botPlay(w.boxPose(), rng, 'smart', memo, kind), claw = new FigureClaw(R, w, x, z);
        won = runFigureCycle(w, claw, x, z).won;
        claw.dispose();
      }
      if (!won) {
        nudgeBox(w, rng);
        for (let t = 0; t < 3; t += 1 / 60) w.step(1 / 60);
        if (w.fallen()) fell++;
      }
      w.dispose();
    }
    expect(fell).toBe(0);
  });
});
