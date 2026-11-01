import type RAPIER from '@dimforge/rapier3d-deterministic-compat';
import * as THREE from 'three';
import { FIGURE, variantOf, type BoxKind } from '../data/figures';
import type { FigureWorld } from './figureWorld';
import type { Rapier } from './rapier';

// 피규어 두 팔 집게(9단계, 그래픽 설계 §3.5 모양): 각진 머리 + 양옆 경첩에서 내려오는 납작한 판 팔 두 개
// (바깥 → 아래 → 끝이 안쪽으로 꺾인 갈고리). 머리는 무게가 있고, 위 레일(운동학)에 '당기기만 하는 줄'(prismatic 아래 한계)로 매달린다 —
// 진짜처럼 내려가다 무엇에 얹히면 줄만 느슨해지고 위에서 누르지 못한다(운동학 머리는 무한한 힘으로 부딪혀 상자를 튕겨 뒤집었다).
// 팔은 동적 몸체이고 경첩 모터가 목표 각으로 민다 — 힘은 단계마다 토크 한도(grip·lift·carry, N·m)라 약해서 상자를 번쩍 못 든다.
// 상자 모서리가 처음보다 max_lift 넘게 오르거나 상자 전체가 max_clear 넘게 뜨면 팔이 미끄러져 놓는다
// 모양은 9단계 집게를 상자 종류의 claw_scale배(긴 상자 1.5, 정사각형 2 — 넓은 상자를 감싸 쥘 수 있게, 사용자 2026-11-02). 질량은 부피(배율³)만큼
const OPEN = 0.35, CLOSE = 0.6; // 경첩 각(rad): 바깥으로 벌림, 안으로 오므림 한도
const STIFF = 3, DAMP = 0.08, OPEN_FORCE = 0.3;
export type ClawShape = {
  k: number; head: { hx: number; hy: number; hz: number }; hinge: [number, number]; elbow: [number, number]; tip: [number, number];
  plateT: number; plateW: number; tipR: number; open: number; close: number; headMass: number; armMass: number;
};
export function clawShape(k: number): ClawShape {
  return {
    k, head: { hx: 0.045 * k, hy: 0.03 * k, hz: 0.035 * k }, hinge: [0.04 * k, -0.02 * k], // 경첩은 머리 기준(오른팔, 왼팔은 x 반대)
    elbow: [0.045 * k, -0.08 * k], tip: [0.005 * k, -0.17 * k], plateT: 0.004 * k, plateW: 0.018 * k, tipR: 0.008 * k, // 팔 마디는 경첩 기준
    open: OPEN, close: CLOSE, headMass: 0.4 * k ** 3, armMass: 0.02 * k ** 3,
  };
}
// 그림이 물리와 같은 모양이 되게 내보낸다(figureZone·figureMachine)
export const clawShapeOf = (kind: BoxKind): ClawShape => clawShape(variantOf(kind).claw_scale);
const GROUP_CLAW = 0x0002;
const clawGroups = ((GROUP_CLAW << 16) | (0xffff & ~GROUP_CLAW)) >>> 0; // 집게끼리는 안 부딪힘

export class FigureClaw {
  private readonly rail: RAPIER.RigidBody;
  private readonly head: RAPIER.RigidBody;
  private readonly cable: RAPIER.PrismaticImpulseJoint;
  private readonly arms: RAPIER.RigidBody[] = [];
  private readonly joints: RAPIER.RevoluteImpulseJoint[] = [];
  private readonly colliders: RAPIER.Collider[] = [];
  private base: number[] = []; // 쥐기 시작할 때 상자 모서리 높이
  private baseLow = 0;
  private slipped = false;
  x: number;
  z: number;

  constructor(readonly R: Rapier, readonly fw: FigureWorld, x: number, z: number) {
    const w = fw.world, y = FIGURE.claw.rest_y, S = clawShapeOf(fw.kind), { head: HEAD, hinge: HINGE, elbow: ELBOW, tip: TIP, plateT: PLATE_T, plateW: PLATE_W, tipR: TIP_R } = S;
    const K = S.k, K5 = K ** 5;
    this.x = x; this.z = z;
    this.rail = w.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
    this.head = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setCanSleep(false)
      .setAdditionalMassProperties(S.headMass, { x: 0, y: 0, z: 0 }, { x: 4e-4 * K5, y: 4e-4 * K5, z: 4e-4 * K5 }, { x: 0, y: 0, z: 0, w: 1 }));
    this.colliders.push(w.createCollider(R.ColliderDesc.cuboid(HEAD.hx, HEAD.hy, HEAD.hz).setDensity(0).setFriction(0.6).setCollisionGroups(clawGroups), this.head));
    this.cable = w.createImpulseJoint(R.JointData.prismatic({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }), this.rail, this.head, true) as RAPIER.PrismaticImpulseJoint;
    this.cable.setContactsEnabled(false);
    this.setCable(0);
    for (const side of [1, -1]) {
      const arm = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x + side * HINGE[0], y + HINGE[1], z)
        .setAdditionalMassProperties(S.armMass, { x: side * 0.025 * K, y: -0.09 * K, z: 0 }, { x: 5e-5 * K5, y: 5e-5 * K5, z: 5e-5 * K5 }, { x: 0, y: 0, z: 0, w: 1 })
        .setAngularDamping(0.5).setCanSleep(false));
      const plate = (a: [number, number], b: [number, number]) => {
        const ax = side * a[0], bx = side * b[0], len = Math.hypot(bx - ax, b[1] - a[1]), t = Math.atan2(b[1] - a[1], bx - ax) / 2;
        return R.ColliderDesc.cuboid(len / 2, PLATE_T, PLATE_W).setTranslation((ax + bx) / 2, (a[1] + b[1]) / 2, 0)
          .setRotation({ x: 0, y: 0, z: Math.sin(t), w: Math.cos(t) }).setDensity(0).setFriction(0.22).setCollisionGroups(clawGroups);
      };
      this.colliders.push(w.createCollider(plate([0, 0], ELBOW), arm), w.createCollider(plate(ELBOW, TIP), arm));
      this.colliders.push(w.createCollider(R.ColliderDesc.ball(TIP_R).setTranslation(side * TIP[0], TIP[1], 0).setDensity(0).setFriction(0.72)
        .setCollisionGroups(clawGroups), arm));
      const joint = w.createImpulseJoint(R.JointData.revolute({ x: side * HINGE[0], y: HINGE[1], z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }), this.head, arm, true) as RAPIER.RevoluteImpulseJoint;
      joint.setContactsEnabled(false);
      joint.configureMotorModel(R.MotorModel.ForceBased);
      joint.setLimits(side > 0 ? -CLOSE : -OPEN, side > 0 ? OPEN : CLOSE);
      this.arms.push(arm); this.joints.push(joint);
    }
    this.release();
  }

  // 레일을 그 자리(x, z)로 — 머리는 줄에 매달려 따라온다
  setRail(x: number, z: number): void {
    this.x = x; this.z = z;
    this.rail.setNextKinematicTranslation({ x, y: FIGURE.claw.rest_y, z });
  }

  // 풀린 줄 길이(m): 머리는 레일에서 이보다 아래로는 못 가고, 위로는(무엇에 얹히면) 자유롭다
  setCable(length: number): void {
    this.cable.setLimits(-length, 0);
  }

  headY(): number {
    return this.head.translation().y;
  }

  // 머리가 아래로 떨어지는 중인가(m/s 기준보다 빠르게)
  falling(): boolean {
    return this.head.linvel().y < -0.02;
  }

  private drive(open: boolean, force: number): void {
    this.joints.forEach((j, i) => {
      const side = i === 0 ? 1 : -1;
      j.configureMotorPosition(open ? side * OPEN : -side * CLOSE, STIFF, DAMP);
      j.setMotorMaxForce(force);
    });
  }

  // 오므림(쥐기 힘 grip) — 쥐기 시작할 때 상자 모서리 높이를 기억해 들림 한계를 잰다
  grab(force: number): void {
    this.slipped = false;
    this.drive(false, force);
  }

  watchBox(): void {
    this.base = this.corners();
    this.baseLow = Math.min(...this.base);
  }

  setPower(force: number): void {
    if (!this.slipped) this.joints.forEach((j) => j.setMotorMaxForce(force));
  }

  release(): void {
    this.drive(true, OPEN_FORCE);
  }

  // 상자 모서리가 max_lift 넘게 오르거나 상자 전체가 max_clear 넘게 뜨면 미끄러져 놓는다 (조사한 실제 기계의 들림 한계)
  checkSlip(): void {
    if (this.slipped || !this.base.length) return;
    const now = this.corners(), { max_lift, max_clear } = this.fw.variant.power;
    if (now.some((y, i) => y - this.base[i] > max_lift) || Math.min(...now) - this.baseLow > max_clear) {
      this.slipped = true;
      this.drive(true, OPEN_FORCE); // 확실히 벌린다 — 약하게 풀면 상자 밑에 걸린 갈고리째 상자가 따라 올라가 뒤집혔다
    }
  }

  // 그림·중계용 팔 벌림 0(오므림)~1(벌림)
  armsOpen(): number {
    const a = this.arms.map((arm, i) => {
      const q = arm.rotation(), ang = 2 * Math.atan2(q.z, q.w), side = i === 0 ? 1 : -1;
      return (side * ang + CLOSE) / (OPEN + CLOSE);
    });
    return Math.min(1, Math.max(0, (a[0] + a[1]) / 2));
  }

  private corners(): number[] {
    const p = this.fw.box.translation(), r = this.fw.box.rotation(), { w, d, h } = this.fw.variant.box;
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w), v = new THREE.Vector3(), out: number[] = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) out.push(v.set((sx * w) / 2, (sy * d) / 2, (sz * h) / 2).applyQuaternion(q).y + p.y);
    return out;
  }

  dispose(): void {
    const w = this.fw.world;
    for (const j of this.joints) w.removeImpulseJoint(j, true);
    w.removeImpulseJoint(this.cable, true);
    for (const a of this.arms) w.removeRigidBody(a);
    w.removeRigidBody(this.head);
    w.removeRigidBody(this.rail);
  }
}
