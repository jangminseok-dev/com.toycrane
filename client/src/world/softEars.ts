import * as THREE from 'three';

// 말랑한 귀: 집게 표본점이 귀 공(인형 모양 좌표의 userData.ear) 안으로 들어오면 그 깊이×1.4만큼 바깥 위로 밀리고 살짝 기운다.
// 떨어지면 제자리로 돌아온다(초당 14 비율로 따라감). 밀림은 최대 실제 5cm (설계 2026-10-31 §3.6)
const PUSH = 1.4, MAX_PUSH_M = 0.05, FOLLOW = 14, MARGIN = 0.006, LEAN = 5;
const c = new THREE.Vector3(), w = new THREE.Vector3(), s = new THREE.Vector3();

type EarState = { base: THREE.Vector3; baseRz: number; cur: number };
export function bendEars(doll: THREE.Object3D, probes: THREE.Object3D[], dt: number): void {
  doll.updateMatrixWorld(true);
  const scale = doll.getWorldScale(s).x;
  for (const ear of doll.children) {
    if (ear.name !== 'ear') continue;
    const info = ear.userData.ear as { c: THREE.Vector3; r: number; out: THREE.Vector3 };
    const st = (ear.userData.bend ??= { base: ear.position.clone(), baseRz: ear.rotation.z, cur: 0 }) as EarState;
    doll.localToWorld(c.copy(info.c)); // 휘기 전 자리의 귀 공 — 지금 휜 자리로 재면 밀려난 만큼 덜 밀어 떨린다
    let overlap = 0;
    for (const p of probes) overlap = Math.max(overlap, info.r * scale + MARGIN - p.getWorldPosition(w).distanceTo(c));
    const target = overlap > 0 ? Math.min((overlap / scale) * PUSH, MAX_PUSH_M / scale) : 0;
    st.cur += (target - st.cur) * Math.min(1, dt * FOLLOW);
    ear.position.copy(st.base).addScaledVector(info.out, st.cur);
    ear.rotation.z = st.baseRz - Math.sign(info.out.x) * st.cur * LEAN;
  }
}
