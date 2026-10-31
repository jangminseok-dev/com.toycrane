import { CLAW } from '../data/claw';
import { MACHINE_SPEC } from '../data/storeLayout';
import { clawPath } from '../game/clawPath';
import type { DollPose } from '../net/protocol';
import { CLAW_REST } from '../world/machine';
import type { ClawBody, GripQuality } from './clawBody';
import { STEP, type MachineWorld } from './machineWorld';

// 집게 한 바퀴 (물리 뽑기 설계 §4.3·§4.4): 내려감(미리 잰 높이까지) → 오므림(0.6초, 손가락 끝 둘 이상이 닿으면 쥠) → 올림 → 구멍 위로 옮김
// → 놓음(관절을 끊고 벌림) → 멈춤 대기(모두 잠들 때까지, 최대 settle_seconds). 구멍에 빠진 인형이 당첨.
// 고정 간격으로 돌고 같은 입력이면 같은 결과. 시뮬레이션·테스트는 runCycle(동기), 화면은 CycleRunner.advance(dt)를 프레임마다
export type CyclePhase = 'descend' | 'close' | 'lift' | 'carry' | 'release' | 'settle' | 'done';
export type ClawFrame = { x: number; y: number; z: number; open: number };
export type CycleOptions = {
  baseForce?: number; // 시뮬레이션에서 힘을 바꿔 볼 때 (기본 CLAW.base_force)
  frame?(claw: ClawFrame, moving: DollPose[], phase: CyclePhase): void;
  phase?(name: CyclePhase): void;
};
export type CycleResult = { won: number[]; poses: DollPose[]; held: number | null; slipped: boolean };

const DESCEND_SPEED = 0.35, LIFT_SPEED = 0.25, CARRY_SPEED = MACHINE_SPEC.claw_speed;
const CLOSE_SECONDS = 0.6, RELEASE_SECONDS = 0.3, AFTER_RELEASE = 0.2;
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

  constructor(private world: MachineWorld, private claw: ClawBody, readonly x: number, readonly z: number, private opts: CycleOptions = {}) {
    this.plan = claw.plan(x, z);
    this.from = { x, z };
    this.carryLen = Math.hypot(CARRY_TO.x - x, CARRY_TO.z - z);
    world.setHoleOpen(true);
    claw.setPose(x, CLAW_REST.y, z, this.plan.descendOpen);
    opts.phase?.('descend');
  }

  // dt만큼 진행 (1/120초씩, 한 번에 최대 4번). 끝났으면 true
  advance(dt: number): boolean {
    this.carry += dt;
    let n = 0;
    while (this.carry >= STEP && n < 4 && this.phase !== 'done') { this.tick(); this.carry -= STEP; n++; }
    if (n === 4) this.carry = 0;
    return this.phase === 'done';
  }

  private go(next: CyclePhase): void {
    this.phase = next; this.clock = 0;
    this.opts.phase?.(next);
  }

  private tick(): void {
    const c = this.claw, p = this.plan;
    this.clock += STEP;
    switch (this.phase) {
      case 'descend': {
        const y = Math.max(p.y, c.y - DESCEND_SPEED * STEP);
        c.setPose(this.x, y, this.z, p.descendOpen);
        if (y <= p.y + 1e-6) this.go('close');
        break;
      }
      case 'close': {
        const k = Math.min(1, this.clock / CLOSE_SECONDS);
        const open = p.descendOpen + (p.open - p.descendOpen) * k;
        c.setPose(this.x, c.y, this.z, open);
        if (k >= 1) {
          const touching = c.touching();
          let best: [number, number] | null = null;
          for (const [uid, n] of touching) if (n >= 2 && (!best || n > best[1])) best = [uid, n];
          if (best) { c.grip(best[0], best[1] >= 3 ? 'three' : 'two' as GripQuality, this.opts.baseForce); this.held = best[0]; }
          this.go('lift');
        }
        break;
      }
      case 'lift': {
        const y = Math.min(CLAW_REST.y, c.y + LIFT_SPEED * STEP);
        c.setPose(this.x, y, this.z, c.open);
        if (y >= CLAW_REST.y - 1e-6) this.go('carry');
        break;
      }
      case 'carry': {
        const k = this.carryLen < 1e-4 ? 1 : Math.min(1, (this.clock * CARRY_SPEED) / this.carryLen);
        const at = clawPath(this.from, CARRY_TO, k);
        c.setPose(at.x, c.y, at.z, c.open);
        if (k >= 1) { c.release(); this.go('release'); }
        break;
      }
      case 'release': {
        const k = Math.min(1, this.clock / RELEASE_SECONDS);
        c.setPose(c.x, c.y, c.z, p.open + (1 - p.open) * k);
        if (this.clock >= RELEASE_SECONDS + AFTER_RELEASE) this.go('settle');
        break;
      }
      case 'settle': {
        if (this.clock >= CLAW.settle_seconds || (this.world.movingPoses().length === 0 && this.clock > 0.5)) this.finish();
        break;
      }
      case 'done': return;
    }
    this.world.step(STEP);
    c.update();
    this.opts.frame?.({ x: c.x, y: c.y, z: c.z, open: c.open }, this.world.movingPoses(), this.phase);
  }

  private finish(): void {
    const won = this.world.fallen();
    for (const uid of won) this.world.remove(uid);
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
