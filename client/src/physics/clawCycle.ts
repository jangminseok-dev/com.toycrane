import { CLAW } from '../data/claw';
import { MACHINE_SPEC } from '../data/storeLayout';
import type { DollPose } from '../net/protocol';
import { CLAW_REST, DOLL_FLOOR } from '../world/machine';
import type { ClawBody, GripQuality } from './clawBody';
import { QuietWindow, STEP, type MachineWorld } from './machineWorld';

// 집게 한 바퀴 (물리 뽑기 설계 §4.3·§4.4): 내려감(미리 잰 높이까지) → 오므림(0.6초, 손가락 끝 둘 이상이 닿으면 쥠) → 올림 → 구멍 위로 옮김
// → 놓음(관절을 끊고 벌림) → 멈춤 대기(모두 잠들 때까지, 최대 settle_seconds). 구멍에 빠진 인형이 당첨.
// 고정 간격으로 돌고 같은 입력이면 같은 결과. 시뮬레이션·테스트는 runCycle(동기), 화면은 CycleRunner.advance(dt)를 프레임마다
export type CyclePhase = 'descend' | 'close' | 'lift' | 'carry' | 'release' | 'settle' | 'done';
export type ClawFrame = { x: number; y: number; z: number; open: number };
export type CycleOptions = {
  baseForce?: number; // 시뮬레이션에서 힘을 바꿔 볼 때 (기본 CLAW.base_force)
  carryTo?: { x: number; z: number }; // 옮겨 놓는 자리(기본 구멍 위, 미는 뽑기는 턱 위)
  settle?: { still: number; max: number }; // 놓은 뒤 멈춤 기다리기: still초 동안 모든 인형이 3mm 안에서만 움직였으면 끝, 길어도 max초(미는 뽑기 — 판이 한 주기 밀어도 그대로일 때)
  floor?(x: number, z: number): number; // 그 자리 바닥 높이(미는 뽑기 턱·판 집 위는 높다) — 손가락 끝이 여기서 멈춘다(기본 펠트)
  frame?(claw: ClawFrame, moving: DollPose[], phase: CyclePhase): void;
  phase?(name: CyclePhase): void;
};
export type CycleResult = { won: number[]; poses: DollPose[]; held: number | null; slipped: boolean };

const DESCEND_SPEED = 0.35, LIFT_SPEED = 0.25, CARRY_SPEED = MACHINE_SPEC.claw_speed;
const CATCH_UP_STEPS = 12;
const CLOSE_SECONDS = 0.6, RELEASE_SECONDS = 0.3, AFTER_RELEASE = 0.2, FLOOR_GAP = 0.01, LIFT_MIN_SECONDS = 0.8, CLOSE_AFTER_SLIP = 0.3;
const CARRY_TO = { x: MACHINE_SPEC.hole[0], z: MACHINE_SPEC.hole[1] };

export class CycleRunner {
  phase: CyclePhase = 'descend';
  private plan: { y: number; open: number; descendOpen: number; target: number | null };
  private clock = 0; // 단계 안에서 흐른 시간
  private from = { x: 0, z: 0 };
  private carryLen = 0;
  private held: number | null = null;
  private carry = 0;
  private result: CycleResult | null = null;
  private to: { x: number; z: number };
  private quiet: QuietWindow | null;
  private floorY: number;

  constructor(private world: MachineWorld, private claw: ClawBody, readonly x: number, readonly z: number, private opts: CycleOptions = {}) {
    this.floorY = opts.floor?.(x, z) ?? DOLL_FLOOR;
    this.quiet = opts.settle ? new QuietWindow(opts.settle.still) : null;
    this.plan = claw.plan(x, z, this.floorY);
    world.markTarget(this.plan.target);
    this.from = { x, z };
    this.to = opts.carryTo ?? CARRY_TO;
    this.carryLen = Math.hypot(this.to.x - x, this.to.z - z);
    world.setHoleOpen(true);
    claw.setPose(x, CLAW_REST.y, z, this.plan.descendOpen);
    opts.phase?.('descend');
  }

  // dt만큼 진행 (1/120초씩). 느린 기기에서도 실제 시간을 따라가게 한 번에 최대 12걸음(약 8ms)까지 밀린 만큼 돈다 —
  // 결과는 걸음 수에 안 달려 있다 (최종 리뷰 I4). 그보다 더 밀리면 버린다
  advance(dt: number): boolean {
    this.carry += dt;
    let n = 0;
    while (this.carry >= STEP && n < CATCH_UP_STEPS && this.phase !== 'done') { this.tick(); this.carry -= STEP; n++; }
    if (n === CATCH_UP_STEPS) this.carry = 0;
    return this.phase === 'done';
  }

  private liftFrom = 0; // 들어 올리기 시작 높이

  // 빈손(헛잡음·놓침)이면 올라가며 손가락을 마저 오므린다 — 쥘 때 벌림 그대로 올라가면 어색하다. 손가락 끝은 닿기만 재는 상태라 인형을 건드리지 않는다
  private emptyHandsClose(c: ClawBody): number {
    return c.held() === null ? Math.max(0, c.open - STEP / CLOSE_AFTER_SLIP) : c.open;
  }

  private go(next: CyclePhase): void {
    if (next === 'lift') this.liftFrom = this.claw.y;
    this.phase = next; this.clock = 0;
    this.opts.phase?.(next);
  }

  private tick(): void {
    const c = this.claw, p = this.plan;
    this.clock += STEP;
    switch (this.phase) {
      case 'descend': {
        // 허브가 인형에 얹히거나 손가락 끝이 바닥에 닿을 때까지 내려간다 — 손가락은 내려가며 옆 인형을 민다 (설계 §9.5)
        const y = c.y - DESCEND_SPEED * STEP;
        c.setPose(this.x, y, this.z, p.descendOpen);
        if (c.hubTouching() || c.tipsBottom() <= this.floorY + FLOOR_GAP) { c.softHands(); this.go('close'); }
        break;
      }
      case 'close': {
        // 다 오므릴 때까지 닫는다 — 손가락이 인형을 밀며 감싸고, 둘 이상이 같은 인형에 닿는 순간 쥔다 (닿는 손가락이 없으면 빈손)
        const k = Math.min(1, this.clock / CLOSE_SECONDS);
        c.setPose(this.x, c.y, this.z, p.descendOpen * (1 - k));
        const touching = c.touching();
        let best: [number, number] | null = null;
        for (const [uid, n] of touching) if (n >= 2 && (!best || n > best[1])) best = [uid, n];
        // 허브가 얹힌 인형(탑 꼭대기)은 긴 손가락이 아래 인형에 먼저 닿아도 계속 오므려 그 인형을 걸어 올린다 — 끝까지 닿지 않으면 그제야 아래 인형
        const under = c.hubDoll(), onUnder = under === null ? 0 : (touching.get(under) ?? 0);
        if (under !== null && onUnder >= 2) best = [under, onUnder];
        else if (under !== null && best && k < 1) best = null;
        if (best) { c.grip(best[0], best[1] >= 3 ? 'three' : 'two' as GripQuality, this.opts.baseForce); this.held = best[0]; this.go('lift'); }
        else if (k >= 1) this.go('lift');
        break;
      }
      case 'lift': {
        // 꼭대기까지 한 번에 부드럽게(시작·끝만 느리게, smoothstep) — 갑자기 당기면 스프링이 튀어 끊어지고, 멈칫하면 놓는 것처럼 보인다
        const total = Math.max(LIFT_MIN_SECONDS, (CLAW_REST.y - this.liftFrom) / LIFT_SPEED);
        const k = Math.min(1, this.clock / total), e = k * k * (3 - 2 * k);
        const y = this.liftFrom + (CLAW_REST.y - this.liftFrom) * e;
        c.setPose(this.x, y, this.z, this.emptyHandsClose(c));
        if (k >= 1) this.go('carry');
        break;
      }
      case 'carry': {
        // 구멍까지 일정한 속도로(시작·끝만 부드럽게). 옛 clawPath는 앞 60%에 도착해 기다리므로 쓰지 않는다 — 기다리는 동안 풀려 구멍 위에서만 떨어졌다
        const k = this.carryLen < 1e-4 ? 1 : Math.min(1, (this.clock * CARRY_SPEED) / this.carryLen);
        const e = k * k * (3 - 2 * k);
        c.setRelax(1 - CLAW.carry_relax * k);
        c.setPose(this.from.x + (this.to.x - this.from.x) * e, c.y, this.from.z + (this.to.z - this.from.z) * e, this.emptyHandsClose(c));
        if (k >= 1) { c.release(); this.go('release'); }
        break;
      }
      case 'release': {
        const k = Math.min(1, this.clock / RELEASE_SECONDS);
        c.setPose(c.x, c.y, c.z, c.open + (1 - c.open) * k);
        if (this.clock >= RELEASE_SECONDS + AFTER_RELEASE) { c.openHands(); this.go('settle'); }
        break;
      }
      case 'settle': {
        const st = this.opts.settle;
        if (!st || !this.quiet) { const still = this.world.movingPoses().length === 0; if (this.clock >= CLAW.settle_seconds || (still && this.clock > 0.5)) this.finish(); break; } // 인형 기계: 예전 그대로
        if (this.clock >= st.max || this.quiet.check(this.clock, this.world.poses())) this.finish(); // 미는 뽑기: 판이 한 주기 밀어도 그대로면(최종 리뷰 I2)
        break;
      }
      case 'done': return;
    }
    c.update();
    this.world.step(STEP);
    this.opts.frame?.({ x: c.x, y: c.y, z: c.z, open: c.open }, this.world.movingPoses(), this.phase);
  }

  private finish(): void {
    const won = this.world.fallen();
    for (const uid of won) this.world.remove(uid);
    this.world.markTarget(null);
    this.world.setHoleOpen(false);
    this.result = { won, poses: this.world.poses(), held: this.held, slipped: this.held !== null && !won.includes(this.held) };
    this.go('done');
  }

  done(): CycleResult {
    if (!this.result) throw new Error('cycle not finished');
    return this.result;
  }
}

export function runCycle(world: MachineWorld, claw: ClawBody, x: number, z: number, opts: CycleOptions = {}): CycleResult {
  const runner = new CycleRunner(world, claw, x, z, opts);
  for (let i = 0; i < 60 * 120 && !runner.advance(STEP); i++) { /* 고정 간격으로 끝까지 */ }
  return runner.done();
}
