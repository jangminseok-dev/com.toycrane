import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { FIGURES } from '../data/figures';
import { MACHINES } from '../data/storeLayout';
import { figureCameraPose } from '../game/figureCamera';
import { machineCameraPose } from '../game/machineCamera';
import { stubCanvas } from '../test/canvasStub';
import { BOX_TIMER_AT, DOLL_TIMER_AT, buildMachineTimer } from './machineTimer';

beforeAll(stubCanvas);

// 남은 시간은 화면 위 알약 대신 기계 조작대 위 표시판에(사용자 2026-11-02 사진 237·238) — 올림한 초, 바뀔 때만 다시 그린다
test('the machine timer shows whole seconds left and redraws only when they change', () => {
  const anchor = new THREE.Group(), timer = buildMachineTimer(anchor, DOLL_TIMER_AT);
  const mesh = anchor.getObjectByName('machine-timer') as THREE.Mesh, map = () => (mesh.material as THREE.MeshBasicMaterial).map!;
  timer.set(14.2);
  expect(mesh.userData.text).toBe('15');
  const v = map().version;
  timer.set(14.05);
  expect(map().version).toBe(v);
  timer.set(13.9);
  expect(mesh.userData.text).toBe('14');
  timer.set(-1);
  expect(mesh.userData.text).toBe('0');
  timer.dispose();
  expect(anchor.getObjectByName('machine-timer')).toBeUndefined();
});

// 기계 앞 시점(인형·미는 뽑기는 machineCameraPose, 피규어·고리는 정면 figureCameraPose)에서 PC·휴대폰 세로 화면 안에 보인다
test('the machine timer is on screen in the machine views', () => {
  const cases = [
    { spot: MACHINES[0], at: DOLL_TIMER_AT, pose: (_aspect: number) => machineCameraPose(MACHINES[0]) },
    { spot: FIGURES[0], at: BOX_TIMER_AT, pose: (aspect: number) => figureCameraPose(FIGURES[0], 0, aspect) },
  ];
  for (const c of cases) for (const aspect of [1.6, 390 / 844]) {
    const anchor = new THREE.Group();
    anchor.position.set(c.spot.x, 0, c.spot.z); anchor.rotation.y = c.spot.ry; anchor.updateMatrixWorld(true);
    const p = anchor.localToWorld(new THREE.Vector3(...c.at)), pose = c.pose(aspect);
    const cam = new THREE.PerspectiveCamera(aspect < 1 ? 60 : 45, aspect, 0.1, 100);
    cam.position.copy(pose.pos); cam.lookAt(pose.look); cam.updateMatrixWorld(true);
    const n = p.project(cam);
    expect(Math.abs(n.x), `${c.spot.id} ${aspect}`).toBeLessThan(0.9);
    expect(Math.abs(n.y), `${c.spot.id} ${aspect}`).toBeLessThan(0.95);
  }
});
