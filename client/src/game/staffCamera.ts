// 직원이 오는 동안의 카메라(상주 직원 설계 2026-11-24, 사용자 고름 '가'): 기계 앞 화면은 유리가 화면 폭을 거의 채워 옆에 선 직원이 화면 밖이다.
// 그래서 기계 정면 쪽으로 물러나 기계 유리와 옆 자리 직원을 함께 담는다 — 화면 비율(휴대폰 세로는 화각 60°)에 맞춰 둘이 다 들어올 때까지 물러난다
import * as THREE from 'three';
import type { Vec2 } from './movement';

// 담을 기계 앞면: 기계 가운데에서 앞으로 front, 좌우 ±half, 높이 bottom~top (인형·피규어·고리·미는 뽑기 모두 들어가는 넉넉한 상자)
export const STAFF_FRAME = { front: 0.5, half: 0.65, bottom: 0.45, top: 2.0 } as const;
const STAFF_TOP = 1.75, MARGIN = 0.72, RISE = 0.9, LOOK_Y = 1.15; // 화면 가장자리에서 넉넉히 — PC에서 0.88이면 직원이 화면 왼쪽 절반을 차지했다(2026-11-24 스크린샷)

export function staffCameraPose(m: { x: number; z: number; ry: number }, side: Vec2, aspect: number): { pos: THREE.Vector3; look: THREE.Vector3 } {
  const fwd = new THREE.Vector3(Math.sin(m.ry), 0, Math.cos(m.ry)), right = new THREE.Vector3(Math.cos(m.ry), 0, -Math.sin(m.ry));
  const front = new THREE.Vector3(m.x, 0, m.z).addScaledVector(fwd, STAFF_FRAME.front);
  const look = new THREE.Vector3((front.x + side.x) / 2, LOOK_Y, (front.z + side.z) / 2);
  const pts = [
    ...[-1, 1].flatMap((s) => [STAFF_FRAME.bottom, STAFF_FRAME.top].map((y) => front.clone().addScaledVector(right, s * STAFF_FRAME.half).setY(y))),
    new THREE.Vector3(side.x, 0, side.z), new THREE.Vector3(side.x, STAFF_TOP, side.z),
  ];
  const cam = new THREE.PerspectiveCamera(aspect < 1 ? 60 : 45, aspect, 0.1, 100);
  for (let d = 2.4; ; d += 0.1) {
    cam.position.copy(look).addScaledVector(fwd, d).setY(look.y + RISE);
    cam.lookAt(look); cam.updateMatrixWorld();
    if (d > 12 || pts.every((p) => { const q = p.clone().project(cam); return Math.abs(q.x) <= MARGIN && Math.abs(q.y) <= MARGIN; })) return { pos: cam.position.clone(), look };
  }
}
