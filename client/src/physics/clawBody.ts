import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { CLAW, clawStrength } from '../data/claw';
import { planGrip, probesAt } from '../game/gripPlan';
import type { Hit } from '../world/dolls';
import { CLAW_REST } from '../world/machine';
import type { MachineWorld, Rapier } from './machineWorld';

// 집게 몸 (물리 뽑기 설계 §4.3·§9.4·§9.5): 손가락까지 물리로 계산하지 않는다. 허브와 손가락 끝은 정해진 대로 움직이는(kinematic) 몸이라
// 인형을 밀 수 있고, 오므릴 때 손가락 끝 둘 이상이 같은 인형에 닿으면 그 인형을 쥔 것으로 보고 허브↔인형 사이에 끊어지는 스프링 관절을 둔다.
// 관절의 최대 힘 F = base_force × clawStrength(x, z) × 쥠의 질(셋 1.0 / 둘 0.6) × 희귀 배율. 걸린 힘(= 스프링 늘어난 길이 × 세기)이 F를 넘으면 끊어진다
export type GripQuality = 'three' | 'two';
const HUB_R = 0.055, TIP_R = 0.018, TOUCH = 0.012; // 허브 공·손가락 끝 공 반지름, 닿음으로 치는 여유(m)
export const SPRING_K = 400, SPRING_C = 25; // 스프링 세기(N/m)·감쇠 — 0.25kg 인형이 약 6mm 늘어나 매달린다

export class ClawBody {
  readonly body: RAPIER.RigidBody;
  private tips: RAPIER.Collider[] = [];
  private joint: RAPIER.ImpulseJoint | null = null;
  private heldUid: number | null = null;
  private maxForce = 0;
  private anchorDoll = new THREE.Vector3();
  private anchorClaw = new THREE.Vector3();
  x = CLAW_REST.x; y = CLAW_REST.y; z = CLAW_REST.z; open = 0.35;

  constructor(readonly R: Rapier, readonly world: MachineWorld) {
    this.body = world.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(this.x, this.y, this.z));
    world.world.createCollider(R.ColliderDesc.ball(HUB_R).setTranslation(0, -0.03, 0).setFriction(0.6).setRestitution(0), this.body);
    for (let i = 0; i < 3; i++) this.tips.push(world.world.createCollider(R.ColliderDesc.ball(TIP_R).setFriction(0.9).setRestitution(0), this.body));
    this.setPose(this.x, this.y, this.z, this.open);
  }

  // 다음 걸음의 집게 자리와 벌림 — 손가락 끝 공은 집게 그림(world/claw.ts)과 같은 자리로
  setPose(x: number, y: number, z: number, open: number): void {
    this.x = x; this.y = y; this.z = z; this.open = open;
    this.body.setNextKinematicTranslation({ x, y, z });
    const tips = probesAt(0, 0, 0, open).tips;
    tips.forEach((t, i) => this.tips[i].setTranslationWrtParent({ x: t.x, y: t.y, z: t.z }));
  }

  tipPoints(): THREE.Vector3[] {
    return probesAt(this.x, this.y, this.z, this.open).tips;
  }

  // 인형별로 닿은 손가락 끝 수 (기하로 잰다 — 엔진 접촉 목록보다 결정적이고 가볍다)
  touching(): Map<number, number> {
    const out = new Map<number, number>();
    const tips = this.tipPoints();
    for (const uid of this.world.uids()) {
      const balls = this.world.balls(uid);
      let n = 0;
      for (const t of tips) if (balls.some((b) => t.distanceTo(b.c) <= b.r + TIP_R + TOUCH)) n++;
      if (n > 0) out.set(uid, n);
    }
    return out;
  }

  // 지금 집게 자리에서 내려갈 높이·벌림을 미리 잰다 (game/gripPlan): 손이 닿는 범위의 가장 높은 인형을 노린다
  plan(x: number, z: number): { y: number; open: number; descendOpen: number; target: number | null } {
    const uids = this.world.uids();
    const solids: Hit[][] = uids.map((uid) => this.world.balls(uid));
    let target: number | null = null, best = -Infinity;
    uids.forEach((_, i) => {
      const near = solids[i].filter((h) => Math.hypot(h.c.x - x, h.c.z - z) <= h.r + 0.06);
      if (!near.length) return;
      const top = Math.max(...near.map((h) => h.c.y + h.r));
      if (top > best) { best = top; target = i; }
    });
    const plan = planGrip(x, z, CLAW_REST.y, solids, target);
    return { ...plan, target: target === null ? null : uids[target] };
  }

  grip(uid: number, quality: GripQuality, baseForce = CLAW.base_force): void {
    this.release();
    const body = this.world.bodyOf(uid);
    if (!body) return;
    const spot = this.world.spotOf(uid);
    const rare = spot?.[11] ?? '';
    const tier = rare === 'gold' ? CLAW.rare.gold : rare ? CLAW.rare.rare : 1;
    this.maxForce = baseForce * clawStrength(this.x, this.z) * CLAW.quality[quality] * tier;
    // 붙는 점 = 닿은 손가락 끝들의 가운데 (세계 좌표) → 인형 몸 좌표·집게 몸 좌표로
    const balls = this.world.balls(uid);
    const touching = this.tipPoints().filter((t) => balls.some((b) => t.distanceTo(b.c) <= b.r + TIP_R + TOUCH));
    const at = touching.length ? touching.reduce((a, t) => a.add(t), new THREE.Vector3()).divideScalar(touching.length) : new THREE.Vector3(this.x, this.y - 0.2, this.z);
    const bt = body.translation(), br = body.rotation();
    this.anchorDoll.copy(at).sub(new THREE.Vector3(bt.x, bt.y, bt.z)).applyQuaternion(new THREE.Quaternion(br.x, br.y, br.z, br.w).invert());
    this.anchorClaw.copy(at).sub(new THREE.Vector3(this.x, this.y, this.z));
    const data = this.R.JointData.spring(0, SPRING_K, SPRING_C, { x: this.anchorClaw.x, y: this.anchorClaw.y, z: this.anchorClaw.z }, { x: this.anchorDoll.x, y: this.anchorDoll.y, z: this.anchorDoll.z });
    this.joint = this.world.world.createImpulseJoint(data, this.body, body, true);
    this.heldUid = uid;
    body.wakeUp();
  }

  held(): number | null {
    return this.heldUid;
  }

  // 걸린 힘 = 늘어난 길이 × 세기. 최대 힘을 넘으면 끊어진다 (들다 떨어뜨림)
  update(): void {
    if (!this.joint || this.heldUid === null) return;
    const body = this.world.bodyOf(this.heldUid);
    if (!body) { this.release(); return; }
    const bt = body.translation(), br = body.rotation();
    const onDoll = this.anchorDoll.clone().applyQuaternion(new THREE.Quaternion(br.x, br.y, br.z, br.w)).add(new THREE.Vector3(bt.x, bt.y, bt.z));
    const onClaw = this.anchorClaw.clone().add(new THREE.Vector3(this.x, this.y, this.z));
    if (onDoll.distanceTo(onClaw) * SPRING_K > this.maxForce) this.release();
  }

  load(): number {
    if (!this.joint || this.heldUid === null) return 0;
    const body = this.world.bodyOf(this.heldUid)!;
    const bt = body.translation(), br = body.rotation();
    const onDoll = this.anchorDoll.clone().applyQuaternion(new THREE.Quaternion(br.x, br.y, br.z, br.w)).add(new THREE.Vector3(bt.x, bt.y, bt.z));
    return onDoll.distanceTo(this.anchorClaw.clone().add(new THREE.Vector3(this.x, this.y, this.z))) * SPRING_K;
  }

  release(): void {
    if (this.joint) { this.world.world.removeImpulseJoint(this.joint, true); this.joint = null; }
    this.heldUid = null;
  }

  dispose(): void {
    this.release();
    this.world.world.removeRigidBody(this.body);
  }
}
