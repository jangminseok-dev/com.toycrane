import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { outlineMat, part } from './toon';

// 크레인 집게: 위(매달린 곳)에서 줄이 내려오고, 크롬 몸통·덮개·고리에 경첩 달린 손가락 3개(윗마디·아랫마디·안으로 굽은 끝).
// 움직이는 집게(ClawRig)는 누가 하는 기계에만 빌려 주고, 쉬는 기계는 같은 모양을 한 덩어리로 합친 도형을 쓴다
const once = <T>(make: () => T) => { let v: T | undefined; return () => (v ??= make()); };
export const CHROME = once(() => new THREE.MeshPhongMaterial({ color: 0xcfd4e2, specular: 0xffffff, shininess: 80 }));
const JOINT = once(() => new THREE.MeshPhongMaterial({ color: 0x8a90a6, specular: 0xffffff, shininess: 60 }));
export const CABLE_TOP = 0.05; // 쉬는 자리에서 몸통 위로 줄이 이만큼 (기계 안 높이 2.0이 매달린 곳)
export const CLAW_REACH = 0.19; // 몸통 원점에서 오므린 손가락 끝까지
const HINGE_R = 0.034, HINGE_Y = -0.065;

const G = once(() => ({
  cable: new THREE.CylinderGeometry(0.006, 0.006, 1, 6).translate(0, -0.5, 0), // 위 0에서 아래 -1까지
  cap: new THREE.SphereGeometry(0.05, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  hub: new THREE.CylinderGeometry(0.05, 0.044, 0.06, 20),
  collar: new THREE.TorusGeometry(0.046, 0.008, 8, 24).rotateX(Math.PI / 2),
  knuckle: new THREE.SphereGeometry(0.013, 10, 8),
  upper: new THREE.CapsuleGeometry(0.009, 0.075, 4, 8),
  elbow: new THREE.SphereGeometry(0.011, 10, 8),
  lower: new THREE.CapsuleGeometry(0.008, 0.06, 4, 8),
  tip: new THREE.ConeGeometry(0.011, 0.03, 8),
}));

export type ClawRig = {
  root: THREE.Group; // 몸통 원점 (기계의 집게 자리에 붙는다)
  swing: THREE.Group; // 매달린 곳을 중심으로 흔들리는 부분
  grip: THREE.Object3D; // 손가락 끝 가운데 — 잡은 인형을 여기에 매단다
  tips: THREE.Object3D[];
  setOpen(t: number): void; // 0 오므림 ~ 1 활짝
  setCable(length: number): void; // 매달린 곳에서 몸통까지 줄 길이
};

export function makeClawRig(): ClawRig {
  const g = G(), chrome = CHROME(), joint = JOINT();
  const root = new THREE.Group(), swing = new THREE.Group(), hang = new THREE.Group();
  root.add(swing); swing.add(hang);
  const cable = new THREE.Mesh(g.cable, joint); swing.add(cable);
  hang.add(part(g.cap, chrome, [0, 0, 0], [1, 0.7, 1], [0, 0, 0], 1.06));
  hang.add(part(g.hub, chrome, [0, -0.03, 0], [1, 1, 1], [0, 0, 0], 1.05));
  hang.add(part(g.collar, joint, [0, -0.062, 0], [1, 1, 1], [0, 0, 0], 0));
  const hinges: THREE.Group[] = [], tips: THREE.Object3D[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const arm = new THREE.Group(); arm.rotation.y = a; hang.add(arm); // 손가락 방향(+z가 바깥)
    const hinge = new THREE.Group(); hinge.position.set(0, HINGE_Y, HINGE_R); arm.add(hinge);
    hinge.add(part(g.knuckle, joint, [0, 0, 0], [1, 1, 1], [0, 0, 0], 0));
    hinge.add(part(g.upper, chrome, [0, -0.045, 0.014], [1, 1, 1], [-0.3, 0, 0], 1.12));
    hinge.add(part(g.elbow, joint, [0, -0.085, 0.026], [1, 1, 1], [0, 0, 0], 0));
    hinge.add(part(g.lower, chrome, [0, -0.118, 0.014], [1, 1, 1], [0.42, 0, 0], 1.12));
    const tip = part(g.tip, chrome, [0, -0.152, -0.002], [1, 1, 1], [Math.PI + 0.5, 0, 0], 1.1);
    hinge.add(tip); hinges.push(hinge); tips.push(tip);
  }
  const grip = new THREE.Object3D(); grip.position.set(0, -0.15, 0); hang.add(grip);
  root.traverse((o) => { o.castShadow = false; });
  const rig: ClawRig = {
    root, swing, grip, tips,
    setOpen(t) { for (const h of hinges) h.rotation.x = -(0.04 + 0.62 * Math.min(Math.max(t, 0), 1)); },
    setCable(length) { swing.position.y = length; hang.position.y = -length; cable.scale.y = Math.max(length, 0.001); },
  };
  rig.setOpen(0.35); rig.setCable(CABLE_TOP);
  return rig;
}

// 쉬는 집게: 살짝 벌린 같은 모양을 크롬 한 덩어리로 (기계 35대가 그리기 호출 하나씩)
export const idleClawGeometry = once(() => {
  const rig = makeClawRig();
  rig.root.updateMatrixWorld(true);
  const geos: THREE.BufferGeometry[] = [];
  rig.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.material === outlineMat) return;
    const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
    for (const key of Object.keys(geo.attributes)) if (key !== 'position' && key !== 'normal') geo.deleteAttribute(key);
    geos.push(geo.index ? geo.toNonIndexed() : geo);
  });
  return mergeGeometries(geos)!;
});
