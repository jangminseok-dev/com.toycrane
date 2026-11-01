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
const BACK_OFF = 0.003, LAND_LAG = 0.003, LAND_TICKS = 6; // 머리가 줄보다 3mm 넘게 덜 내려간 채 50ms면 얹힌 것 — 3mm 되감는다

export class FigureCycleRunner {
  phase: FigurePhase = 'descend';
  private at = 0;
  private carry = 0;
  private x: number;
  private z: number;
  private cable = 0; // 풀린 줄 길이
  private lag = 0; // 머리가 줄보다 덜 내려간 걸음 수

  constructor(readonly world: FigureWorld, readonly claw: FigureClaw, x: number, z: number, readonly opts: FigureCycleOptions = {}) {
    this.x = x; this.z = z;
    claw.setRail(x, z);
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
    const w = this.world, c = this.claw, C = FIGURE.claw, t = w.time - this.at, maxCable = C.rest_y - FLOOR;
    switch (this.phase) {
      case 'descend':
        this.cable = Math.min(maxCable, this.cable + C.descend * FIG_STEP);
        c.setCable(this.cable);
        break;
      case 'close':
        if (t >= CLOSE_SECONDS) this.go('lift');
        break;
      case 'lift':
        this.cable = Math.max(0, this.cable - C.descend * FIG_STEP);
        c.setCable(this.cable);
        c.checkSlip();
        if (this.cable <= 0) this.go('hold');
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
        c.setRail(this.x, this.z);
        break;
      }
      case 'settle':
        if ((t >= SETTLE_MIN && w.still()) || t >= SETTLE_MAX) { this.phase = 'done'; return; }
        break;
    }
    w.tick();
    this.opts.onTick?.();
    if (this.phase === 'descend') {
      // 얹힘: 머리가 줄보다 덜 내려갔고 떨어지지도 않는 채 머문다(줄을 풀기 시작할 때 잠깐 뒤처지는 건 아님) — 3mm 되감고 오므린다
      const lagging = c.headY() - (C.rest_y - this.cable) > LAND_LAG && !c.falling();
      this.lag = lagging ? this.lag + 1 : 0;
      if (this.lag >= LAND_TICKS || this.cable >= maxCable) {
        this.cable = Math.max(0, C.rest_y - c.headY() - BACK_OFF);
        c.setCable(this.cable);
        this.go('close');
      }
    }
  }

  clawPose(): ClawPose {
    return [this.x, this.claw.headY(), this.z, this.claw.armsOpen()];
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
