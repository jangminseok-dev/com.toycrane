import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { figureCameraPose } from '../game/figureCamera';
import { CLAW_SHAPE } from '../physics/figureClaw';
import { FIGURE_SIGN } from '../world/copy';
import { blindBoxMat, clawGeos, clawMats } from '../world/figureMachine';
import { machineAcryl, machinePopMat, machineSignMat, makeCabinetShell } from '../world/machine';
import { canvasTex, part, toon } from '../world/toon';

// 피규어 기계 개정 시제품(개발 전용, 2026-11-02 사용자 영상 두 개): 큰 상자가 두 막대에 걸치고, 뒤는 받침 막대 + 투명 벽, 앞은 투명 가림판으로 막혀
// 두 막대 사이(GET)로만 빠진다. ?box=long(긴 상자 17×12×34cm)|square(넓은 정사각형 26×26×13cm) &view=front|side &claw=rest|low
const q = new URLSearchParams(location.search), kind = q.get('box') ?? 'long', view = q.get('view') ?? 'front';
const V = kind === 'square'
  ? { w: 0.26, d: 0.13, h: 0.26, gap: 0.2, color: 0x2f7cf6 }
  : { w: 0.17, d: 0.12, h: 0.34, gap: 0.255, color: 0x8b5cf6 };
const BAR_Y = 0.98, R = 0.014, HALF = 0.43, FLOOR_Y = 0.86, BZ = V.gap / 2 + R, CLAW_SCALE = 1.5;
const BACK_BAR = BZ + 0.09, BACK_WALL = BZ + 0.17, FRONT_GUARD = BZ + 0.06;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf4f1f7);
scene.add(new THREE.HemisphereLight(0xffffff, 0xeee6f2, 1.25));
const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(3, 14, 5); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshToonMaterial({ color: 0xeeeaf2 }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);

const m = new THREE.Group(); scene.add(m);
makeCabinetShell(m, V.color, { sign: machineSignMat(FIGURE_SIGN, V.color), plate: new THREE.MeshBasicMaterial({ color: 0xffffff }), pop: machinePopMat(4) });
const white = toon(0xfafafc), floorMat = toon(0xffeef6), barMat = toon(0xe9c3d6), supportMat = toon(0xd9dbe3);
const bar = new THREE.CylinderGeometry(R, R, HALF * 2, 20).rotateZ(Math.PI / 2);
const post = new RoundedBoxGeometry(0.032, 1, 0.032, 1, 0.008), clamp = new RoundedBoxGeometry(0.05, 0.052, 0.055, 1, 0.012);
const plate = (w: number, h: number, z: number, y: number) => { const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.008), machineAcryl()); p.position.set(0, y, z); m.add(p); };
const frame = (w: number, h: number, z: number, y: number) => { // 투명판 테두리(막힌 것이 보이게)
  for (const [dx, dy, sx, sy] of [[0, h / 2, w, 0.012], [0, -h / 2, w, 0.012], [w / 2, 0, 0.012, h], [-w / 2, 0, 0.012, h]]) m.add(part(new THREE.BoxGeometry(sx, sy, 0.012), white, [dx, y + dy, z], [1, 1, 1], [0, 0, 0], 1.08));
};
// 큰 막대 두 개(그 사이가 GET 구멍) + 뒤 받침 막대 + 기둥·죔쇠
for (const [z, mat] of [[BZ, barMat], [-BZ, barMat], [-BACK_BAR, supportMat]] as const) {
  m.add(part(bar, mat, [0, BAR_Y, z], [1, 1, 1], [0, 0, 0], 1.2));
  for (const sx of [-1, 1]) {
    m.add(part(post, white, [sx * (HALF + 0.006), (FLOOR_Y + BAR_Y) / 2, z], [1, BAR_Y - FLOOR_Y, 1], [0, 0, 0], 1.08));
    m.add(part(clamp, white, [sx * (HALF - 0.02), BAR_Y, z], [1, 1, 1], [0, 0, 0], 1.06));
  }
}
// 막대 밖 바닥판, 구멍 아래 GET 바닥
for (const side of [-1, 1]) { const edge = BZ + 0.01, len = 0.49 - edge; m.add(part(new THREE.BoxGeometry(1.12, 0.02, len), floorMat, [0, FLOOR_Y, side * (edge + len / 2)], [1, 1, 1], [0, 0, 0], 0)); }
const getTex = canvasTex(512, 256, (g) => {
  g.fillStyle = '#ffe3f0'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#ffc2dc';
  for (let k = -256; k < 512; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 32, 0); g.lineTo(k + 288, 256); g.lineTo(k + 256, 256); g.fill(); }
  g.font = '120px "Jua", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 18; g.strokeStyle = '#fff'; g.strokeText('GET!', 256, 132); g.fillStyle = '#ff4f9a'; g.fillText('GET!', 256, 132);
});
const get = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 2 * BZ), new THREE.MeshBasicMaterial({ map: getTex })); get.rotation.x = -Math.PI / 2; get.position.y = FLOOR_Y - 0.005; m.add(get);
// 뒤 투명 벽(받침 막대 뒤, 높게) · 앞 투명 가림판(앞 막대 바로 앞, 낮게) — 테두리가 보여 앞뒤가 막힌 줄 안다
plate(HALF * 2, 0.3, -BACK_WALL, BAR_Y + 0.12); frame(HALF * 2, 0.3, -BACK_WALL, BAR_Y + 0.12);
plate(HALF * 2, 0.1, FRONT_GUARD, BAR_Y + 0.03); // 앞은 테두리 없이(막대처럼 보이지 않게)

// 상자(그림 면이 위) — 긴 상자는 긴 변이 막대를 가로질러(앞뒤로), 정사각형은 그대로
function boxGeo(w: number, d: number, h: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, d, h), uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const face = w / h, FRONT = [0, 0.5, 0.5 - 0.5 * Math.min(1, 0.5 / face) , 0.5 + 0.5 * Math.min(1, 0.5 / face)], SIDE = [0.5, 1, 0.5, 1], END = [0.5, 1, 0, 0.5];
  const region = [SIDE, SIDE, FRONT, SIDE, END, END];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k, [u0, u1, v0, v1] = region[f]; uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); }
  return geo;
}
const box = new THREE.Mesh(boxGeo(V.w, V.d, V.h), blindBoxMat());
box.position.set(0.01, BAR_Y + R + V.d / 2, -0.01); box.rotation.y = 0.08; m.add(box);
// 뒤 진열대 위 큰 상자 재고(세움)
const tier = new RoundedBoxGeometry(1.0, 1, 0.14, 1, 0.012);
m.add(part(tier, floorMat, [0, FLOOR_Y + 0.08, -0.43], [1, 0.16, 1], [0, 0, 0], 1.03));
for (const [k, x] of [-0.3, 0, 0.3].entries()) { const b = new THREE.Mesh(boxGeo(V.w, V.d, V.h), blindBoxMat()); b.position.set(x, FLOOR_Y + 0.16 + V.h / 2, -0.44); b.rotation.set(Math.PI / 2, 0, (k - 1) * 0.04); m.add(b); }

// 집게(지금 모양 그대로 1.5배 — 큰 상자 모서리를 누르고 걸 수 있게)
const geos = clawGeos(), mats = clawMats(), claw = new THREE.Group();
for (const k of ['head', 'black', 'red', 'sticker'] as const) claw.add(new THREE.Mesh(geos[k], mats[k]));
const open = 0.6, ang = -CLAW_SHAPE.close + open * (CLAW_SHAPE.open + CLAW_SHAPE.close);
const armR = new THREE.Mesh(geos.armR, mats.arm); armR.position.set(CLAW_SHAPE.hinge[0], CLAW_SHAPE.hinge[1], 0); armR.rotation.z = ang; claw.add(armR);
const armL = new THREE.Mesh(geos.armL, mats.arm); armL.position.set(-CLAW_SHAPE.hinge[0], CLAW_SHAPE.hinge[1], 0); armL.rotation.z = -ang; claw.add(armL);
claw.scale.setScalar(CLAW_SCALE);
const clawY = q.get('claw') === 'rest' ? 1.9 : BAR_Y + V.d + 0.29;
claw.position.set(0.04, clawY, 0.0); m.add(claw);
const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 6).translate(0, 0.5, 0), mats.cable);
cable.position.set(0.04, clawY + CLAW_SHAPE.head.hy * CLAW_SCALE, 0); cable.scale.y = Math.max(0.01, 1.96 - cable.position.y); m.add(cable);

const camera = new THREE.PerspectiveCamera(innerWidth < innerHeight ? 60 : 45, innerWidth / innerHeight, 0.05, 100);
const pose = figureCameraPose({ id: 'v2', x: 0, z: 0, ry: 0, row: 'f1' }, view === 'side' ? 1 : 0, camera.aspect);
camera.position.copy(pose.pos); camera.lookAt(pose.look);
renderer.setAnimationLoop(() => renderer.render(scene, camera));
Object.assign(window, { __ready: true });
