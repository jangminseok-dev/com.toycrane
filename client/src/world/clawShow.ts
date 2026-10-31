import * as THREE from 'three';
import { MACHINE_SPEC } from '../data/storeLayout';
import { clawPath } from '../game/clawPath';
import { DESCEND_OPEN, planGrip } from '../game/gripPlan';
import type { Swing } from '../game/swing';
import { Tweens, ease } from '../game/tween';
import type { DollSpot, Result } from '../net/protocol';
import type { BigZone } from './bigZone';
import { CABLE_TOP } from './claw';
import { makeDoll } from './dolls';
import { dollPose, solidsOf } from './dollPose';
import { CLAW_REST, DOLL_SCALE } from './machine';
import { bendEars } from './softEars';

// 결과에 맞춘 집게 연출 (모든 화면이 같은 순서, 설계 2026-10-31 §3.6):
// 옮겨 가며 흔들림·벌리기 → 인형에 닿기 직전까지 내려감 → 닿을 때까지만 오므려 머리를 감싸 쥠(말랑하게 눌리고 살짝 떠오름, 닿은 귀는 휨)
// → 잡은 부위를 축으로 매달고 천천히 들어 올림 → 성공: 상품 구멍으로 옮겨 놓음 / 놓침: 거의 다 올라가 떨어져 굴러 서버가 정한 근처 자리로
// / 헛잡음: 손가락이 미끄러져 빈손 → 쉬는 자리로 돌아감. 흔들림(진자)은 부르는 쪽이 매 프레임 집게 움직임으로 계산한다
export type ClawShowDeps = {
  tw: Tweens;
  zone: BigZone;
  swing: Swing;
  takePending(): DollSpot[] | undefined; // 이 기계의 새 배치(machine 메시지)를 가져가고 지운다
};

const TOP_Y = CLAW_REST.y + CABLE_TOP; // 집게가 매달린 곳
const SQUISH = 0.04, SCOOP = 0.008; // 쥘 때 가로로 눌리는 비율, 손가락 끝이 떠받쳐 올리는 높이(m)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export async function runClaw(d: ClawShowDeps, m: Result): Promise<void> {
  const { tw, zone } = d;
  const rig = zone.activateClaw(m.m), claw = zone.clawOf(m.m), anchor = zone.worldOf(m.m);
  const setY = (y: number) => { claw.position.y = y; rig.setCable(TOP_Y - y); };
  const setOpen = (t: number) => rig.setOpen(t);
  const before = zone.contentsOf(m.m);
  const index = m.i ?? null, target = index !== null ? before[index] ?? null : null;

  // 1) 노린 자리에서 실제 자리로 흔들리며 옮겨 가고 손가락을 벌린다
  const from = { x: claw.position.x, z: claw.position.z }, landing = { x: m.x, z: m.z };
  const open0 = rig.openness();
  d.swing.kick((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5); // 모터가 덜컥
  await tw.tween(0.7, (k) => {
    const at = clawPath(from, landing, k);
    claw.position.x = at.x; claw.position.z = at.z;
    setOpen(lerp(open0, DESCEND_OPEN, ease.smooth(k)));
  }, ease.lin);
  // 2) 이웃 인형까지 넣어 닿기 직전 높이·잡는 인형에 닿는 벌림을 미리 재고, 그 높이까지 내려간다
  const plan = planGrip(rig, claw, anchor, solidsOf(before), target ? index : null);
  await tw.tween(1.2, (k) => setY(lerp(CLAW_REST.y, plan.y, k)), ease.smooth);

  // 3) 오므려 감싸 쥔다: 잡는 인형을 무더기에서 꺼내(같은 자리·모습) 닿는 순간부터 말랑하게 눌리고 살짝 떠오르게
  let doll = target && index !== null ? pickUp(zone, m.m, before, index, anchor) : null;
  const rest = doll ? { y: doll.position.y, s: doll.scale.x } : null;
  let last = performance.now();
  const ears = () => {
    const now = performance.now();
    if (doll) bendEars(doll, rig.probes, Math.min(0.05, (now - last) / 1000));
    last = now;
  };
  const squeeze = (amount: number, lift: number | null) => {
    if (!doll || !rest) return;
    doll.scale.set(rest.s * (1 - amount), rest.s * (1 + amount * 0.75), rest.s * (1 - amount));
    if (lift !== null) doll.position.y = rest.y + lift; // 아직 무더기 자리(anchor 좌표)에 있을 때만
  };
  await tw.tween(0.7, (k) => {
    setOpen(lerp(DESCEND_OPEN, target ? plan.open : 0, k));
    const grip = Math.max(0, (k - 0.5) / 0.5);
    squeeze(SQUISH * grip, ease.smooth(grip) * SCOOP);
    ears();
  }, ease.out);
  let held: THREE.Object3D | null = null;
  if (doll && m.o !== 'miss') { rig.grip.attach(doll); held = doll; } // 보이는 자리는 그대로, 이제 집게를 따라간다
  await tw.tween(0.25, () => ears(), ease.lin);

  // 4) 잡은 부위를 축으로 매단 채 천천히 들어 올린다 (눌림은 들리면서 풀린다)
  const hang = held ? hangDown(held, rig.grip) : null;
  let fell: Promise<void> | null = null;
  await tw.tween(1.4, (k) => {
    setY(lerp(plan.y, CLAW_REST.y, k));
    const relax = 1 - Math.min(1, k * 2.5);
    squeeze(SQUISH * relax, held ? null : SCOOP * relax);
    if (hang) rig.grip.quaternion.slerpQuaternions(new THREE.Quaternion(), hang, Math.min(1, k * 2.2));
    if (m.o === 'miss' && target) setOpen(k < 0.25 ? lerp(plan.open, plan.open + 0.1, k / 0.25) : lerp(plan.open + 0.1, 0, Math.min(1, (k - 0.25) / 0.3))); // 미끄러져 빈손
    if (m.o === 'slip' && held && !fell && k >= 0.75) {
      setOpen(0.6); // 거의 다 올라가 덜컥할 때 손가락이 풀린다
      fell = fallAndRoll(d, m.m, held, anchor, before, index!);
      held = null; doll = null;
    }
    ears();
  }, ease.smooth);
  if (fell) await fell;
  if (m.o === 'miss' && doll) { // 헛잡음: 꺼냈던 인형을 무더기 제자리로
    anchor.remove(doll);
    zone.setContents(m.m, before);
    doll = null;
  }

  if (m.o === 'win' && held) {
    // 5) 상품 구멍 위로 옮겨 가서 놓는다
    const [hx, hz] = MACHINE_SPEC.hole;
    const start = { x: claw.position.x, z: claw.position.z };
    await tw.tween(0.8, (k) => { claw.position.x = lerp(start.x, hx, k); claw.position.z = lerp(start.z, hz, k); ears(); }, ease.smooth);
    await tw.tween(0.25, (k) => setOpen(lerp(plan.open, 1, k)), ease.out);
    const prize = held;
    anchor.attach(prize);
    const p0 = prize.position.clone(), s0 = prize.scale.x;
    await tw.tween(0.4, (k) => { prize.position.y = p0.y - k * k * 0.9; prize.scale.setScalar(lerp(s0, s0 * 0.6, k)); }, ease.lin);
    anchor.remove(prize);
  }
  // 6) 쉬는 자리로 돌아간다
  const back = { x: claw.position.x, z: claw.position.z }, openFrom = rig.openness();
  await tw.tween(0.6, (k) => {
    claw.position.x = lerp(back.x, CLAW_REST.x, k); claw.position.z = lerp(back.z, CLAW_REST.z, k);
    setOpen(lerp(openFrom, 0.35, k));
  }, ease.smooth);
  rig.grip.quaternion.identity();
  zone.releaseClaw(m.m);
}

// 무더기의 그 인형을 같은 자리·모습 그대로 꺼낸다 (무더기에서는 뺀다 — 헛잡음이면 연출 끝에 되돌린다)
function pickUp(zone: BigZone, machineId: string, before: DollSpot[], index: number, anchor: THREE.Object3D): THREE.Object3D | null {
  const doll = makeDoll(before[index][0]);
  if (!doll) return null;
  const pose = dollPose(before[index]);
  doll.scale.setScalar(DOLL_SCALE);
  doll.position.copy(pose.position);
  doll.quaternion.copy(pose.quaternion);
  anchor.add(doll);
  anchor.updateMatrixWorld(true);
  zone.setContents(machineId, before.filter((_, i) => i !== index));
  return doll;
}

// 잡은 곳(손 끝)을 축으로 인형 무게중심이 아래로 오게 매다는 회전 — 머리를 잡으면 똑바로, 팔을 잡으면 옆으로 기울어 매달린다
function hangDown(doll: THREE.Object3D, grip: THREE.Object3D): THREE.Quaternion {
  doll.updateMatrixWorld(true);
  const center = doll.localToWorld(new THREE.Vector3(0, 0.55, 0));
  const inGrip = grip.worldToLocal(center).normalize();
  return new THREE.Quaternion().setFromUnitVectors(inGrip, new THREE.Vector3(0, -1, 0));
}

// 놓친 인형: 손에서 떨어져 바닥까지 떨어지고, 한 번 튀고, 굴러서 서버가 정한 근처 자리에 멈춘다
function fallAndRoll(d: ClawShowDeps, machineId: string, doll: THREE.Object3D, anchor: THREE.Object3D, before: DollSpot[], index: number): Promise<void> {
  const next = d.takePending();
  const land = dollPose(next?.[index] ?? before[index]); // 굴러가 멈출 자리·자세 (머리 기준)
  const x1 = land.position.x, z1 = land.position.z;
  anchor.attach(doll);
  const p0 = doll.position.clone(), q0 = doll.quaternion.clone();
  const ground = land.position.y;
  const dir = new THREE.Vector3(x1 - p0.x, 0, z1 - p0.z);
  const dist = dir.length();
  const axis = dist > 1e-4 ? new THREE.Vector3(dir.z, 0, -dir.x).normalize() : new THREE.Vector3(1, 0, 0);
  const roll = new THREE.Quaternion(), end = land.quaternion;
  return d.tw.tween(0.9, (k) => {
    const h = k < 0.45
      ? lerp(p0.y, ground, (k / 0.45) ** 2) // 떨어짐
      : ground + Math.sin(((k - 0.45) / 0.55) * Math.PI) * 0.05 * (1 - (k - 0.45) / 0.55); // 한 번 통 튀고 잦아듦
    doll.position.set(lerp(p0.x, x1, ease.out(k)), h, lerp(p0.z, z1, ease.out(k)));
    roll.setFromAxisAngle(axis, (dist / 0.12) * ease.out(k) * Math.PI); // 구른 거리만큼 굴러간다
    doll.quaternion.copy(q0).premultiply(roll).slerp(end, Math.max(0, (k - 0.7) / 0.3));
  }, ease.lin).then(() => {
    anchor.remove(doll);
    d.zone.setContents(machineId, next ?? before); // 굴러간 자리를 무더기에 다시 넣는다
  });
}
