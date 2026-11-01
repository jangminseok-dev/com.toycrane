import type RAPIER from '@dimforge/rapier3d-deterministic-compat';
import * as THREE from 'three';
import { HOOK, type RingSide } from '../data/hooks';
import type { BoxWire } from '../net/protocol';
import type { BoxWorld } from './boxWorld';
import type { FigureClaw } from './figureClaw';
import type { FigurePhase } from './figureCycle';
import { clawShape, type ClawShape } from './figureClaw';
import { FIG_STEP } from './figureWorld';
import type { Rapier } from './rapier';

// 고리 걸기 기계 속 물리 세계(설계 2026-11-02 ring-hook §3): 기계 좌표(앞 +z, 오른쪽 +x), 고정 간격 1/120초.
// 평평한 선반 위에 세운 상자 하나, 윗면 가장자리에 고리 판(밖으로 접히는 날개에 네모 구멍) — 팔 끝이 구멍을 지나 내려가 걸린다.
// 선반 앞 끝 ~ 앞 유리 사이가 출구(GET). 옆·뒤는 벽, 출구 아래 받는 바닥. 상자는 출구로만 떨어진다
const MAX_STEPS = 4, SHELF_FRICTION = 0.5, BOX_FRICTION = 0.45, BOX_RESTITUTION = 0.04, MAX_SPEED = 2;
const CATCH_DROP = 0.8, WALL_H = 0.6, RING_FRICTION = 1.2; // 종이 고리 판은 팔 끝이 잘 안 미끄러진다

// 판 시작 상자: 선반 가운데 뒤쪽에 세움, 조금 흔들어 놓음(서버 hook.py start_box와 같은 규칙)
export function hookStart(rand: () => number): BoxWire {
  const { shelf, box, start } = HOOK, shift = (rand() * 2 - 1) * start.shift, twist = ((rand() * 2 - 1) * start.twist_deg * Math.PI) / 180;
  return [shift, shelf.y + box.h / 2, start.z + (rand() * 2 - 1) * start.shift, 0, Math.sin(twist / 2), 0, Math.cos(twist / 2)];
}

// 고리 판: 상자 윗면 가장자리에 붙은 부분(상자와 한 몸) + 가장자리에서 위로 접히는 날개(종이) — 날개에 네모 구멍. 접혀야 팔 끝을 문
// 날개가 위로 꺾이고 상자가 매달린다(딱딱하게 붙이면 한쪽을 들 때 상자가 반대 모서리로 돌며 고리가 집게에서 멀어져 늘 빠졌다).
// 조각 자리·반크기는 상자 축 기준. 날개 조각은 접는 선 기준
export type Piece = { at: [number, number, number]; half: [number, number, number] };
// 접는 선(상자 기준 자리), 날개가 뻗는 방향, 접는 축과 위로 접히는 각 범위
export function hingeOf(side: RingSide): { at: [number, number, number]; out: [number, number, number]; axis: [number, number, number]; limits: [number, number] } {
  const { box, ring } = HOOK, y = box.h / 2 + ring.t / 2, f = ring.fold_max;
  if (side === 'right') return { at: [box.w / 2, y, 0], out: [1, 0, 0], axis: [0, 0, 1], limits: [0, f] };
  return { at: [-box.w / 2, y, 0], out: [-1, 0, 0], axis: [0, 0, 1], limits: [-f, 0] };
}
// (u: 접는 선에서 바깥으로, v: 접는 선을 따라) 네모를 상자 축 조각으로
function piece(side: RingSide, u: number, v: number, hu: number, hv: number, base: [number, number, number]): Piece {
  const ht = HOOK.ring.t / 2, { out } = hingeOf(side);
  return { at: [base[0] + out[0] * u, base[1], base[2] + v], half: [hu, ht, hv] };
}
export function gluedPiece(side: RingSide): Piece {
  const { ring } = HOOK;
  return piece(side, -ring.glued / 2, 0, ring.glued / 2, ring.d / 2, hingeOf(side).at);
}
// 날개 조각(접는 선 기준): 안쪽 테, 구멍 양옆 띠 둘, 바깥 테
export function flapPieces(side: RingSide): Piece[] {
  const { ring } = HOOK, b = ring.d / 2, hh = ring.hole / 2, o: [number, number, number] = [0, 0, 0];
  return [
    piece(side, ring.inner / 2, 0, ring.inner / 2, b, o),
    piece(side, ring.inner + hh, (b + hh) / 2, hh, (b - hh) / 2, o),
    piece(side, ring.inner + hh, -(b + hh) / 2, hh, (b - hh) / 2, o),
    piece(side, ring.inner + ring.hole + ring.outer / 2, 0, ring.outer / 2, b, o),
  ];
}
// 구멍 가운데(접는 선에서 바깥으로) — 시험·그림
export const holeFromHinge = (): number => HOOK.ring.inner + HOOK.ring.hole / 2;

// 고리 걸기 집게: 피규어 집게와 같은 크기·관절, 팔은 가는 막대(사진 180·186의 투명 팔) — 넓은 판이면 구멍에 안 들어간다.
// 팔은 끝까지 오므리지 않고 close(음수 = 아직 벌린 각)에서 멈춘다 — 걸린 팔 끝이 고리 판 밑에 머물게(진짜 집게의 오므림 한도)
export const hookClawShape = (): ClawShape => ({ ...clawShape(HOOK.claw.scale), plateW: HOOK.claw.arm_w, close: HOOK.claw.close });

export class HookWorld implements BoxWorld {
  readonly world: RAPIER.World;
  readonly box: RAPIER.RigidBody;
  readonly dims = HOOK.box;
  readonly power = HOOK.power;
  readonly clawShape: ClawShape = hookClawShape();
  readonly floorY = HOOK.shelf.y - 0.12;
  readonly slipRule = 'none' as const;
  readonly carryHome = true;
  readonly flap: RAPIER.RigidBody; // 접히는 고리 날개
  private fold: RAPIER.RevoluteImpulseJoint;
  private hook: { joint: RAPIER.ImpulseJoint; hold: number; moved: number; at: [number, number] } | null = null;
  private tried = false;
  time = 0;
  private carry = 0;

  constructor(readonly R: Rapier, start: BoxWire, readonly side: RingSide) {
    const { shelf, exit, box } = HOOK;
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = FIG_STEP;
    const fixed = (desc: RAPIER.ColliderDesc) => this.world.createCollider(desc);
    const depth = shelf.front_z - shelf.back_z, wallX = shelf.half_x + 0.005;
    fixed(R.ColliderDesc.cuboid(shelf.half_x, 0.02, depth / 2).setTranslation(0, shelf.y - 0.02, (shelf.front_z + shelf.back_z) / 2).setFriction(SHELF_FRICTION));
    for (const s of [-1, 1]) fixed(R.ColliderDesc.cuboid(0.005, WALL_H, 0.6).setTranslation(s * wallX, shelf.y, 0).setFriction(SHELF_FRICTION));
    fixed(R.ColliderDesc.cuboid(shelf.half_x, WALL_H, 0.005).setTranslation(0, shelf.y, shelf.back_z - 0.005).setFriction(0));
    fixed(R.ColliderDesc.cuboid(shelf.half_x, WALL_H, 0.005).setTranslation(0, shelf.y - 0.2, exit.front_z + 0.005).setFriction(0));
    fixed(R.ColliderDesc.cuboid(0.6, 0.02, 0.6).setTranslation(0, shelf.y - CATCH_DROP, 0).setFriction(0.8));
    const [hx, hy, hz] = [box.w / 2, box.h / 2, box.d / 2], m = box.mass;
    const inertia = { x: (m / 3) * (hy * hy + hz * hz), y: (m / 3) * (hx * hx + hz * hz), z: (m / 3) * (hx * hx + hy * hy) };
    this.box = this.world.createRigidBody(R.RigidBodyDesc.dynamic()
      .setTranslation(start[0], start[1], start[2]).setRotation({ x: start[3], y: start[4], z: start[5], w: start[6] })
      .setAdditionalMassProperties(m, { x: 0, y: 0, z: 0 }, inertia, { x: 0, y: 0, z: 0, w: 1 })
      .setLinearDamping(0.05).setAngularDamping(0.08).setCcdEnabled(true).setCanSleep(true));
    this.world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setDensity(0).setFriction(BOX_FRICTION).setRestitution(BOX_RESTITUTION), this.box);
    const glued = gluedPiece(side);
    this.world.createCollider(R.ColliderDesc.cuboid(...glued.half).setTranslation(...glued.at).setDensity(0).setFriction(RING_FRICTION).setRestitution(0), this.box);
    // 날개: 상자와 같은 돌림으로 접는 선 자리에 놓고, 접는 선을 축으로 위로만 접히게 잇는다(이은 몸끼리는 부딪히지 않음)
    const h = hingeOf(side), q = new THREE.Quaternion(start[3], start[4], start[5], start[6]), at = new THREE.Vector3(...h.at).applyQuaternion(q).add(new THREE.Vector3(start[0], start[1], start[2]));
    this.flap = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(at.x, at.y, at.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setAdditionalMassProperties(HOOK.ring.flap_mass, { x: 0, y: 0, z: 0 }, { x: 1e-5, y: 1e-5, z: 1e-5 }, { x: 0, y: 0, z: 0, w: 1 }).setCcdEnabled(true).setCanSleep(true));
    for (const p of flapPieces(side)) this.world.createCollider(R.ColliderDesc.cuboid(...p.half).setTranslation(...p.at).setDensity(0).setFriction(RING_FRICTION).setRestitution(0), this.flap);
    this.fold = this.world.createImpulseJoint(R.JointData.revolute({ x: h.at[0], y: h.at[1], z: h.at[2] }, { x: 0, y: 0, z: 0 }, { x: h.axis[0], y: h.axis[1], z: h.axis[2] }), this.box, this.flap, true) as RAPIER.RevoluteImpulseJoint;
    this.fold.setContactsEnabled(false);
    this.fold.setLimits(...h.limits);
  }

  tick(): void {
    this.world.step();
    this.time += FIG_STEP;
    // 고리에 걸려 출렁여도 날아가지 않게(풀이가 한순간 크게 미는 일) 속도 상한
    const v = this.box.linvel(), s = Math.hypot(v.x, v.y, v.z);
    if (s > MAX_SPEED) this.box.setLinvel({ x: (v.x / s) * MAX_SPEED, y: (v.y / s) * MAX_SPEED, z: (v.z / s) * MAX_SPEED }, true);
  }

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

  extraPose(): BoxWire {
    const p = this.flap.translation(), q = this.flap.rotation();
    return [p.x, p.y, p.z, q.x, q.y, q.z, q.w];
  }

  // 출구로 빠졌나: 옆·뒤는 벽이라 선반 아래로 상자 키만큼 내려갔으면 출구로 떨어진 것
  fallen(): boolean {
    return this.box.translation().y < HOOK.shelf.y - this.dims.h * 0.6;
  }

  still(): boolean {
    return this.box.isSleeping();
  }

  // 걸림 판정(설계 ring-hook §3, 계획 12 Task 5 판정): 올리는 동안 구멍을 지나 내려갔던 팔 끝이 구멍 높이(날개 판)까지 올라오는 순간
  // 구멍 안이면 팔 끝과 날개를 잇는다. 구멍 가운데에 가까울수록 오래 버텨, 집으로 옮긴 거리가 hold를 넘으면 빠진다. 놓을 때는 늘 푼다
  cycle(phase: FigurePhase, claw: FigureClaw, x: number, z: number): void {
    if (phase === 'lift' && !this.hook && !this.tried) this.tryHook(claw);
    if (!this.hook) return;
    if (phase === 'home') {
      this.hook.moved += Math.hypot(x - this.hook.at[0], z - this.hook.at[1]);
      this.hook.at = [x, z];
      if (this.hook.moved > this.hook.hold) this.unhook();
    } else if (phase === 'release' || phase === 'settle') this.unhook();
  }

  hooked(): boolean { return this.hook !== null; }

  private tryHook(claw: FigureClaw): void {
    const { ring, hold } = HOOK, fp = this.flap.translation(), fq = this.flap.rotation(), inv = new THREE.Quaternion(fq.x, fq.y, fq.z, fq.w).invert();
    for (const i of [0, 1]) {
      const arm = claw.armBody(i), ap = arm.translation(), aq = arm.rotation(), tl = claw.tipLocal(i);
      const tip = new THREE.Vector3(tl.x, tl.y, tl.z).applyQuaternion(new THREE.Quaternion(aq.x, aq.y, aq.z, aq.w)).add(new THREE.Vector3(ap.x, ap.y, ap.z));
      const l = tip.clone().sub(new THREE.Vector3(fp.x, fp.y, fp.z)).applyQuaternion(inv);
      const [u, v] = this.side === 'right' ? [l.x, l.z] : [-l.x, l.z];
      const hh = ring.hole / 2, cu = ring.inner + hh;
      if (Math.abs(u - cu) > hh || Math.abs(v) > hh) continue; // 구멍 둘레 밖의 팔은 보지 않는다
      if (l.y > 0.02) { this.tried = true; continue; } // 판 위로 빠져나가 버렸다
      if (l.y < -0.035) continue; // 아직 아래(판 밑에 닿으면 날개가 함께 들려 판 바로 밑에 머문다)
      const centered = 1 - Math.max(Math.abs(u - cu), Math.abs(v)) / hh;
      const joint = this.world.createImpulseJoint(this.R.JointData.spherical(tl, { x: l.x, y: l.y, z: l.z }), arm, this.flap, true);
      joint.setContactsEnabled(false);
      this.hook = { joint, hold: hold.base + hold.span * centered, moved: 0, at: [claw.x, claw.z] };
      return;
    }
  }

  private unhook(): void {
    if (this.hook) this.world.removeImpulseJoint(this.hook.joint, true);
    this.hook = null;
  }

  // 날개가 접힌 각(0 평평 ~ fold_max) — 그림
  flapAngle(): number {
    const a = this.box.rotation(), b = this.flap.rotation(), rel = new THREE.Quaternion(a.x, a.y, a.z, a.w).invert().multiply(new THREE.Quaternion(b.x, b.y, b.z, b.w));
    return 2 * Math.acos(Math.min(1, Math.abs(rel.w)));
  }

  dispose(): void {
    this.world.free();
  }
}
