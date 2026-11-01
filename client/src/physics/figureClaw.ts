import type RAPIER from '@dimforge/rapier3d-deterministic-compat';
import * as THREE from 'three';
import { FIGURE } from '../data/figures';
import type { FigureWorld } from './figureWorld';
import type { Rapier } from './rapier';

// 피규어 두 팔 집게(9단계, 그래픽 설계 §3.5 모양): 각진 머리(운동학) + 양옆 경첩에서 내려오는 납작한 판 팔 두 개
// (바깥 → 아래 → 끝이 안쪽으로 꺾인 갈고리). 팔은 동적 몸체이고 경첩 모터가 목표 각으로 민다 — 힘은 단계마다 토크 한도(grip·lift·carry, N·m)라
// 약해서 상자를 번쩍 못 든다. 상자 모서리가 처음보다 max_lift 넘게 오르거나 상자 전체가 max_clear 넘게 뜨면 팔이 미끄러져 놓는다
const HEAD = { hx: 0.045, hy: 0.03, hz: 0.035 };
const HINGE: [number, number] = [0.04, -0.02]; // 머리 기준 경첩(오른팔, 왼팔은 x 반대)
const ELBOW: [number, number] = [0.045, -0.08], TIP: [number, number] = [0.005, -0.17]; // 경첩 기준(오른팔)
const PLATE_T = 0.004, PLATE_W = 0.018, TIP_R = 0.008; // 판 두께 반, 판 폭 반(z), 고무 끝
const ARM_MASS = 0.02;
const OPEN = 0.35, CLOSE = 0.6; // 경첩 각(rad): 바깥으로 벌림, 안으로 오므림 한도
const STIFF = 3, DAMP = 0.08, OPEN_FORCE = 0.3;
const GROUP_CLAW = 0x0002;
const clawGroups = ((GROUP_CLAW << 16) | (0xffff & ~GROUP_CLAW)) >>> 0; // 집게끼리는 안 부딪힘

export class FigureClaw {
  private readonly head: RAPIER.RigidBody;
  private readonly arms: RAPIER.RigidBody[] = [];
  private readonly joints: RAPIER.RevoluteImpulseJoint[] = [];
  private readonly colliders: RAPIER.Collider[] = [];
  private base: number[] = []; // 쥐기 시작할 때 상자 모서리 높이
  private baseLow = 0;
  private slipped = false;
  x: number;
  y: number;
  z: number;

  constructor(readonly R: Rapier, readonly fw: FigureWorld, x: number, z: number, y = FIGURE.claw.rest_y) {
    const w = fw.world;
    this.x = x; this.y = y; this.z = z;
    this.head = w.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
    this.colliders.push(w.createCollider(R.ColliderDesc.cuboid(HEAD.hx, HEAD.hy, HEAD.hz).setFriction(0.6).setCollisionGroups(clawGroups)
      .setActiveCollisionTypes(R.ActiveCollisionTypes.DEFAULT | R.ActiveCollisionTypes.KINEMATIC_FIXED), this.head));
    for (const side of [1, -1]) {
      const arm = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x + side * HINGE[0], y + HINGE[1], z)
        .setAdditionalMassProperties(ARM_MASS, { x: side * 0.025, y: -0.09, z: 0 }, { x: 5e-5, y: 5e-5, z: 5e-5 }, { x: 0, y: 0, z: 0, w: 1 })
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

  setHead(x: number, y: number, z: number): void {
    this.x = x; this.y = y; this.z = z;
    this.head.setNextKinematicTranslation({ x, y, z });
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
    const now = this.corners(), { max_lift, max_clear } = FIGURE.claw;
    if (now.some((y, i) => y - this.base[i] > max_lift) || Math.min(...now) - this.baseLow > max_clear) {
      this.slipped = true;
      this.drive(true, OPEN_FORCE); // 확실히 벌린다 — 약하게 풀면 상자 밑에 걸린 갈고리째 상자가 따라 올라가 뒤집혔다
    }
  }

  // 집게(머리·팔)가 상자나 막대·벽에 닿았나 — 내려가기를 멈춘다
  touching(): boolean {
    return this.touched() !== null;
  }

  // 닿은 집게 부분(0 머리, 1·2 오른팔 판, 3 오른팔 끝, 4·5 왼팔 판, 6 왼팔 끝)과 상대(0 상자, 1~ 막대·벽) — 진단용
  touched(): [number, number] | null {
    const w = this.fw.world, targets = [this.fw.boxCollider, ...this.fw.solids];
    for (let i = 0; i < this.colliders.length; i++) for (let k = 0; k < targets.length; k++) {
      let hit = false;
      w.contactPair(this.colliders[i], targets[k], (m) => { for (let n = 0; n < m.numContacts(); n++) if (m.contactDist(n) <= 0.001) hit = true; });
      if (hit) return [i, k];
    }
    return null;
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
    const p = this.fw.box.translation(), r = this.fw.box.rotation(), { w, d, h } = FIGURE.box;
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w), v = new THREE.Vector3(), out: number[] = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) out.push(v.set((sx * w) / 2, (sy * d) / 2, (sz * h) / 2).applyQuaternion(q).y + p.y);
    return out;
  }

  dispose(): void {
    const w = this.fw.world;
    for (const j of this.joints) w.removeImpulseJoint(j, true);
    for (const a of this.arms) w.removeRigidBody(a);
    w.removeRigidBody(this.head);
  }
}
