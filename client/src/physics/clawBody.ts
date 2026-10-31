import type RAPIER from '@dimforge/rapier3d-deterministic-compat';
import * as THREE from 'three';
import { CLAW, clawStrength } from '../data/claw';
import { planGrip, probesAt } from '../game/gripPlan';
import type { Hit } from '../world/dolls';
const ANCHOR_IN = 0.5; // 붙는 점이 접촉점(0)에서 쥔 공 중심(1)으로 들어가는 비율
import { CLAW_REST } from '../world/machine';
import { ALL, GROUP_TARGET, GROUP_TIP, STEP, groups, type MachineWorld, type Rapier } from './machineWorld';

// 집게 몸 (물리 뽑기 설계 §4.3·§9.4·§9.5): 손가락까지 물리로 계산하지 않는다. 허브와 손가락 끝은 정해진 대로 움직이는(kinematic) 몸이라
// 인형을 밀 수 있고, 오므릴 때 손가락 끝 둘 이상이 같은 인형에 닿으면 그 인형을 쥔 것으로 보고 허브↔인형 사이에 끊어지는 스프링 관절을 둔다.
// 관절의 최대 힘 F = base_force × clawStrength(x, z) × 쥠의 질(셋 1.0 / 둘 0.6) × 희귀 배율. 걸린 힘(= 스프링 늘어난 길이 × 세기)이 F를 넘으면 끊어진다
export type GripQuality = 'three' | 'two';
const HUB_R = 0.055, TIP_R = 0.018, TOUCH = 0.012; // 허브 공·손가락 끝 공 반지름, 닿음으로 치는 여유(m)
const LOAD_AVG_SECONDS = 0.1;
export const SPRING_K = 150, SPRING_C = 3; // 스프링 세기(N/m)·감쇠(N·s/m, 상대 속도) — 0.25kg 인형이 약 1.6cm 늘어나 매달린다. 너무 뻣뻣하면 잠깐의 출렁임에도 끊어진다

export class ClawBody {
  readonly body: RAPIER.RigidBody;
  private tips: RAPIER.Collider[] = [];
  private hub: RAPIER.Collider;
  private heldUid: number | null = null;
  private maxForce = 0;
  private relax = 1; // 옮기는 동안 풀리는 비율 (1 = 그대로)
  private loadAvg = 0; // 드는 힘(위쪽 성분)의 0.1초 평균 — 출렁이는 순간값이 아니라 버티는 힘으로 끊김을 판단
  private anchorDoll = new THREE.Vector3();
  private anchorClaw = new THREE.Vector3();
  x = CLAW_REST.x; y = CLAW_REST.y; z = CLAW_REST.z; open = 0.35;
  private vel = new THREE.Vector3(); // 집게 속도 (한 걸음 전과의 차이 / STEP) — 감쇠는 인형과 집게의 상대 속도에만

  constructor(readonly R: Rapier, readonly world: MachineWorld) {
    this.body = world.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(this.x, this.y, this.z));
    this.hub = world.world.createCollider(R.ColliderDesc.ball(HUB_R).setTranslation(0, -0.03, 0).setFriction(0.6).setRestitution(0), this.body);
    for (let i = 0; i < 3; i++) this.tips.push(world.world.createCollider(R.ColliderDesc.ball(TIP_R).setFriction(0.9).setRestitution(0).setCollisionGroups(groups(GROUP_TIP, ALL & ~GROUP_TARGET)), this.body));
    this.setPose(this.x, this.y, this.z, this.open);
  }

  // 다음 걸음의 집게 자리와 벌림 — 손가락 끝 공은 집게 그림(world/claw.ts)과 같은 자리로
  setPose(x: number, y: number, z: number, open: number): void {
    this.vel.set((x - this.x) / STEP, (y - this.y) / STEP, (z - this.z) / STEP);
    this.x = x; this.y = y; this.z = z; this.open = open;
    this.body.setNextKinematicTranslation({ x, y, z });
    const tips = probesAt(0, 0, 0, open).tips;
    tips.forEach((t, i) => this.tips[i].setTranslationWrtParent({ x: t.x, y: t.y, z: t.z }));
  }

  // 허브(몸통 바닥 공)가 어느 인형에 닿았나 — 내려가다 멈추는 기준
  hubTouching(): boolean {
    return this.hubDoll() !== null;
  }

  // 허브가 얹힌 인형 (가장 가까운 것) — 손가락은 그 인형을 감싸며 아래쪽에 걸리므로, 쥘 때 이 인형을 우선한다
  hubDoll(): number | null {
    const hub = new THREE.Vector3(this.x, this.y - 0.03, this.z);
    let best: number | null = null, gap = Infinity;
    for (const uid of this.world.uids()) for (const b of this.world.balls(uid)) {
      const d = hub.distanceTo(b.c) - b.r - HUB_R;
      if (d <= 0.004 && d < gap) { gap = d; best = uid; }
    }
    return best;
  }

  // 손가락 끝 가운데 가장 낮은 높이
  tipsBottom(): number {
    return Math.min(...this.tipPoints().map((t) => t.y));
  }

  tipPoints(): THREE.Vector3[] {
    return probesAt(this.x, this.y, this.z, this.open).tips;
  }

  // 손가락 표본점(손가락마다 12점)을 손가락별로 묶은 것
  private fingers(): THREE.Vector3[][] {
    const pts = probesAt(this.x, this.y, this.z, this.open).fingers;
    return [0, 1, 2].map((k) => pts.slice(k * 12, k * 12 + 12));
  }

  // 인형별로 닿은 손가락 수 — 손가락 어느 마디든 인형 공에 닿으면 그 손가락이 닿은 것 (기하로 잰다: 결정적이고 가볍다)
  touching(): Map<number, number> {
    const out = new Map<number, number>();
    const fingers = this.fingers();
    for (const uid of this.world.uids()) {
      const balls = this.world.balls(uid);
      const n = fingers.filter((f) => f.some((p) => balls.some((b) => p.distanceTo(b.c) <= b.r + TIP_R + TOUCH))).length;
      if (n > 0) out.set(uid, n);
    }
    return out;
  }

  // 지금 집게 자리에서 내려갈 높이·벌림을 미리 잰다 (game/gripPlan): 손이 닿는 범위의 가장 높은 인형을 노린다
  plan(x: number, z: number): { y: number; open: number; descendOpen: number; target: number | null } {
    const uids = this.world.uids();
    // 손가락 끝 공(TIP_R)이 내려가며 노린 인형을 치지 않게, 재는 동안은 인형 공을 그만큼 부풀린다
    const solids: Hit[][] = uids.map((uid) => this.world.balls(uid).map((h) => ({ ...h, r: h.r + TIP_R + 0.004 })));
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
    // 붙는 점 = 닿은 손가락 끝들의 가운데에서 쥔 공(접촉점 가운데가 표면에 가장 가까운 공, 보통 머리)의 중심 쪽으로 ANCHOR_IN만큼 들어간 점.
    // 접촉점에 그대로 매달면 인형이 손가락 끝 아래로 줄처럼 늘어져 감싸는 모양이 안 나고, 공 중심에 매달면 아랫부분을 잡아도 안 기운다
    const balls = this.world.balls(uid);
    const tips = this.fingers().flat();
    const touching = tips.filter((t) => balls.some((b) => t.distanceTo(b.c) <= b.r + TIP_R + TOUCH));
    const at = touching.length ? touching.reduce((a, t) => a.add(t), new THREE.Vector3()).divideScalar(touching.length) : new THREE.Vector3(this.x, this.y - 0.2, this.z);
    const gripped = touching.length ? balls.slice().sort((p, q) => (at.distanceTo(p.c) - p.r) - (at.distanceTo(q.c) - q.r))[0] : undefined; // 접촉점들의 가운데가 표면에 가장 가까운 공 = 손가락이 감싼 공
    if (gripped) at.lerp(gripped.c, ANCHOR_IN);
    const bt = body.translation(), br = body.rotation();
    this.anchorDoll.copy(at).sub(new THREE.Vector3(bt.x, bt.y, bt.z)).applyQuaternion(new THREE.Quaternion(br.x, br.y, br.z, br.w).invert());
    this.anchorClaw.copy(at).sub(new THREE.Vector3(this.x, this.y, this.z));
    this.heldUid = uid;
    this.relax = 1;
    this.loadAvg = 0;
    body.wakeUp();
    for (const t of this.tips) t.setSensor(true); // 쥔 뒤에는 손가락이 인형을 받쳐 들지 않는다 — 관절(쥠의 힘)만이 든다
    this.hub.setSensor(true); // 허브도 — 머리 위에 얹힌 허브가 들어 올리는 인형을 막으면 관절이 늘어나 끊어진다
  }

  // 옮기는 동안 쥠의 힘을 서서히 푼다 (CLAW.carry_relax)
  setRelax(factor: number): void {
    this.relax = factor;
  }

  maxForceNow(): number {
    return this.maxForce * this.relax;
  }

  held(): number | null {
    return this.heldUid;
  }

  // 쥠 = 붙는 점끼리를 잇는 스프링을 매 걸음 직접 건다(힘 = 세기 × 벌어진 거리 − 감쇠 × 인형 속도, 인형의 붙는 점에).
  // 걸린 힘이 최대 힘(옮기는 동안 relax만큼 풀림)을 넘으면 끊어진다 — 들다 떨어뜨림. world.step 전에 부른다
  update(): void {
    if (this.heldUid === null) return;
    const body = this.world.bodyOf(this.heldUid);
    if (!body) { this.release(); return; }
    const { onDoll, onClaw } = this.anchors(body);
    const pull = onClaw.clone().sub(onDoll).multiplyScalar(SPRING_K);
    this.loadAvg += (Math.max(0, pull.y) - this.loadAvg) * (STEP / LOAD_AVG_SECONDS); // 드는 힘(위쪽 성분)만 — 매달려 흔들리는 옆 방향은 미끄러짐이 아니다
    if (this.loadAvg > this.maxForce * this.relax) { this.release(); return; }
    const v = body.linvel();
    const force = pull.sub(new THREE.Vector3(v.x, v.y, v.z).sub(this.vel).multiplyScalar(SPRING_C));
    body.resetForces(true); body.resetTorques(true);
    body.addForceAtPoint({ x: force.x, y: force.y, z: force.z }, { x: onDoll.x, y: onDoll.y, z: onDoll.z }, true);
  }

  private anchors(body: RAPIER.RigidBody): { onDoll: THREE.Vector3; onClaw: THREE.Vector3 } {
    const bt = body.translation(), br = body.rotation();
    const onDoll = this.anchorDoll.clone().applyQuaternion(new THREE.Quaternion(br.x, br.y, br.z, br.w)).add(new THREE.Vector3(bt.x, bt.y, bt.z));
    return { onDoll, onClaw: this.anchorClaw.clone().add(new THREE.Vector3(this.x, this.y, this.z)) };
  }

  loadAvgNow(): number {
    return this.loadAvg;
  }

  debugAnchors(): string {
    if (this.heldUid === null) return '-';
    const { onDoll, onClaw } = this.anchors(this.world.bodyOf(this.heldUid)!);
    return `doll(${onDoll.x.toFixed(3)},${onDoll.y.toFixed(3)},${onDoll.z.toFixed(3)}) claw(${onClaw.x.toFixed(3)},${onClaw.y.toFixed(3)},${onClaw.z.toFixed(3)}) local(${this.anchorDoll.x.toFixed(3)},${this.anchorDoll.y.toFixed(3)},${this.anchorDoll.z.toFixed(3)})`;
  }

  load(): number {
    if (this.heldUid === null) return 0;
    const { onDoll, onClaw } = this.anchors(this.world.bodyOf(this.heldUid)!);
    return onDoll.distanceTo(onClaw) * SPRING_K;
  }

  // 쥠을 끊는다(놓침·놓음). 손가락은 계속 "안 받쳐 드는" 채로 — 끊어진 인형이 손가락 위에 얹혀 딸려 오지 않게. openHands()가 되돌린다
  release(): void {
    if (this.heldUid !== null) { const b = this.world.bodyOf(this.heldUid); b?.resetForces(true); b?.resetTorques(true); }
    this.heldUid = null;
  }

  // 오므리기 시작: 손가락 끝이 인형을 밀어 넘어뜨리지 않게(쇠 손가락은 무한히 세다) 닿기만 재는 상태로. 허브는 쥘 때까지 단단하다
  softHands(): void {
    for (const t of this.tips) t.setSensor(true);
  }

  // 손가락을 벌려 놓은 뒤: 다시 인형을 밀 수 있는 손가락으로
  openHands(): void {
    for (const t of this.tips) t.setSensor(false);
    this.hub.setSensor(false);
  }

  dispose(): void {
    this.release();
    this.openHands();
    this.world.world.removeRigidBody(this.body);
  }
}
