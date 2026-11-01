import { FIGURE } from '../data/figures';
import type { BoxWire, ClawPose } from '../net/protocol';
import type { FigureClaw } from './figureClaw';
import { FIG_STEP, type FigureWorld } from './figureWorld';

// 피규어 집게 한 바퀴(9단계): 내려감 → 오므림 → 올림 → 잠깐 → 놓음 → 집으로 → 상자가 멈출 때까지.
// 걸음마다 집게를 먼저 움직이고 세계를 한 걸음 — 같은 입력이면 같은 결과(결정성). advance는 한 번에 최대 12걸음(밀린 시간은 버림)
export type FigurePhase = 'descend' | 'close' | 'lift' | 'hold' | 'release' | 'home' | 'settle' | 'done';
export type FigureCycleOptions = { onTick?: () => void };
export type FigureCycleResult = { won: boolean; box: BoxWire };

const CLOSE_SECONDS = 0.6, HOLD_SECONDS = 0.4, RELEASE_SECONDS = 0.3, SETTLE_MIN = 0.5, SETTLE_MAX = 4;
const FLOOR = FIGURE.bars.y - 0.12; // 아무것도 안 닿아도 이 아래로는 안 내려간다
const CATCH_UP = 12;
const BACK_OFF = 0.004;

export class FigureCycleRunner {
  phase: FigurePhase = 'descend';
  private at = 0;
  private carry = 0;
  private x: number;
  private y = FIGURE.claw.rest_y;
  private z: number;

  constructor(readonly world: FigureWorld, readonly claw: FigureClaw, x: number, z: number, readonly opts: FigureCycleOptions = {}) {
    this.x = x; this.z = z;
    claw.setHead(x, this.y, z);
    claw.release();
    this.at = world.time;
  }

  advance(dt: number): boolean {
    this.carry += dt;
    let n = 0;
    while (this.carry >= FIG_STEP && n < CATCH_UP && this.phase !== 'done') { this.tick(); this.carry -= FIG_STEP; n++; }
    if (n === CATCH_UP) this.carry = 0;
    return this.phase === 'done';
  }

  private go(phase: FigurePhase): void {
    this.phase = phase;
    this.at = this.world.time;
    const c = this.claw, C = FIGURE.claw;
    if (phase === 'close') c.grab(C.grip);
    else if (phase === 'lift') { c.watchBox(); c.setPower(C.lift); }
    else if (phase === 'hold') c.setPower(C.carry);
    else if (phase === 'release') c.release();
  }

  private tick(): void {
    const w = this.world, c = this.claw, C = FIGURE.claw, t = w.time - this.at;
    switch (this.phase) {
      case 'descend':
        this.y = Math.max(FLOOR, this.y - C.descend * FIG_STEP);
        c.setHead(this.x, this.y, this.z);
        if (c.touching() || this.y <= FLOOR) {
          this.y = Math.min(C.rest_y, this.y + BACK_OFF); // 닿으면 살짝 물러나 상자를 막대로 누르지 않게(조사한 시뮬레이터처럼)
          c.setHead(this.x, this.y, this.z);
          this.go('close');
        }
        break;
      case 'close':
        if (t >= CLOSE_SECONDS) this.go('lift');
        break;
      case 'lift':
        this.y = Math.min(C.rest_y, this.y + C.descend * FIG_STEP);
        c.setHead(this.x, this.y, this.z);
        c.checkSlip();
        if (this.y >= C.rest_y) this.go('hold');
        break;
      case 'hold':
        c.checkSlip();
        if (t >= HOLD_SECONDS) this.go('release');
        break;
      case 'release':
        if (t >= RELEASE_SECONDS) this.go('home');
        break;
      case 'home': {
        const [hx, hz] = C.home, dx = hx - this.x, dz = hz - this.z, d = Math.hypot(dx, dz), s = C.speed * FIG_STEP;
        if (d <= s) { this.x = hx; this.z = hz; this.go('settle'); } else { this.x += (dx / d) * s; this.z += (dz / d) * s; }
        c.setHead(this.x, this.y, this.z);
        break;
      }
      case 'settle':
        if ((t >= SETTLE_MIN && w.still()) || t >= SETTLE_MAX) { this.phase = 'done'; return; }
        break;
    }
    w.tick();
    this.opts.onTick?.();
  }

  clawPose(): ClawPose {
    return [this.x, this.y, this.z, this.claw.armsOpen()];
  }

  done(): FigureCycleResult {
    return { won: this.world.fallen(), box: this.world.boxPose() };
  }
}

// 시뮬·시험용 동기판
export function runFigureCycle(world: FigureWorld, claw: FigureClaw, x: number, z: number, opts: FigureCycleOptions = {}): FigureCycleResult {
  const r = new FigureCycleRunner(world, claw, x, z, opts);
  while (!r.advance(0.1));
  return r.done();
}
