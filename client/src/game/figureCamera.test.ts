import * as THREE from 'three';
import { expect, test } from 'vitest';
import { FIGURE, FIGURES } from '../data/figures';
import { clawShapeOf } from '../physics/figureClaw';
import { FIGURE_CONTROLS } from '../world/figureControls';
import { SideBlend, figureCameraPose } from './figureCamera';

// 9단계 피규어 시점(설계 §3.3.1): ①은 정면, ①을 떼면 옆 대각선 — 상자와 누를 버튼이 PC(가로)·휴대폰(세로) 화면 안에
const spot = FIGURES[3];
const toWorld = (p: readonly [number, number, number]) => new THREE.Vector3(...p).applyAxisAngle(new THREE.Vector3(0, 1, 0), spot.ry).add(new THREE.Vector3(spot.x, 0, spot.z));
const BOX = toWorld([0, FIGURE.bars.y + 0.04, 0]);
// 화각은 게임(main.ts resize)과 같게: 가로 45°, 세로 60°. top: 화면 위 끝(위에는 남은 시간·안내 글이 덮는다)
function onScreen(side: number, aspect: number, p: THREE.Vector3, top = 0.95): boolean {
  const cam = new THREE.PerspectiveCamera(aspect < 1 ? 60 : 45, aspect, 0.1, 100), pose = figureCameraPose(spot, side, aspect);
  cam.position.copy(pose.pos); cam.lookAt(pose.look); cam.updateMatrixWorld(true);
  const n = p.clone().project(cam);
  return Math.abs(n.x) <= 0.95 && n.y >= -0.95 && n.y <= top && n.z < 1;
}

test('front view shows the box and both buttons on wide and tall screens', () => {
  for (const aspect of [1.6, 390 / 844]) {
    expect(onScreen(0, aspect, BOX), `box ${aspect}`).toBe(true);
    expect(onScreen(0, aspect, toWorld(FIGURE_CONTROLS.one)), `one ${aspect}`).toBe(true);
    expect(onScreen(0, aspect, toWorld(FIGURE_CONTROLS.two)), `two ${aspect}`).toBe(true);
  }
});

test('button two stays on screen from the side', () => {
  for (const aspect of [1.6, 390 / 844]) {
    expect(onScreen(1, aspect, BOX), `box ${aspect}`).toBe(true);
    expect(onScreen(1, aspect, toWorld(FIGURE_CONTROLS.two)), `two ${aspect}`).toBe(true);
  }
});

test('side view looks across the bars from the right', () => {
  for (const aspect of [1.6, 390 / 844]) {
    const f = figureCameraPose(spot, 0, aspect), s = figureCameraPose(spot, 1, aspect);
    const dir = (p: { pos: THREE.Vector3; look: THREE.Vector3 }) => p.look.clone().sub(p.pos).setY(0).normalize();
    expect(THREE.MathUtils.radToDeg(dir(f).angleTo(dir(s)))).toBeGreaterThan(30);
  }
});

test('blend moves only between presses', () => {
  const b = new SideBlend();
  expect(b.value(5)).toBe(0);
  b.start(10);
  expect(b.value(10.3)).toBeGreaterThan(0); expect(b.value(10.3)).toBeLessThan(1);
  expect(b.value(10.6)).toBe(1);
  b.stop(20);
  expect(b.value(20.6)).toBe(0);
});

// 집게는 대기 높이(rest_y)에서 움직인다 — ① 동안(정면)은 앞쪽 줄 왼쪽 끝~오른쪽 끝, ② 동안(옆)은 놀이 칸 네 귀퉁이가 다 보여야 한다
test('the claw at rest height stays in view while the buttons move it', () => {
  const [w, d] = FIGURE.play_half, head = (x: number, z: number) => toWorld([x, FIGURE.claw.rest_y, z]);
  for (const aspect of [1.6, 390 / 844]) {
    for (const x of [-w, w]) {
      expect(onScreen(0, aspect, head(x, FIGURE.claw.home[1]), 0.8), `front ${aspect} x ${x}`).toBe(true);
      // 1.5배 집게(설계 §8)의 팔 끝도 — 머리에서 경첩·팔 길이만큼 아래
      for (const kind of ['long', 'square'] as const) {
        const S = clawShapeOf(kind), tip = toWorld([x + Math.sign(x) * S.hinge[0], FIGURE.claw.rest_y + S.hinge[1] + S.tip[1], FIGURE.claw.home[1]]);
        expect(onScreen(0, aspect, tip), `front tip ${kind} ${aspect} x ${x}`).toBe(true);
      }
      for (const z of [d, -d]) expect(onScreen(1, aspect, head(x, z), 0.8), `side ${aspect} ${x},${z}`).toBe(true);
    }
  }
});

// 옆에서 볼 때 집게가 상자를 잡는 곳이 유리 칸 크롬 기둥(machine.ts makeCabinetShell, 기계 좌표 (±0.57, ±0.5)) 뒤에 숨지 않게.
// 조작대 버튼 ①②도 — 앞 오른쪽 기둥 뒤에 반쯤 숨어 어디를 누를지 몰랐다(사용자 2026-11-02 사진 222)
test('the side view sees the box and both buttons past the cabinet pillars', () => {
  const PILLARS = [[0.57, 0.5], [0.57, -0.5], [-0.57, 0.5], [-0.57, -0.5]];
  for (const aspect of [1.6, 1.86, 390 / 844]) {
    for (const b of [FIGURE_CONTROLS.one, FIGURE_CONTROLS.two]) expect(onScreen(1, aspect, toWorld(b)), `button ${b} ${aspect}`).toBe(true);
    const eye = figureCameraPose(spot, 1, aspect).pos.clone().sub(new THREE.Vector3(spot.x, 0, spot.z)).applyAxisAngle(new THREE.Vector3(0, 1, 0), -spot.ry);
    for (const [tx, tz] of [[0, 0], [0, 0.11], [0, -0.11], [-0.2, 0], [0.2, 0], [FIGURE_CONTROLS.one[0], FIGURE_CONTROLS.one[2]], [FIGURE_CONTROLS.two[0], FIGURE_CONTROLS.two[2]]]) {
      for (const [px, pz] of PILLARS) {
        const dx = tx - eye.x, dz = tz - eye.z, k = Math.max(0, Math.min(1, ((px - eye.x) * dx + (pz - eye.z) * dz) / (dx * dx + dz * dz)));
        expect(Math.hypot(eye.x + dx * k - px, eye.z + dz * k - pz), `${aspect} to ${tx},${tz} past ${px},${pz}`).toBeGreaterThan(0.075);
      }
    }
  }
});
