import * as THREE from 'three';
import type { ClawRig } from '../world/claw';
import type { Hit } from '../world/dolls';
import { DOLL_FLOOR } from '../world/machine';

// 집게를 실제로 움직이기 전에 미리 재 본다 (설계 2026-10-31 §3.6):
// 1) 활짝 벌린 채 3mm씩 내려가다가 멈출 높이(펠트 1cm 위까지): 허브·칼라가 어느 인형에든 4mm 안, 손가락이 잡는 인형에 4mm 안,
//    또는 손가락이 옆 인형에 4cm보다 깊이 눌려 들어가기 직전 — 무더기 인형 사이(서버 최소 간격 22cm)는 손가락보다 좁아서
//    손가락은 말랑한 옆 인형을 살짝 누르며 내려간다. 내려갈 때는 머리를 겨우 비켜 갈 만큼만(DESCEND_OPEN) 벌린다
// 2) 그 높이에서 0.01씩 오므리다가 손가락이 "잡는 그 인형" 공에 2mm 안으로 들어오기 직전 벌림 — 옆 인형은 말랑해서 밀린다고 본다
// 잰 뒤 집게 상태(높이·벌림·흔들림)는 되돌려 놓는다. solids는 기계 안 좌표(world/dollPose.ts solidsOf)
const STEP_Y = 0.003, STEP_OPEN = 0.01, MARGIN_DOWN = 0.004, MARGIN_CLOSE = 0.002, FLOOR_GAP = 0.01, NEIGHBOUR_PRESS = 0.04;
export const DESCEND_OPEN = 0.85; // 손가락 끝이 서 있는 인형 머리·주둥이(앞으로 12cm)를 비켜 가는 벌림
const p = new THREE.Vector3();

function touching(anchor: THREE.Object3D, probes: THREE.Object3D[], solids: Hit[][], margin: number): boolean {
  anchor.updateMatrixWorld(true);
  for (const probe of probes) {
    anchor.worldToLocal(probe.getWorldPosition(p));
    for (const hits of solids) for (const h of hits) if (p.distanceTo(h.c) < h.r + margin) return true;
  }
  return false;
}
function lowest(anchor: THREE.Object3D, probes: THREE.Object3D[]): number {
  anchor.updateMatrixWorld(true);
  return Math.min(...probes.map((o) => anchor.worldToLocal(o.getWorldPosition(p)).y));
}

export function planGrip(rig: ClawRig, claw: THREE.Object3D, anchor: THREE.Object3D, solids: Hit[][], target: number | null): { y: number; open: number } {
  const keep = { y: claw.position.y, open: rig.openness(), swing: rig.swing.rotation.clone() };
  rig.swing.rotation.set(0, 0, 0);
  rig.setOpen(DESCEND_OPEN);
  const mine = target === null ? undefined : solids[target];
  const others = solids.filter((_, i) => i !== target);
  const body = rig.probes.filter((o) => !rig.fingerProbes.includes(o));
  const blocked = () => touching(anchor, body, solids, MARGIN_DOWN)
    || (!!mine && touching(anchor, rig.fingerProbes, [mine], MARGIN_DOWN))
    || touching(anchor, rig.fingerProbes, others, -NEIGHBOUR_PRESS)
    || lowest(anchor, rig.probes) < DOLL_FLOOR + FLOOR_GAP;
  let y = claw.position.y;
  while (y > 0) {
    claw.position.y = y - STEP_Y;
    if (blocked()) break;
    y -= STEP_Y;
  }
  claw.position.y = y;
  let open = 0;
  if (mine) {
    for (let t = DESCEND_OPEN; t >= 0; t -= STEP_OPEN) {
      rig.setOpen(t);
      if (touching(anchor, rig.fingerProbes, [mine], MARGIN_CLOSE)) { open = Math.min(DESCEND_OPEN, t + STEP_OPEN); break; }
    }
  }
  claw.position.y = keep.y; rig.setOpen(keep.open); rig.swing.rotation.copy(keep.swing);
  anchor.updateMatrixWorld(true);
  return { y, open };
}
