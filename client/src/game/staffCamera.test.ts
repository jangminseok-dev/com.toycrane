import * as THREE from 'three';
import { expect, test } from 'vitest';
import { sideSpot } from '../data/staff';
import { FIGURES } from '../data/figures';
import { PUSHERS } from '../data/pushers';
import { RINGS } from '../data/rings';
import { MACHINES } from '../data/storeLayout';
import { staffCameraPose, STAFF_FRAME } from './staffCamera';

// 상주 직원(설계 2026-11-24, 사용자 고름 '가'): 직원이 오는 동안 카메라가 뒤로 빠져 기계 유리와 옆에 선 직원이 함께 보이고, 직원이 유리를 가리지 않는다
const spots = new Map([...MACHINES, ...FIGURES, ...RINGS, ...PUSHERS].map((m) => [m.id, m]));
const SCREENS = { pc: 16 / 9, phone: 9 / 19.5 };
for (const id of ['A-1', 'C-6', 'P-1', 'F-1', 'F-14', 'R-1', 'R-10']) for (const [name, aspect] of Object.entries(SCREENS)) {
  test(`${id} on ${name}: the machine glass and the staff beside it are both on screen`, () => {
    const m = spots.get(id)!, side = sideSpot(id), pose = staffCameraPose(m, side, aspect);
    const cam = new THREE.PerspectiveCamera(aspect < 1 ? 60 : 45, aspect, 0.1, 100);
    cam.position.copy(pose.pos); cam.lookAt(pose.look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).project(cam);
    const fwd = { x: Math.sin(m.ry), z: Math.cos(m.ry) }, right = { x: Math.cos(m.ry), z: -Math.sin(m.ry) };
    const glass = (s: number, y: number) => at(m.x + fwd.x * STAFF_FRAME.front + right.x * s * STAFF_FRAME.half, y, m.z + fwd.z * STAFF_FRAME.front + right.z * s * STAFF_FRAME.half);
    const inside = (p: THREE.Vector3) => Math.abs(p.x) <= 0.95 && Math.abs(p.y) <= 0.95 && p.z < 1;
    for (const s of [-1, 1]) for (const y of [STAFF_FRAME.bottom, STAFF_FRAME.top]) expect(inside(glass(s, y)), `glass ${s} ${y}`).toBe(true);
    const head = at(side.x, 1.75, side.z), feet = at(side.x, 0, side.z);
    expect(inside(head) && inside(feet), 'staff').toBe(true);
    // 직원(큰 머리 폭 ±0.5m, 머리 높이 1.2m)이 유리를 거의 가리지 않는다 — 유리 앞면 폭과 겹치는 부분이 15% 이하(2026-11-24 스크린샷: 앞자리 옆에 서면 유리 왼쪽 절반을 가렸다)
    const mid = (STAFF_FRAME.bottom + STAFF_FRAME.top) / 2, g = [glass(-1, mid).x, glass(1, mid).x], gl = Math.min(...g), gr = Math.max(...g);
    const xs = [-0.5, 0.5].flatMap((d) => [0.6, 1.2, 1.6].map((y) => at(side.x + right.x * d, y, side.z + right.z * d).x)), sl = Math.min(...xs), sr = Math.max(...xs);
    expect(Math.max(0, Math.min(gr, sr) - Math.max(gl, sl)) / (gr - gl), 'covers the glass').toBeLessThanOrEqual(0.15);
  });
}
