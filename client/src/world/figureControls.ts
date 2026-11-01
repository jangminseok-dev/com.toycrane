import * as THREE from 'three';
import type { FigurePhase } from '../game/figureSession';
import { part, toonWith } from './toon';

// 피규어 기계 조작대의 진짜 버튼 ①(빨강)·②(파랑) (9단계 설계 §3.3, 예전 버튼판 fde3f11과 같은 자리·모양): 기계 좌표 (x, y, z).
// 지금 누를 버튼은 두근두근 빛나고, 누르는 동안 1.2cm 들어간다. 누르는 범위(보이지 않는 상자)는 휴대폰 손가락을 위해 그림보다 넉넉하다(26cm)
export const FIGURE_CONTROLS = { one: [0.12, 0.925, 0.66], two: [0.32, 0.925, 0.66] } as const;
const DOME = new THREE.SphereGeometry(0.055, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const HIT = new THREE.BoxGeometry(0.26, 0.16, 0.26);
const PRESS_DEPTH = 0.012, GLOW = 0.75;

export type FigureControls = {
  pick(ray: THREE.Raycaster): 1 | 2 | null;
  setPhase(phase: FigurePhase): void;
  setPressed(button: 1 | 2 | null): void;
  update(t: number): void;
  glow(button: 1 | 2): number;
  domeY(button: 1 | 2): number;
  dispose(): void;
};

export function buildFigureControls(anchor: THREE.Object3D): FigureControls {
  const group = new THREE.Group(); group.name = 'figure-controls';
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const buttons = ([[FIGURE_CONTROLS.one, 0xff3b5c], [FIGURE_CONTROLS.two, 0x3b8bff]] as const).map(([[x, y, z], c], i) => {
    const mat = toonWith({ color: c, emissive: c, emissiveIntensity: 0 });
    const dome = part(DOME, mat, [x, y, z], [1.05, 0.47, 1.05], [0, 0, 0], 1.04);
    const hit = new THREE.Mesh(HIT, hitMat); hit.position.set(x, y + 0.04, z); hit.userData.button = (i + 1) as 1 | 2;
    group.add(dome, hit);
    return { dome, hit, mat, restY: y };
  });
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
    update(t) {
      const pulse = 0.55 + 0.45 * Math.sin(t * 7); // 지금 누를 버튼이 두근두근
      buttons.forEach((b, i) => { b.mat.emissiveIntensity = active === i + 1 ? GLOW * pulse : 0; });
    },
    glow: (button) => buttons[button - 1].mat.emissiveIntensity,
    domeY: (button) => buttons[button - 1].dome.position.y,
    dispose() { anchor.remove(group); },
  };
}
