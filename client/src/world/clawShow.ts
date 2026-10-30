import * as THREE from 'three';
import { MACHINE_SPEC } from '../data/storeLayout';
import { aimHeight } from '../game/aim';
import { clawPath } from '../game/clawPath';
import type { Swing } from '../game/swing';
import { Tweens, ease } from '../game/tween';
import type { DollSpot, Result } from '../net/protocol';
import type { BigZone } from './bigZone';
import { CABLE_TOP, CLAW_REACH } from './claw';
import { makeDoll } from './dolls';
import { CLAW_REST, DOLL_FLOOR, DOLL_SCALE } from './machine';

// 결과에 맞춘 집게 연출 (모든 화면이 같은 순서):
// 옮겨 가며 흔들림·벌리기 → 인형 머리 위까지 내려감 → 오므려 쥠 → 잡은 부위를 축으로 매달고 올라감
// → 성공: 상품 구멍으로 옮겨 놓음 / 놓침: 도중에 떨어져 통통 튀고 굴러 서버가 정한 근처 자리로 / 헛잡음: 미끄러져 빈손
// → 쉬는 자리로 돌아감. 흔들림(진자)은 부르는 쪽이 매 프레임 집게 움직임으로 계산한다
export type ClawShowDeps = {
  tw: Tweens;
  zone: BigZone;
  swing: Swing;
  takePending(): DollSpot[] | undefined; // 이 기계의 새 배치(machine 메시지)를 가져가고 지운다
};

const TOP_Y = CLAW_REST.y + CABLE_TOP; // 집게가 매달린 곳
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const tiltOf = (r: number, y: number) => new THREE.Euler(Math.sin(r * 3) * 0.25 + (y > 0 ? 0.3 : 0), r, Math.cos(r * 5) * 0.25);

export async function runClaw(d: ClawShowDeps, m: Result): Promise<void> {
  const { tw, zone } = d;
  const rig = zone.activateClaw(m.m), claw = zone.clawOf(m.m), anchor = zone.worldOf(m.m);
  const setY = (y: number) => { claw.position.y = y; rig.setCable(TOP_Y - y); };
  let openNow = 0.35;
  const setOpen = (t: number) => { openNow = t; rig.setOpen(t); };
  const before = zone.contentsOf(m.m);
  const index = m.i ?? null, target = index !== null ? before[index] ?? null : null;
  const surface = aimHeight(before, m.x, m.z);
  const lowY = Math.min(CLAW_REST.y - 0.2, surface + CLAW_REACH * 0.62); // 손가락 끝이 인형 윗부분을 감싸는 높이

  // 1) 노린 자리에서 실제 자리로 흔들리며 옮겨 가고 손가락을 벌린다
  const from = { x: claw.position.x, z: claw.position.z }, landing = { x: m.x, z: m.z };
  d.swing.kick((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5); // 모터가 덜컥
  await tw.tween(0.7, (k) => {
    const at = clawPath(from, landing, k);
    claw.position.x = at.x; claw.position.z = at.z;
    setOpen(lerp(0.35, 1, k));
  }, ease.lin);
  // 2) 내려간다 (얹힌 인형이면 덜)
  await tw.tween(0.8, (k) => setY(lerp(CLAW_REST.y, lowY, k)), ease.inOut);
  // 3) 오므려 쥔다 — 인형이 끼면 다 못 오므린다
  await tw.tween(0.35, (k) => setOpen(lerp(1, target ? 0.28 : 0, k)), ease.out);

  let held: THREE.Object3D | null = null;
  if (target && index !== null && m.o !== 'miss') {
    held = pickUp(zone, m.m, before, index, rig.grip, anchor);
  }
  // 4) 잡은 부위를 축으로 매단 채 올라간다
  const hang = held ? hangDown(held, rig.grip) : null;
  let fell: Promise<void> | null = null;
  await tw.tween(0.9, (k) => {
    setY(lerp(lowY, CLAW_REST.y, k));
    if (hang) rig.grip.quaternion.slerpQuaternions(new THREE.Quaternion(), hang, Math.min(1, k * 2.2));
    if (m.o === 'miss' && target) setOpen(k < 0.25 ? lerp(0.28, 0.45, k / 0.25) : lerp(0.45, 0, Math.min(1, (k - 0.25) / 0.3))); // 미끄러져 빈손
    if (m.o === 'slip' && held && !fell && k >= 0.75) {
      setOpen(0.6); // 거의 다 올라가 덜컥할 때 손가락이 풀린다
      fell = fallAndRoll(d, m.m, held, anchor, before, index!);
      held = null;
    }
  }, ease.inOut);
  if (fell) await fell;

  if (m.o === 'win' && held) {
    // 5) 상품 구멍 위로 옮겨 가서 놓는다
    const [hx, hz] = MACHINE_SPEC.hole;
    const start = { x: claw.position.x, z: claw.position.z };
    await tw.tween(0.8, (k) => { claw.position.x = lerp(start.x, hx, k); claw.position.z = lerp(start.z, hz, k); }, ease.inOut);
    await tw.tween(0.25, (k) => setOpen(lerp(0.28, 1, k)), ease.out);
    const doll = held;
    anchor.attach(doll);
    const p0 = doll.position.clone(), s0 = doll.scale.x;
    await tw.tween(0.4, (k) => { doll.position.y = p0.y - k * k * 0.9; doll.scale.setScalar(lerp(s0, s0 * 0.6, k)); }, ease.lin);
    anchor.remove(doll);
  }
  // 6) 쉬는 자리로 돌아간다
  const back = { x: claw.position.x, z: claw.position.z }, openFrom = openNow;
  await tw.tween(0.5, (k) => {
    claw.position.x = lerp(back.x, CLAW_REST.x, k); claw.position.z = lerp(back.z, CLAW_REST.z, k);
    setOpen(lerp(openFrom, 0.35, k));
  }, ease.inOut);
  rig.grip.quaternion.identity();
  zone.releaseClaw(m.m);
}

// 무더기의 그 인형을 같은 자리·모습 그대로 꺼내 집게 손 끝에 붙인다 (무더기에서는 뺀다)
function pickUp(zone: BigZone, machineId: string, before: DollSpot[], index: number, grip: THREE.Object3D, anchor: THREE.Object3D): THREE.Object3D | null {
  const [id, x, z, r, y = 0] = before[index];
  const doll = makeDoll(id);
  if (!doll) return null;
  doll.scale.setScalar(DOLL_SCALE);
  doll.position.set(x, DOLL_FLOOR + y, z);
  doll.rotation.copy(tiltOf(r, y));
  anchor.add(doll);
  anchor.updateMatrixWorld(true);
  grip.attach(doll); // 보이는 자리는 그대로, 이제 집게를 따라간다
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
  const [, x1, z1, r1, y1 = 0] = next?.[index] ?? before[index];
  anchor.attach(doll);
  const p0 = doll.position.clone(), q0 = doll.quaternion.clone();
  const ground = DOLL_FLOOR + y1;
  const dir = new THREE.Vector3(x1 - p0.x, 0, z1 - p0.z);
  const dist = dir.length();
  const axis = dist > 1e-4 ? new THREE.Vector3(dir.z, 0, -dir.x).normalize() : new THREE.Vector3(1, 0, 0);
  const roll = new THREE.Quaternion(), end = new THREE.Quaternion().setFromEuler(tiltOf(r1, y1));
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
