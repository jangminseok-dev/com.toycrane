import * as THREE from 'three';
import { CONTROLS } from './machine';
import { part, toonWith } from './toon';

// 하는 기계의 조작대 위에 덧그리는 "살아 있는" 레버·하강 버튼 (설계 2026-10-31 §3.10, 3차): 합쳐 그린 기계 그림 위에 같은 자리로 겹친다.
// 레버는 끄는 쪽으로 기울고, 하강 버튼은 두근두근 빛나다가 누르면 1.5cm 들어간다.
// 누르는 범위(보이지 않는 상자)는 휴대폰 손가락을 위해 그림보다 넉넉하다
const DOME = new THREE.SphereGeometry(0.055, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const STICK = new THREE.CylinderGeometry(0.01, 0.01, 0.09, 10).translate(0, 0.045, 0);
const BALL = new THREE.SphereGeometry(0.04, 16, 12);
const LEVER_HIT = new THREE.BoxGeometry(0.34, 0.24, 0.34), DROP_HIT = new THREE.BoxGeometry(0.34, 0.18, 0.32);
const PRESS_DEPTH = 0.015, GLOW = 0.7, TILT = 0.4;

export type ControlPart = 'lever' | 'drop';
export type MachineControls = {
  pick(ray: THREE.Raycaster): ControlPart | null;
  setLever(dx: number, dz: number): void; // 레버를 민 쪽 (-1~1, 기계 안 +x 오른쪽 / -z 안쪽)
  setPressed(on: boolean): void;
  update(t: number): void;
  leverTilt(): THREE.Euler;
  dropY(): number;
  dispose(): void;
};

export function buildMachineControls(anchor: THREE.Object3D): MachineControls {
  const group = new THREE.Group(); group.name = 'live-controls';
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const [dx, dy, dz] = CONTROLS.drop;
  const dropMat = toonWith({ color: 0xff3b5c, emissive: 0xff3b5c, emissiveIntensity: 0 });
  const dome = part(DOME, dropMat, [dx, dy, dz], [1.5, 0.62, 1.5], [0, 0, 0], 1.04);
  const dropHit = new THREE.Mesh(DROP_HIT, hitMat); dropHit.position.set(dx, dy + 0.04, dz); dropHit.userData.part = 'drop';
  const [lx, ly, lz] = CONTROLS.lever;
  const lever = new THREE.Group(); lever.position.set(lx, ly + 0.012, lz);
  lever.add(part(STICK, toonWith({ color: 0xd3d6de }), [0, 0, 0], [1.1, 1, 1.1], [0, 0, 0], 0));
  lever.add(part(BALL, toonWith({ color: 0xff3b5c }), [0, 0.09, 0], [1.03, 1.03, 1.03]));
  const leverHit = new THREE.Mesh(LEVER_HIT, hitMat); leverHit.position.set(lx, ly + 0.08, lz); leverHit.userData.part = 'lever';
  group.add(dome, dropHit, lever, leverHit);
  group.traverse((o) => { o.castShadow = false; });
  anchor.add(group);
  return {
    pick(ray) {
      const hits = ray.intersectObjects([leverHit, dropHit], false);
      return hits.length ? (hits[0].object.userData.part as ControlPart) : null;
    },
    setLever(x, z) { lever.rotation.set(z * TILT, 0, -x * TILT); },
    setPressed(on) { dome.position.y = dy - (on ? PRESS_DEPTH : 0); },
    update(t) { dropMat.emissiveIntensity = GLOW * (0.55 + 0.45 * Math.sin(t * 6)); },
    leverTilt: () => lever.rotation,
    dropY: () => dome.position.y,
    dispose() { anchor.remove(group); },
  };
}
