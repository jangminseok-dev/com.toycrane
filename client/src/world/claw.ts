import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { outlineMat, part } from './toon';

// 크레인 집게: 위(매달린 곳)에서 줄이 내려오고, 크롬 몸통·덮개·고리에 경첩 달린 손가락 3개(윗마디·아랫마디·안으로 굽은 끝).
// 움직이는 집게(ClawRig)는 누가 하는 기계에만 빌려 주고, 쉬는 기계는 같은 모양을 한 덩어리로 합친 도형을 쓴다
const once = <T>(make: () => T) => { let v: T | undefined; return () => (v ??= make()); };
export const CHROME = once(() => new THREE.MeshPhongMaterial({ color: 0xcfd4e2, specular: 0xffffff, shininess: 80 }));
const JOINT = once(() => new THREE.MeshPhongMaterial({ color: 0x8a90a6, specular: 0xffffff, shininess: 60 }));
export const CABLE_TOP = 0.05; // 쉬는 자리에서 몸통 위로 줄이 이만큼 (기계 안 높이 2.0이 매달린 곳)
// 손가락 모양(경첩 기준, 바깥 = +z, 아래 = -y, m): 옆으로 나가 머리 둘레 밖으로 → 곧게 아래로 → 목 쪽으로 안으로 굽는다.
// 경첩 각 0(HUG)이 서 있는 인형 머리를 조금 띄워 감싸는 모양이고, 집게는 닿을 때까지만 오므린다 (설계 2026-10-31 §3.6)
const HINGE_R = 0.034, HINGE_Y = -0.045, HUB_BOTTOM = -0.08;
const FINGER: [number, number][] = [[0, 0], [0.09, -0.045], [0.095, -0.18], [0.038, -0.24]];
const OPEN_MIN = -0.3, OPEN_MAX = 0.38; // 경첩 각(바깥이 +): 다 오므림 ~ 활짝

const G = once(() => ({
  cable: new THREE.CylinderGeometry(0.006, 0.006, 1, 6).translate(0, -0.5, 0), // 위 0에서 아래 -1까지
  cap: new THREE.SphereGeometry(0.05, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  body: new THREE.CylinderGeometry(0.05, 0.044, 0.04, 20),
  collar: new THREE.TorusGeometry(0.046, 0.009, 8, 24).rotateX(Math.PI / 2),
  hub: new THREE.CylinderGeometry(0.024, 0.024, 0.04, 16), // 가는 허브: 귀 사이로 머리 위에 얹힌다
  knuckle: new THREE.SphereGeometry(0.012, 10, 8),
  tip: new THREE.SphereGeometry(0.012, 12, 8),
  segs: FINGER.slice(1).map(([z, y], n) => {
    const [z0, y0] = FINGER[n];
    return new THREE.CapsuleGeometry(n === 2 ? 0.0075 : 0.0085, Math.hypot(z - z0, y - y0), 4, 8);
  }),
}));
const PINK = once(() => new THREE.MeshPhongMaterial({ color: 0xff4f9a, specular: 0xffffff, shininess: 50 }));

export type ClawRig = {
  root: THREE.Group; // 몸통 원점 (기계의 집게 자리에 붙는다)
  swing: THREE.Group; // 매달린 곳을 중심으로 흔들리는 부분
  grip: THREE.Object3D; // 손가락 끝 가운데 — 잡은 인형을 여기에 매단다
  tips: THREE.Object3D[];
  probes: THREE.Object3D[]; // 닿는지 재는 표본점: [0]은 허브 바닥 가운데, 허브 가장자리, 칼라 둘레, 손가락 마디마다
  fingerProbes: THREE.Object3D[]; // 그중 손가락 위 점들
  HUG: number; // 경첩 각이 0이 되는 setOpen 값 (머리를 감싸는 기준 자세)
  setOpen(t: number): void; // 0 오므림 ~ 1 활짝
  openness(): number;
  setCable(length: number): void; // 매달린 곳에서 몸통까지 줄 길이
};

export function makeClawRig(): ClawRig {
  const g = G(), chrome = CHROME(), joint = JOINT(), pink = PINK();
  const root = new THREE.Group(), swing = new THREE.Group(), hang = new THREE.Group();
  root.add(swing); swing.add(hang);
  const cable = new THREE.Mesh(g.cable, joint); swing.add(cable);
  hang.add(part(g.cap, chrome, [0, 0, 0], [1, 0.7, 1], [0, 0, 0], 1.06));
  hang.add(part(g.body, chrome, [0, -0.02, 0], [1, 1, 1], [0, 0, 0], 1.05));
  hang.add(part(g.collar, pink, [0, -0.04, 0], [1, 1, 1], [0, 0, 0], 0));
  hang.add(part(g.hub, chrome, [0, HUB_BOTTOM + 0.02, 0], [1, 1, 1], [0, 0, 0], 1.08));
  const probes: THREE.Object3D[] = [], fingerProbes: THREE.Object3D[] = [];
  const probe = (parent: THREE.Object3D, x: number, y: number, z: number, list: THREE.Object3D[][]) => {
    const p = new THREE.Object3D(); p.position.set(x, y, z); parent.add(p); for (const l of list) l.push(p);
  };
  probe(hang, 0, HUB_BOTTOM, 0, [probes]);
  for (let k = 0; k < 4; k++) probe(hang, Math.cos((k * Math.PI) / 2) * 0.024, HUB_BOTTOM, Math.sin((k * Math.PI) / 2) * 0.024, [probes]);
  for (let k = 0; k < 6; k++) probe(hang, Math.cos((k * Math.PI) / 3) * 0.05, -0.04, Math.sin((k * Math.PI) / 3) * 0.05, [probes]);
  const hinges: THREE.Group[] = [], tips: THREE.Object3D[] = [];
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Group(); arm.rotation.y = (i / 3) * Math.PI * 2; hang.add(arm); // 손가락 방향(+z가 바깥)
    const hinge = new THREE.Group(); hinge.position.set(0, HINGE_Y, HINGE_R); arm.add(hinge);
    hinge.add(part(g.knuckle, joint, [0, 0, 0], [1, 1, 1], [0, 0, 0], 0));
    for (let n = 0; n < 3; n++) {
      const [z0, y0] = FINGER[n], [z1, y1] = FINGER[n + 1];
      // 캡슐은 +y로 서 있다 — x축으로 돌려 아래 끝이 (z1, y1) 쪽을 보게
      hinge.add(part(g.segs[n], chrome, [0, (y0 + y1) / 2, (z0 + z1) / 2], [1, 1, 1], [-Math.atan2(z1 - z0, y0 - y1), 0, 0], 1.12));
      if (n < 2) hinge.add(part(g.knuckle, joint, [0, y1, z1], [1, 1, 1], [0, 0, 0], 0));
      for (const f of [0.25, 0.5, 0.75, 1]) probe(hinge, 0, y0 + (y1 - y0) * f, z0 + (z1 - z0) * f, [probes, fingerProbes]);
    }
    const [tz, ty] = FINGER[3];
    const tip = part(g.tip, pink, [0, ty, tz], [1, 0.75, 1.3], [0, 0, 0], 1.1);
    hinge.add(tip); hinges.push(hinge); tips.push(tip);
  }
  const grip = new THREE.Object3D(); grip.position.set(0, -0.2, 0); hang.add(grip);
  root.traverse((o) => { o.castShadow = false; });
  let open = 0.35;
  const rig: ClawRig = {
    root, swing, grip, tips, probes, fingerProbes,
    HUG: -OPEN_MIN / (OPEN_MAX - OPEN_MIN),
    setOpen(t) {
      open = Math.min(Math.max(t, 0), 1);
      for (const h of hinges) h.rotation.x = -(OPEN_MIN + (OPEN_MAX - OPEN_MIN) * open);
    },
    openness: () => open,
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
