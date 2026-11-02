import type RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { FIGURE, guardsOf, variantOf, type BoxKind, type Variant } from '../data/figures';
import type { BoxWire } from '../net/protocol';
import type { BoxPower, BoxWorld } from './boxWorld';
import { clawHalfZ, clawShape, type ClawShape } from './figureClaw';
import type { Rapier } from './rapier';

// 피규어 기계 속 물리 세계(9단계, 설계 §3.2·§8): 기계 좌표(앞 +z, 오른쪽 +x). 고정 간격 1/120초.
// x를 따라 놓인 쇠막대 두 개(맨 쇠, 미끄러움) 위에 큰 상자 하나(종류 long·square마다 치수·막대 틈). 틈은 눕힌 상자보다 좁고 세운 단면보다 넓다.
// 앞뒤 모두 받침 막대와 투명 벽(사용자 2026-11-02: 앞도 뒤처럼) — 틈이 모두 상자 두께보다 좁아 두 막대 사이로만 빠진다. 아래 받는 바닥은 빠진 상자를 멈춘다
export const FIG_STEP = 1 / 120;
const MAX_STEPS = 4;
const BAR_FRICTION = 0.22, BOX_FRICTION = 0.5, BOX_RESTITUTION = 0.04;
// 앞뒤 판은 미끄럽다(마찰 0) — 높고 거친 판은 선반처럼 상자 끝을 받쳐 기운 채 갇혔다(9단계 판수 시뮬 꼬리). 윗변은 막대 위 16cm(상자 두께보다
// 조금 높게 — 30cm 틀 유리는 울타리처럼 보여 뺐다, 사용자 2026-11-02), 아래는 막대 밑까지 이어져 틈이 없다(world/figureMachine과 같은 높이)
const WALL_TOP = 0.16, PLATE_HALF_H = 0.15;
const CROSS_MARGIN = 0.03; // 빠짐 판정: 막대 아래로 내려간 곳이 막대 중심에서 이만큼 바깥까지는 두 막대 사이로 친다(기울어 빠질 때의 여유)
const CATCH_DROP = 0.8; // 막대 아래 받는 바닥 깊이 — 세운 채 떨어진 긴 상자(34cm)도 가운데가 빠짐 기준(막대 − 길이) 아래에 오게

export const barZ = (kind: BoxKind): number => variantOf(kind).gap / 2 + FIGURE.bars.radius; // 막대 중심 z(±)

export class FigureWorld implements BoxWorld {
  readonly world: RAPIER.World;
  readonly box: RAPIER.RigidBody;
  readonly boxCollider: RAPIER.Collider;
  readonly solids: RAPIER.Collider[] = []; // 막대·판·벽 — 집게가 닿으면 내려가기를 멈춘다
  readonly variant: Variant;
  readonly dims: { w: number; d: number; h: number };
  readonly power: BoxPower;
  readonly clawShape: ClawShape;
  readonly floorY = FIGURE.bars.y - 0.12;
  readonly slipRule = 'corners' as const;
  readonly carryHome = false;
  readonly clawHomeZ: number; // 집게가 쉬는 앞뒤 자리 — 앞 유리 안쪽(clawHalfZ)
  time = 0;
  private carry = 0;
  private crossZ: number | null = null; // 상자 가운데가 처음 막대 아래(두께만큼)로 내려간 걸음의 앞뒤 자리

  constructor(readonly R: Rapier, start: BoxWire, readonly kind: BoxKind) {
    const { bars } = FIGURE, guards = guardsOf(kind), bz = barZ(kind);
    this.variant = variantOf(kind);
    this.dims = this.variant.box; this.power = this.variant.power; this.clawShape = clawShape(this.variant.claw_scale); this.clawHomeZ = clawHalfZ(kind);
    const { box } = this.variant;
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = FIG_STEP;
    const fixed = (desc: RAPIER.ColliderDesc) => { const c = this.world.createCollider(desc); this.solids.push(c); return c; };
    const s = Math.SQRT1_2;
    // 캡슐 축(기본 y)을 x로 눕힌 쇠막대: 앞·뒤 막대(그 사이가 GET 구멍)와 앞·뒤 받침 막대
    for (const z of [bz, -bz, bz + guards.front_bar, -(bz + guards.back_bar)]) {
      fixed(R.ColliderDesc.capsule(bars.half_len, bars.radius).setTranslation(0, bars.y, z).setRotation({ x: 0, y: 0, z: s, w: s }).setFriction(BAR_FRICTION).setRestitution(0));
    }
    for (const z of [bz + guards.front_wall, -(bz + guards.back_wall)]) fixed(R.ColliderDesc.cuboid(bars.half_len, PLATE_HALF_H * 2, 0.005).setTranslation(0, bars.y + WALL_TOP - PLATE_HALF_H * 2, z).setFriction(0));
    for (const side of [-1, 1]) fixed(R.ColliderDesc.cuboid(0.005, 0.4, 0.4).setTranslation(side * (bars.half_len + 0.005), bars.y, 0).setFriction(BAR_FRICTION));
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
    if (this.crossZ === null) {
      const p = this.box.translation();
      if (p.y < FIGURE.bars.y - this.variant.box.d) this.crossZ = p.z;
    }
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

  // 상자가 막대 사이로 빠졌나 — 상자 가운데가 막대보다 상자 길이만큼 아래이고, 막대 아래로 내려간 곳이 두 막대 사이(기울어 빠질 때의
  // 여유 CROSS_MARGIN). 앞뒤 틈은 상자 두께보다 좁지만, 유리 벽을 넘어 밖으로 떨어진 상자는 당첨이 아니다(설계 §8.2, 최종 리뷰 I1)
  fallen(): boolean {
    const inside = this.crossZ !== null && Math.abs(this.crossZ) < barZ(this.kind) + CROSS_MARGIN;
    return inside && this.box.translation().y < FIGURE.bars.y - this.variant.box.h;
  }

  still(): boolean {
    return this.box.isSleeping();
  }

  dispose(): void {
    this.world.free();
  }
}
