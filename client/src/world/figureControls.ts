import * as THREE from 'three';
import type { FigurePhase } from '../game/figureSession';
import { FIGURE_BUTTONS } from './copy';
import { buttonLabelTex } from './signs';
import { part, toonWith } from './toon';

// 피규어 기계 조작대의 진짜 버튼 ①(빨강)·②(파랑) (9단계 설계 §3.3, 예전 버튼판 fde3f11과 같은 자리·모양): 기계 좌표 (x, y, z).
// 지금 누를 버튼은 두근두근 빛나고, 누르는 동안 1.2cm 들어간다. 누르는 범위(보이지 않는 상자)는 휴대폰 손가락을 위해 그림보다 넉넉하다(26cm).
// 윗면에는 인형 기계 '잡기'처럼 하는 일('오른쪽' ▶, '안쪽' ▲)을 적는다(사용자 2026-11-02)
export const FIGURE_CONTROLS = { one: [0.12, 0.925, 0.66], two: [0.32, 0.925, 0.66] } as const;
const DOME = new THREE.SphereGeometry(0.055, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const HIT = new THREE.BoxGeometry(0.26, 0.16, 0.26);
export const BUTTON_SCALE: [number, number, number] = [1.5, 0.62, 1.5]; // 인형 기계 잡기 버튼과 같은 크기(글씨가 읽히게) — 기계 그림의 고정 버튼도 같게
export const LABEL = new THREE.PlaneGeometry(0.08, 0.08); // 윗면 지름(0.11)의 73% — 기계 그림의 고정 버튼(figureZone)도 같은 글씨
export const LABEL_Y = 0.057; // 돔 기준 글씨 높이(돔 크기 BUTTON_SCALE를 따라간다)
const LOOK = [{ arrow: 'right', ink: '#8a0f2a' }, { arrow: 'up', ink: '#123a8a' }] as const;
export type ButtonLabels = readonly [string, string]; // ①② 윗면 글씨(피규어 '오른쪽'·'안쪽', 고리 '오른쪽'·'위로') — 화살표는 ▶·▲
const labelMats = new Map<string, THREE.Material>(); // 판마다 새로 그리지 않게 글씨마다 한 번만
export const labelMat = (i: number, labels: ButtonLabels = FIGURE_BUTTONS): THREE.Material => {
  const key = `${i}|${labels[i]}`;
  let m = labelMats.get(key);
  if (!m) labelMats.set(key, (m = new THREE.MeshBasicMaterial({ map: buttonLabelTex(labels[i], LOOK[i].arrow, LOOK[i].ink), transparent: true, depthWrite: false })));
  return m;
};
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

export function buildFigureControls(anchor: THREE.Object3D, labels: ButtonLabels = FIGURE_BUTTONS): FigureControls {
  const group = new THREE.Group(); group.name = 'figure-controls';
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const buttons = ([[FIGURE_CONTROLS.one, 0xff3b5c], [FIGURE_CONTROLS.two, 0x3b8bff]] as const).map(([[x, y, z], c], i) => {
    const mat = toonWith({ color: c, emissive: c, emissiveIntensity: 0 });
    const dome = part(DOME, mat, [x, y, z], BUTTON_SCALE, [0, 0, 0], 1.04);
    // 윗면 글씨: 버튼 자식이라 함께 눌린다. 글씨 위(+y)가 기계 안쪽(−z)을 본다
    const label = new THREE.Mesh(LABEL, labelMat(i, labels));
    label.name = `figure-label-${i + 1}`; label.userData.text = labels[i]; label.rotation.x = -Math.PI / 2; label.position.y = LABEL_Y;
    dome.add(label);
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
