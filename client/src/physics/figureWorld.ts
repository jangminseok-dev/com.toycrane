import type RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { FIGURE, variantOf } from '../data/figures';
import type { BoxWire } from '../net/protocol';
import type { Rapier } from './rapier';

// 피규어 기계 속 물리 세계(9단계, 설계 §3.2): 기계 좌표(앞 +z, 오른쪽 +x). 고정 간격 1/120초.
// x를 따라 놓인 쇠막대 두 개(맨 쇠, 미끄러움) 위에 상자 하나. 막대 사이 틈(bars.gap, 막대 겉면 사이)은 상자 길이보다 좁고 세운 단면보다 넓다.
// 앞뒤 멈춤판은 상자가 막대 밖으로 미끄러져 엉뚱한 데로 떨어지지 않게(틈으로만 빠짐), 아래 받는 바닥은 빠진 상자를 멈춘다
export const FIG_STEP = 1 / 120;
const MAX_STEPS = 4;
const BAR_FRICTION = 0.22, BOX_FRICTION = 0.5, BOX_RESTITUTION = 0.04;
const STOP_OUT = 0.13; // 막대 중심에서 멈춤판까지(z)
// 멈춤판은 막대 위로 STOP_TOP만 솟고 미끄럽다(마찰 0) — 높고 거칠면 선반처럼 상자 끝을 받쳐 기운 채 갇혔다(판수 시뮬 꼬리)
const STOP_TOP = 0.06, STOP_HALF_H = 0.15;
const CATCH_DROP = 0.5; // 막대 아래 받는 바닥 깊이

export const barZ = (): number => variantOf('long').gap / 2 + FIGURE.bars.radius; // 막대 중심 z(±) — Task 3에서 종류별

export class FigureWorld {
  readonly world: RAPIER.World;
  readonly box: RAPIER.RigidBody;
  readonly boxCollider: RAPIER.Collider;
  readonly solids: RAPIER.Collider[] = []; // 막대·멈춤판·벽 — 집게가 닿으면 내려가기를 멈춘다
  time = 0;
  private carry = 0;

  constructor(readonly R: Rapier, start: BoxWire) {
    const { bars } = FIGURE, { box } = variantOf('long');
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = FIG_STEP;
    const fixed = (desc: RAPIER.ColliderDesc) => { const c = this.world.createCollider(desc); this.solids.push(c); return c; };
    const s = Math.SQRT1_2;
    for (const side of [-1, 1]) {
      // 캡슐 축(기본 y)을 x로 눕힌 쇠막대
      fixed(R.ColliderDesc.capsule(bars.half_len, bars.radius).setTranslation(0, bars.y, side * barZ()).setRotation({ x: 0, y: 0, z: s, w: s }).setFriction(BAR_FRICTION).setRestitution(0));
      fixed(R.ColliderDesc.cuboid(bars.half_len, STOP_HALF_H, 0.005).setTranslation(0, bars.y + STOP_TOP - STOP_HALF_H, side * (barZ() + STOP_OUT)).setFriction(0));
      fixed(R.ColliderDesc.cuboid(0.005, 0.4, 0.4).setTranslation(side * (bars.half_len + 0.005), bars.y, 0).setFriction(BAR_FRICTION));
    }
    fixed(R.ColliderDesc.cuboid(0.6, 0.02, 0.6).setTranslation(0, bars.y - CATCH_DROP, 0).setFriction(0.8));
    // 상자: 무게중심을 긴 변(z) 쪽으로 com × h만큼 치우침 — 실제처럼 무거운 쪽으로 기운다
    const [hx, hy, hz] = [box.w / 2, box.d / 2, box.h / 2], m = box.mass;
    const inertia = { x: (m / 3) * (hy * hy + hz * hz), y: (m / 3) * (hx * hx + hz * hz), z: (m / 3) * (hx * hx + hy * hy) };
    this.box = this.world.createRigidBody(R.RigidBodyDesc.dynamic()
      .setTranslation(start[0], start[1], start[2]).setRotation({ x: start[3], y: start[4], z: start[5], w: start[6] })
      .setAdditionalMassProperties(m, { x: 0, y: 0, z: box.com * box.h }, inertia, { x: 0, y: 0, z: 0, w: 1 })
      .setLinearDamping(0.05).setAngularDamping(0.05).setCcdEnabled(true).setCanSleep(true));
    this.boxCollider = this.world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setDensity(0).setFriction(BOX_FRICTION).setRestitution(BOX_RESTITUTION), this.box);
  }

  // 고정 간격 한 걸음 (집게 한 바퀴는 걸음마다 집게를 먼저 움직이고 이걸 부른다)
  tick(): void {
    this.world.step();
    this.time += FIG_STEP;
  }

  // 집게 없이 흘러가게(판 사이·시험): 한 번에 최대 4걸음, 넘치는 시간은 버린다
  step(dt: number): void {
    this.carry += dt;
    let n = 0;
    while (this.carry >= FIG_STEP && n < MAX_STEPS) { this.tick(); this.carry -= FIG_STEP; n++; }
    if (n === MAX_STEPS) this.carry = 0;
  }

  boxPose(): BoxWire {
    const p = this.box.translation(), q = this.box.rotation();
    return [p.x, p.y, p.z, q.x, q.y, q.z, q.w];
  }

  // 상자가 막대 사이로 빠졌나 — 상자 가운데가 막대보다 상자 길이만큼 아래
  fallen(): boolean {
    return this.box.translation().y < FIGURE.bars.y - variantOf('long').box.h;
  }

  still(): boolean {
    return this.box.isSleeping();
  }

  dispose(): void {
    this.world.free();
  }
}
