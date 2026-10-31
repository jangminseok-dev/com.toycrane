import * as THREE from 'three';
import type { PlayPhase } from '../game/playSession';
import { CONTROLS } from './machine';
import { part, toonWith } from './toon';

// 하는 기계의 조작대 위에 덧그리는 "살아 있는" 버튼·레버 (설계 2026-10-31 §3.10): 합쳐 그린 기계 그림 위에 같은 자리로 겹친다.
// 지금 누를 버튼은 깜빡이며 빛나고, 누르는 동안 1.2cm 들어간다. 레버는 장식으로 집게가 가는 쪽으로 기운다.
// 누르는 범위(보이지 않는 상자)는 휴대폰 손가락을 위해 그림보다 넉넉하다(가로세로 26cm)
const DOME = new THREE.SphereGeometry(0.055, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const HIT = new THREE.BoxGeometry(0.26, 0.16, 0.26);
const STICK = new THREE.CylinderGeometry(0.01, 0.01, 0.09, 10).translate(0, 0.045, 0);
const BALL = new THREE.SphereGeometry(0.04, 16, 12);
const PRESS_DEPTH = 0.012, GLOW = 0.75;

export type MachineControls = {
  pick(ray: THREE.Raycaster): 1 | 2 | null;
  setPhase(phase: PlayPhase): void;
  setPressed(button: 1 | 2 | null): void;
  setLever(dx: number, dz: number): void; // 집게가 움직이는 쪽 (-1~1)
  update(t: number): void;
  glow(button: 1 | 2): number;
  domeY(button: 1 | 2): number;
  dispose(): void;
};

export function buildMachineControls(anchor: THREE.Object3D): MachineControls {
  const group = new THREE.Group(); group.name = 'live-controls';
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const buttons = ([[CONTROLS.one, 0xff3b5c], [CONTROLS.two, 0x3b8bff]] as const).map(([[x, y, z], c], i) => {
    const mat = toonWith({ color: c, emissive: c, emissiveIntensity: 0 });
    const dome = part(DOME, mat, [x, y, z], [1.05, 0.47, 1.05], [0, 0, 0], 1.04);
    const hit = new THREE.Mesh(HIT, hitMat); hit.position.set(x, y + 0.04, z); hit.userData.button = (i + 1) as 1 | 2;
    group.add(dome, hit);
    return { dome, hit, mat, restY: y };
  });
  const [lx, ly, lz] = CONTROLS.lever;
  const lever = new THREE.Group(); lever.position.set(lx, ly + 0.012, lz);
  lever.add(part(STICK, toonWith({ color: 0xd3d6de }), [0, 0, 0], [1.1, 1, 1.1], [0, 0, 0], 0));
  lever.add(part(BALL, toonWith({ color: 0xff3b5c }), [0, 0.09, 0], [1.03, 1.03, 1.03]));
  group.add(lever);
  group.traverse((o) => { o.castShadow = false; });
  anchor.add(group);
  let active: 1 | 2 | null = 1;
  return {
    pick(ray) {
      const hits = ray.intersectObjects(buttons.map((b) => b.hit), false);
      return hits.length ? (hits[0].object.userData.button as 1 | 2) : null;
    },
    setPhase(phase) {
      active = phase === 'one' || phase === 'moving-one' ? 1 : phase === 'two' || phase === 'moving-two' ? 2 : null;
      buttons.forEach((b, i) => { b.mat.emissiveIntensity = active === i + 1 ? GLOW : 0; });
    },
    setPressed(button) {
      buttons.forEach((b, i) => { b.dome.position.y = b.restY - (button === i + 1 ? PRESS_DEPTH : 0); });
    },
    setLever(dx, dz) { lever.rotation.set(dz * 0.35, 0, -dx * 0.35); },
    update(t) {
      const pulse = 0.55 + 0.45 * Math.sin(t * 7); // 지금 누를 버튼이 두근두근
      buttons.forEach((b, i) => { b.mat.emissiveIntensity = active === i + 1 ? GLOW * pulse : 0; });
    },
    glow: (button) => buttons[button - 1].mat.emissiveIntensity,
    domeY: (button) => buttons[button - 1].dome.position.y,
    dispose() { anchor.remove(group); },
  };
}
