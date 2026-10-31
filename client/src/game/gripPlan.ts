import * as THREE from 'three';
import { makeClawRig } from '../world/claw';
import type { Hit } from '../world/dolls';
import { DOLL_FLOOR } from '../world/machine';

// 집게를 실제로 움직이기 전에 미리 재 본다 (설계 2026-10-31 §3.6). 모든 집게는 모양이 같고 재는 동안 흔들림이 없으니,
// 벌림 0~1을 100칸으로 나눠 집게 원점 기준 표본점 자리를 한 번만 구해 두고 더하기로만 잰다 (매장 모든 결과마다 부르므로 가볍게).
// 1) 내려갈 벌림: 허브가 잡는 인형 꼭대기에 얹힐 때까지 내려오는 내내 손가락이 그 인형에 닿지 않는 가장 작은 벌림(서 있는 형 0.85, 동글이형은 더 넓게)
// 2) 그 벌림으로 3mm씩 내려가다 멈춤: 허브·칼라가 어느 인형에든 4mm 안 / 손가락이 잡는 인형에 4mm 안 /
//    손가락이 옆 인형에 7cm보다 깊이(옆 인형은 말랑해서 밀려 비켜 준다 — world/plush.ts) / 오므리는 내내 손가락 끝이 펠트 위
// 3) 그 높이에서 0.01씩 오므리다 손가락이 잡는 인형에 2mm 안으로 들어오기 직전 벌림. solids는 기계 안 좌표(world/dollPose.ts solidsOf)
const STEPS = 100, STEP_Y = 0.003, MIN_DESCEND = 0.85;
const MARGIN_DOWN = 0.004, MARGIN_CLOSE = 0.002, FLOOR_GAP = 0.008, NEIGHBOUR_LIMIT = 0.07, HUB_REST = 0.003;

type Pose = { all: Float32Array; minTipY: number };
let cache: { poses: Pose[]; finger: number[]; tips: number[]; body: number[] } | null = null;
function poses() {
  if (cache) return cache;
  const rig = makeClawRig(), v = new THREE.Vector3(), out: Pose[] = [];
  const finger = rig.probes.map((p, i) => (rig.fingerProbes.includes(p) ? i : -1)).filter((i) => i >= 0);
  const tips = finger.filter((_, k) => k % 12 === 11); // 손가락마다 마디 3개 × 4점, 마지막이 끝
  const body = rig.probes.map((_, i) => i).filter((i) => !finger.includes(i));
  for (let s = 0; s <= STEPS; s++) {
    rig.setOpen(s / STEPS); rig.root.updateMatrixWorld(true);
    const all = new Float32Array(rig.probes.length * 3);
    rig.probes.forEach((p, i) => { p.getWorldPosition(v); all.set([v.x, v.y, v.z], i * 3); });
    out.push({ all, minTipY: Math.min(...tips.map((i) => all[i * 3 + 1])) });
  }
  return (cache = { poses: out, finger, tips, body });
}
const step = (open: number) => Math.round(Math.min(Math.max(open, 0), 1) * STEPS);

// 집게 원점이 (x,y,z)이고 벌림이 open일 때 표본점들(기계 안 좌표) — 화면·테스트용
export function probesAt(x: number, y: number, z: number, open: number) {
  const { poses: P, finger, tips } = poses(), a = P[step(open)].all;
  const all = Array.from({ length: a.length / 3 }, (_, i) => new THREE.Vector3(a[i * 3] + x, a[i * 3 + 1] + y, a[i * 3 + 2] + z));
  return { all, hub: all[0], fingers: finger.map((i) => all[i]), tips: tips.map((i) => all[i]) };
}

// 표본점 중 하나라도 공들에 margin 안으로 들어오는가 (margin이 음수면 그만큼 깊이 들어와야 참)
function touches(open: number, idx: number[], x: number, y: number, z: number, hits: Hit[][], margin: number): boolean {
  const a = poses().poses[step(open)].all;
  for (const i of idx) {
    const px = a[i * 3] + x, py = a[i * 3 + 1] + y, pz = a[i * 3 + 2] + z;
    for (const doll of hits) for (const h of doll) {
      const dx = px - h.c.x, dy = py - h.c.y, dz = pz - h.c.z, rr = h.r + margin;
      if (rr > 0 && dx * dx + dy * dy + dz * dz < rr * rr) return true;
    }
  }
  return false;
}

export function planGrip(x: number, z: number, startY: number, solids: Hit[][], target: number | null): { y: number; open: number; descendOpen: number } {
  const { poses: P, finger, body } = poses();
  const mine = target === null ? undefined : solids[target];
  const others = solids.filter((_, i) => i !== target);
  // 1) 내려갈 벌림
  let descendOpen = MIN_DESCEND;
  if (mine) {
    const top = Math.max(...mine.map((h) => h.c.y + h.r));
    const restY = top + HUB_REST - P[0].all[1]; // 허브 바닥(표본점 0)이 잡는 인형 꼭대기 바로 위
    // 손가락이 내려오는 내내(허브가 꼭대기에 닿을 때까지 손가락 길이만큼) 그 인형을 비켜 가야 한다 — 동글이형은 어깨에 걸린다
    const clears = (open: number) => {
      for (let dy = 0; dy <= 0.3; dy += STEP_Y * 2) if (touches(open, finger, x, restY + dy, z, [mine], MARGIN_DOWN)) return false;
      return true;
    };
    descendOpen = 1;
    for (let s = step(MIN_DESCEND); s <= STEPS; s++) if (clears(s / STEPS)) { descendOpen = s / STEPS; break; }
  }
  // 2) 내려가기 — 오므리는 내내 손가락 끝이 펠트 위에 있게 그 범위의 가장 낮은 끝으로 바닥을 잰다
  let lowestTip = Infinity;
  for (let s = 0; s <= step(descendOpen); s++) lowestTip = Math.min(lowestTip, P[s].minTipY);
  let y = startY;
  for (;;) {
    const ny = y - STEP_Y;
    if (ny + lowestTip < DOLL_FLOOR + FLOOR_GAP) break;
    if (touches(descendOpen, body, x, ny, z, solids, MARGIN_DOWN)) break;
    if (mine && touches(descendOpen, finger, x, ny, z, [mine], MARGIN_DOWN)) break;
    if (touches(descendOpen, finger, x, ny, z, others, -NEIGHBOUR_LIMIT)) break;
    y = ny;
  }
  // 3) 오므리기
  let open = 0;
  if (mine) {
    for (let s = step(descendOpen); s >= 0; s--) {
      if (touches(s / STEPS, finger, x, y, z, [mine], MARGIN_CLOSE)) { open = Math.min(descendOpen, (s + 1) / STEPS); break; }
    }
  }
  return { y, open, descendOpen };
}

// 잡은 인형을 손가락에 붙이는 데 필요한 이동(기계 안 좌표): 가장 가까운 손가락 점과 인형 공 사이 틈만큼 손가락 쪽으로.
// 이미 닿아 있으면(2mm 안) 0 — 팔을 비껴 잡았거나 오므림이 끝까지 가도 안 닿은 경우에만 끌어당긴다
export function contactPull(fingers: THREE.Vector3[], hits: Hit[]): THREE.Vector3 {
  let best = Infinity;
  const pull = new THREE.Vector3();
  for (const f of fingers) for (const h of hits) {
    const d = f.distanceTo(h.c) - h.r;
    if (d < best) { best = d; pull.subVectors(f, h.c).normalize().multiplyScalar(Math.max(0, d - 0.002)); }
  }
  return best === Infinity ? new THREE.Vector3() : pull;
}
