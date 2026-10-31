import * as THREE from 'three';
import { MACHINE_SPEC } from '../data/storeLayout';
import { clawPath } from '../game/clawPath';
import { contactPull, planGrip, probesAt } from '../game/gripPlan';
import type { Swing } from '../game/swing';
import { Tweens, ease } from '../game/tween';
import type { DollSpot, Result } from '../net/protocol';
import type { BigZone } from './bigZone';
import { CABLE_TOP } from './claw';
import { dollHits, makeDoll } from './dolls';
import { dollPose, solidsOf } from './dollPose';
import { CLAW_REST, DOLL_SCALE } from './machine';
import { pushAway, squeezeAboutTop, type Yielding } from './plush';
import { bendEars } from './softEars';

// 결과에 맞춘 집게 연출 (모든 화면이 같은 순서, 설계 2026-10-31 §3.6):
// 옮겨 가며 흔들림·벌리기 → 인형에 닿기 직전까지 내려감 → 닿을 때까지만 오므려 감싸 쥠(머리 꼭대기 기준으로 말랑하게 눌리고,
// 집게와 함께 살짝 떠오르고, 틈이 있으면 손가락 쪽으로 끌려옴) → 잡은 부위를 축으로 매달고 천천히 들어 올림
// → 성공: 상품 구멍으로 옮겨 놓음 / 놓침: 거의 다 올라가 떨어져 굴러 서버가 정한 근처 자리로 / 헛잡음: 손가락이 미끄러져 빈손 → 쉬는 자리로.
// 가까이서 보는 화면(detail)에서는 손가락에 닿는 귀가 휘고 옆 인형이 밀려 비켜 준다(무더기에서 꺼내 따로 그린다).
// 흔들림(진자)은 부르는 쪽이 매 프레임 집게 움직임으로 계산한다
export type ClawShowDeps = {
  tw: Tweens;
  zone: BigZone;
  swing: Swing;
  takePending(): DollSpot[] | undefined; // 이 기계의 새 배치(machine 메시지)를 가져가고 지운다
};

const TOP_Y = CLAW_REST.y + CABLE_TOP; // 집게가 매달린 곳
const SQUISH = 0.04, SCOOP = 0.008; // 쥘 때 가로로 눌리는 비율, 집게와 인형이 함께 떠오르는 높이(m)
const NEIGHBOUR_REACH = 0.32; // 이 거리 안의 옆 인형은 손가락에 밀릴 수 있게 따로 그린다
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type Rest = { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: number };

export async function runClaw(d: ClawShowDeps, m: Result, detail = true): Promise<void> {
  const { tw, zone } = d;
  const rig = zone.activateClaw(m.m), claw = zone.clawOf(m.m), anchor = zone.worldOf(m.m);
  const setY = (y: number) => { claw.position.y = y; rig.setCable(TOP_Y - y); };
  const setOpen = (t: number) => rig.setOpen(t);
  const before = zone.contentsOf(m.m);
  const index = m.i ?? null, target = index !== null ? before[index] ?? null : null;
  const solids = solidsOf(before);
  const plan = planGrip(m.x, m.z, CLAW_REST.y, solids, target ? index : null);

  // 무더기에서 꺼내 따로 그리는 인형들(잡는 인형 + 가까이서 볼 때 옆 인형). latest = 지금 무더기의 진짜 배치
  const lifted = new Set<number>();
  let latest = before;
  const syncPile = () => zone.setContents(m.m, latest.filter((_, i) => !lifted.has(i)));
  const liftOut = (i: number) => {
    const doll = makeDoll(before[i][0]);
    if (!doll) return null;
    const pose = dollPose(before[i]);
    doll.scale.setScalar(DOLL_SCALE); doll.position.copy(pose.position); doll.quaternion.copy(pose.quaternion);
    anchor.add(doll); lifted.add(i);
    return doll;
  };
  let doll = target && index !== null ? liftOut(index) : null;
  const neighbours: Yielding[] = [];
  if (detail) before.forEach((spot, i) => {
    if (i === index || Math.hypot(spot[1] - m.x, spot[2] - m.z) > NEIGHBOUR_REACH) return;
    const n = liftOut(i);
    if (n) neighbours.push({ doll: n, base: n.position.clone(), hits: solids[i], offset: new THREE.Vector3() });
  });
  syncPile();
  // 매 프레임: 손가락에 닿은 귀 휘기, 옆 인형 밀기 (실제 집게 표본점 — 흔들림 포함)
  const v = new THREE.Vector3();
  let last = performance.now();
  const soft = () => {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!detail) return;
    if (doll) bendEars(doll, rig.probes, dt);
    if (neighbours.length) pushAway(neighbours, rig.probes.map((p) => anchor.worldToLocal(p.getWorldPosition(v)).clone()), dt);
  };

  // 1) 노린 자리에서 실제 자리로 흔들리며 옮겨 가고 손가락을 벌린다
  const from = { x: claw.position.x, z: claw.position.z }, landing = { x: m.x, z: m.z };
  const open0 = rig.openness();
  d.swing.kick((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5); // 모터가 덜컥
  await tw.tween(0.7, (k) => {
    const at = clawPath(from, landing, k);
    claw.position.x = at.x; claw.position.z = at.z;
    setOpen(lerp(open0, plan.descendOpen, ease.smooth(k)));
  }, ease.lin);
  // 2) 미리 잰 높이(닿기 직전)까지 내려간다
  await tw.tween(1.2, (k) => { setY(lerp(CLAW_REST.y, plan.y, k)); soft(); }, ease.smooth);

  // 3) 오므려 감싸 쥔다: 닿는 순간부터 머리 꼭대기 기준으로 눌리고, 집게와 함께 살짝 떠오르고, 틈이 있으면 손가락 쪽으로 끌려온다
  const topLocal = target ? Math.max(...dollHits(target[0]).solid.map((h) => h.c.y + h.r)) : 0;
  const rest: Rest | null = doll ? { position: doll.position.clone(), quaternion: doll.quaternion.clone(), scale: doll.scale.x } : null;
  const pull = target && index !== null ? contactPull(probesAt(m.x, plan.y, m.z, plan.open).fingers, solids[index]) : new THREE.Vector3();
  let lift = 0;
  const shape = (amount: number, pullK: number) => {
    if (!doll || !rest) return;
    squeezeAboutTop(doll, rest, topLocal, amount);
    doll.position.addScaledVector(pull, pullK);
    doll.position.y += lift;
  };
  await tw.tween(0.7, (k) => {
    setOpen(lerp(plan.descendOpen, target ? plan.open : 0, k));
    const grip = Math.max(0, (k - 0.5) / 0.5);
    lift = ease.smooth(grip) * SCOOP;
    setY(plan.y + lift);
    shape(SQUISH * grip, ease.smooth(k));
    soft();
  }, ease.out);
  let held: THREE.Object3D | null = null;
  let heldRest: Rest | null = null;
  if (doll && rest && m.o !== 'miss') {
    // 집게에 붙인다(보이는 자리 그대로). 이제 눌림은 집게 좌표에서 머리 꼭대기 기준으로 푼다
    doll.updateMatrixWorld(true);
    const topWorld = doll.localToWorld(new THREE.Vector3(0, topLocal, 0));
    rig.grip.attach(doll);
    const topInGrip = rig.grip.worldToLocal(topWorld);
    // 눌리기 전 크기였을 때의 자리 (squeezeAboutTop이 그 크기 기준으로 머리 꼭대기를 맞춘다)
    heldRest = { position: topInGrip.sub(new THREE.Vector3(0, topLocal * rest.scale, 0).applyQuaternion(doll.quaternion)), quaternion: doll.quaternion.clone(), scale: rest.scale };
    held = doll;
  }
  await tw.tween(0.25, () => soft(), ease.lin);

  // 4) 잡은 부위를 축으로 매단 채 천천히 들어 올린다 (눌림은 들리면서 풀린다)
  const hang = held ? hangDown(held, rig.grip) : null;
  let fell: Promise<void> | null = null;
  const yFrom = plan.y + SCOOP;
  await tw.tween(1.4, (k) => {
    setY(lerp(yFrom, CLAW_REST.y, k));
    const relax = 1 - Math.min(1, k * 2.5);
    if (held && heldRest) squeezeAboutTop(held, heldRest, topLocal, SQUISH * relax);
    else { lift = SCOOP * relax; shape(SQUISH * relax, relax); } // 헛잡음: 끌려왔던 인형이 제자리로 내려앉는다
    if (hang) rig.grip.quaternion.slerpQuaternions(new THREE.Quaternion(), hang, Math.min(1, k * 2.2));
    if (m.o === 'miss' && target) setOpen(k < 0.25 ? lerp(plan.open, plan.open + 0.1, k / 0.25) : lerp(plan.open + 0.1, 0, Math.min(1, (k - 0.25) / 0.3))); // 미끄러져 빈손
    if (m.o === 'slip' && held && !fell && k >= 0.75) {
      setOpen(0.6); // 거의 다 올라가 덜컥할 때 손가락이 풀린다
      const next = d.takePending();
      fell = fallAndRoll(d.tw, held, anchor, dollPose(next?.[index!] ?? before[index!])).then(() => {
        latest = next ?? before; lifted.delete(index!); syncPile(); // 굴러간 자리를 무더기에 다시 넣는다
      });
      held = null; doll = null;
    }
    soft();
  }, ease.smooth);
  if (fell) await fell;
  if (m.o === 'miss' && doll) { anchor.remove(doll); lifted.delete(index!); doll = null; } // 헛잡음: 꺼냈던 인형은 무더기 제자리로

  if (m.o === 'win' && held) {
    // 5) 상품 구멍 위로 옮겨 가서 놓는다 (뽑힌 자리는 결과 연출 뒤 새 배치로 채워진다)
    const [hx, hz] = MACHINE_SPEC.hole;
    const start = { x: claw.position.x, z: claw.position.z };
    await tw.tween(0.8, (k) => { claw.position.x = lerp(start.x, hx, k); claw.position.z = lerp(start.z, hz, k); soft(); }, ease.smooth);
    await tw.tween(0.25, (k) => setOpen(lerp(plan.open, 1, k)), ease.out);
    const prize = held;
    anchor.attach(prize);
    const p0 = prize.position.clone(), s0 = prize.scale.x;
    await tw.tween(0.4, (k) => { prize.position.y = p0.y - k * k * 0.9; prize.scale.setScalar(lerp(s0, s0 * 0.6, k)); soft(); }, ease.lin);
    anchor.remove(prize);
  }
  // 6) 쉬는 자리로 돌아간다 — 그동안 밀렸던 옆 인형이 제자리로 돌아오고, 다 돌아오면 무더기에 다시 넣는다
  const back = { x: claw.position.x, z: claw.position.z }, openFrom = rig.openness();
  await tw.tween(0.6, (k) => {
    claw.position.x = lerp(back.x, CLAW_REST.x, k); claw.position.z = lerp(back.z, CLAW_REST.z, k);
    setOpen(lerp(openFrom, 0.35, k));
    soft();
  }, ease.smooth);
  if (neighbours.some((n) => n.offset.length() > 0.002)) await tw.tween(0.4, () => soft(), ease.lin);
  for (const n of neighbours) anchor.remove(n.doll);
  for (const i of [...lifted]) if (!(m.o === 'win' && i === index)) lifted.delete(i); // 성공한 인형만 무더기에서 빠진 채로
  syncPile();
  rig.grip.quaternion.identity();
  zone.releaseClaw(m.m);
}

// 잡은 곳(손 끝)을 축으로 인형 무게중심이 아래로 오게 매다는 회전 — 머리를 잡으면 똑바로, 팔을 잡으면 옆으로 기울어 매달린다
function hangDown(doll: THREE.Object3D, grip: THREE.Object3D): THREE.Quaternion {
  doll.updateMatrixWorld(true);
  const center = doll.localToWorld(new THREE.Vector3(0, 0.55, 0));
  const inGrip = grip.worldToLocal(center).normalize();
  return new THREE.Quaternion().setFromUnitVectors(inGrip, new THREE.Vector3(0, -1, 0));
}

// 놓친 인형: 손에서 떨어져 바닥까지 떨어지고, 한 번 튀고, 굴러서 서버가 정한 근처 자리(land)에 멈춘다
function fallAndRoll(tw: Tweens, doll: THREE.Object3D, anchor: THREE.Object3D, land: { position: THREE.Vector3; quaternion: THREE.Quaternion }): Promise<void> {
  const x1 = land.position.x, z1 = land.position.z;
  anchor.attach(doll);
  doll.scale.setScalar(DOLL_SCALE);
  const p0 = doll.position.clone(), q0 = doll.quaternion.clone();
  const ground = land.position.y;
  const dir = new THREE.Vector3(x1 - p0.x, 0, z1 - p0.z);
  const dist = dir.length();
  const axis = dist > 1e-4 ? new THREE.Vector3(dir.z, 0, -dir.x).normalize() : new THREE.Vector3(1, 0, 0);
  const roll = new THREE.Quaternion(), end = land.quaternion;
  return tw.tween(0.9, (k) => {
    const h = k < 0.45
      ? lerp(p0.y, ground, (k / 0.45) ** 2) // 떨어짐
      : ground + Math.sin(((k - 0.45) / 0.55) * Math.PI) * 0.05 * (1 - (k - 0.45) / 0.55); // 한 번 통 튀고 잦아듦
    doll.position.set(lerp(p0.x, x1, ease.out(k)), h, lerp(p0.z, z1, ease.out(k)));
    roll.setFromAxisAngle(axis, (dist / 0.12) * ease.out(k) * Math.PI); // 구른 거리만큼 굴러간다
    doll.quaternion.copy(q0).premultiply(roll).slerp(end, Math.max(0, (k - 0.7) / 0.3));
  }, ease.lin).then(() => { anchor.remove(doll); });
}
