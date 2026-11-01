import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FIGURE, FIGURES, type FigureSpot } from '../data/figures';
import { CLAW_SHAPE } from '../physics/figureClaw';
import { barZ } from '../physics/figureWorld';
import { FIGURE_BOX, FIGURE_SIGN } from './copy';
import { machineAcryl, machinePopMat, machineSignMat, makeCabinetShell } from './machine';
import { canvasTex, part, toon, toonWith } from './toon';

// 피규어 기계 그림(9단계, 그래픽 설계 §3.5 모양 — 물리와 같은 치수): 인형 기계와 같은 몸통에 속만 다르다.
// 기계 폭을 가로지르는 쇠막대 두 개를 양옆 흰 기둥 죔쇠가 잡고, 막대 아래는 상자가 떨어지는 구멍('GET!' 바닥), 앞뒤로 낮은 투명 멈춤판,
// 뒤쪽 계단 진열대에 같은 랜덤 상자를 세워 쌓는다. 상자 그림은 모두 같다(겉으로 캐릭터를 알 수 없게, 설계 §4)
const FONT = '"Jua", "Apple SD Gothic Neo", -apple-system, sans-serif';
const FLOOR_Y = 0.86, STOP_OUT = 0.13, STOP_TOP = 0.06, STOP_DEPTH = 0.15;
const once = <T>(make: () => T) => { let v: T | undefined; return () => (v ??= make()); };
type V3 = [number, number, number];
const flat = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, rot: V3 = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.rotation.set(...rot); return m;
};

// 랜덤 상자 그림 한 장(512×512): 왼쪽 반(256×512)은 앞면 그림(물음표·'toycrane 피규어 컬렉션', 세로로 긴 상자 앞면 — 세우면 바로 서고
// 눕히면 그림 위쪽이 상자 끝을 향한다), 오른쪽 위는 긴 옆면(남색·로고), 오른쪽 아래는 끝면(별)
const boxTex = once(() => canvasTex(512, 512, (g) => {
  const front = g.createLinearGradient(0, 0, 256, 512);
  front.addColorStop(0, '#c9b6ff'); front.addColorStop(1, '#ffb8d9');
  g.fillStyle = front; g.fillRect(0, 0, 256, 512);
  g.fillStyle = 'rgba(255,255,255,.35)';
  for (let k = 0; k < 8; k++) { g.beginPath(); g.arc(28 + (k % 2) * 200, 40 + k * 60, 14, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(128, 210, 86, 0, Math.PI * 2); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `130px ${FONT}`; g.fillStyle = '#7c4ff0'; g.fillText('?', 128, 218);
  g.fillStyle = '#2c2470'; let size = 30;
  do { g.font = `${size}px ${FONT}`; size -= 2; } while (g.measureText(FIGURE_BOX).width > 236 && size > 10);
  g.fillText(FIGURE_BOX, 128, 410);
  g.fillStyle = '#2c2470'; g.fillRect(256, 0, 256, 256);
  g.font = `44px ${FONT}`; g.fillStyle = '#ffe14d'; g.fillText('toycrane', 384, 128);
  g.fillStyle = '#3a2f8a'; g.fillRect(256, 256, 256, 256);
  g.font = `110px ${FONT}`; g.fillText('★', 384, 390);
}));
export const blindBoxMat = once(() => toonWith({ map: boxTex() }));

// 상자 도형(물리와 같은 치수, 그림 면이 위): BoxGeometry 면 순서 +x, −x, +y, −y, +z, −z — 윗면 앞면 그림, 옆면·밑면 로고, 끝면 별.
// 칸(u0, u1, v0, v1)은 그림 아래가 v 0
export const blindBoxGeo = once(() => {
  const { w, d, h } = FIGURE.box, geo = new THREE.BoxGeometry(w, d, h), uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const FRONT = [0, 0.5, 0, 1], SIDE = [0.5, 1, 0.5, 1], END = [0.5, 1, 0, 0.5];
  const region = [SIDE, SIDE, FRONT, SIDE, END, END];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k, [u0, u1, v0, v1] = region[f];
    uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  }
  return geo;
});

const getTex = once(() => canvasTex(512, 256, (g) => {
  g.fillStyle = '#ffe3f0'; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#ffc2dc';
  for (let k = -256; k < 512; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 32, 0); g.lineTo(k + 32 + 256, 256); g.lineTo(k + 256, 256); g.fill(); }
  g.font = `120px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = 18; g.strokeStyle = '#ffffff'; g.strokeText('GET!', 256, 132); g.fillStyle = '#ff4f9a'; g.fillText('GET!', 256, 132);
}));

// 번호판 F-1~F-14를 한 장에(가로 2 × 세로 7, 칸마다 256×64) — 기계마다 다른 그림이 그리기 호출을 늘리지 않게
const plateTex = once(() => canvasTex(512, 448, (g) => {
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `44px ${FONT}`;
  FIGURES.forEach((f, i) => {
    const x = (i % 2) * 256, y = Math.floor(i / 2) * 64;
    g.fillStyle = '#ffffff'; g.fillRect(x, y, 256, 64);
    g.fillStyle = '#2c2470'; g.fillText(f.id, x + 128, y + 34);
  });
}));
export const plateAtlasMat = once(() => new THREE.MeshBasicMaterial({ map: plateTex() }));
const getMat = once(() => new THREE.MeshBasicMaterial({ map: getTex() }));
function plateCell(geo: THREE.BufferGeometry, i: number): THREE.BufferGeometry {
  const g = geo.clone(), uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const u0 = (i % 2) / 2, v0 = 1 - (Math.floor(i / 2) + 1) / 7;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) / 2, v0 + uv.getY(k) / 7);
  return g;
}

const G = once(() => ({
  bar: new THREE.CylinderGeometry(FIGURE.bars.radius, FIGURE.bars.radius, FIGURE.bars.half_len * 2, 20).rotateZ(Math.PI / 2),
  post: new RoundedBoxGeometry(0.032, 1, 0.032, 1, 0.008),
  clamp: new RoundedBoxGeometry(0.05, 0.052, 0.055, 1, 0.012),
  floor: new THREE.BoxGeometry(1.12, 0.02, 1),
  get: new THREE.PlaneGeometry(FIGURE.bars.half_len * 2, 1),
  stopper: new THREE.BoxGeometry(FIGURE.bars.half_len * 2, STOP_DEPTH, 0.008),
  tier: new RoundedBoxGeometry(1.0, 1, 0.14, 1, 0.012),
}));

// 한 대: 몸통(줄 색) + 속. LED 도형은 따로 돌려준다(줄마다 한 덩어리)
export function makeFigureMachineParts(spot: FigureSpot, index: number, color: number): { statics: THREE.Group; ledGeo: THREE.BufferGeometry } {
  const g = G(), m = new THREE.Group();
  m.position.set(spot.x, 0, spot.z); m.rotation.y = spot.ry;
  const ledGeo = makeCabinetShell(m, color, { sign: machineSignMat(FIGURE_SIGN, color), plate: plateAtlasMat(), pop: machinePopMat(4) });
  const plate = m.getObjectByName('plate') as THREE.Mesh;
  plate.geometry = plateCell(plate.geometry, index);
  const add = (o: THREE.Object3D) => { m.add(o); return o; };
  const { y, half_len } = FIGURE.bars, bz = barZ(), white = toon(0xfafafc), floorMat = toon(0xffeef6);
  // 쇠막대 두 개 + 양옆 흰 기둥(바닥에서 막대까지) + 죔쇠
  for (const side of [-1, 1]) {
    const z = side * bz;
    add(part(g.bar, toon(0xe9c3d6), [0, y, z], [1, 1, 1], [0, 0, 0], 1.25));
    for (const sx of [-1, 1]) {
      add(part(g.post, white, [sx * (half_len + 0.006), (FLOOR_Y + y) / 2, z], [1, y - FLOOR_Y, 1], [0, 0, 0], 1.08));
      add(part(g.clamp, white, [sx * (half_len - 0.02), y, z], [1, 1, 1], [0, 0, 0], 1.06));
    }
    // 막대 밖 바닥판(막대 사이는 상자가 떨어지는 구멍) + 낮은 투명 멈춤판
    const edge = bz + 0.01, len = 0.49 - edge;
    add(part(g.floor, floorMat, [0, FLOOR_Y, side * (edge + len / 2)], [1, 1, len], [0, 0, 0], 0));
    add(flat(g.stopper, machineAcryl(), [0, y + STOP_TOP - STOP_DEPTH / 2, side * (bz + STOP_OUT)]));
  }
  // 구멍 아래 'GET!' 바닥(상자가 빠지면 여기로)
  add(flat(g.get, getMat(), [0, FLOOR_Y - 0.005, 0], [-Math.PI / 2, 0, 0])).scale.set(1, 2 * bz, 1); // 몸통 윗면 바로 위(상자는 몸통 속으로 빠진다)
  // 뒤쪽 계단 진열대: 같은 랜덤 상자를 세워 쌓았다(실제 기계의 재고 진열)
  add(part(g.tier, floorMat, [0, FLOOR_Y + 0.08, -0.36], [1, 0.16, 1], [0, 0, 0], 1.03));
  add(part(g.tier, floorMat, [0, FLOOR_Y + 0.16, -0.43], [1, 0.32, 0.6], [0, 0, 0], 1.03));
  const stand = (x: number, yb: number, z: number, turn: number) => {
    const b = new THREE.Mesh(blindBoxGeo(), blindBoxMat());
    b.position.set(x, yb + FIGURE.box.h / 2, z); b.rotation.set(Math.PI / 2, 0, turn); // 긴 변을 세우고 그림 면(+y)이 앞(+z)으로
    m.add(b);
  };
  [-0.33, -0.11, 0.11, 0.33].forEach((x, k) => stand(x, FLOOR_Y + 0.16, -0.34, ((k * 37) % 7 - 3) * 0.02));
  [-0.22, 0, 0.22].forEach((x, k) => stand(x, FLOOR_Y + 0.32, -0.43, ((k * 53) % 7 - 3) * 0.02));
  m.traverse((o) => { o.castShadow = false; });
  return { statics: m, ledGeo };
}

// 집게 그림 도형(물리 figureClaw와 같은 모양, 경첩 기준): 각진 흰 머리·검은·빨간 띠·앞 스티커, 반투명 판 팔(바깥 → 아래 → 끝이 안쪽 갈고리)
export const clawGeos = once(() => {
  const { head: H, elbow, tip, plateT, plateW, tipR } = CLAW_SHAPE;
  const arm = (side: number) => {
    const seg = (a: [number, number], b: [number, number]) => {
      const ax = side * a[0], bx = side * b[0], len = Math.hypot(bx - ax, b[1] - a[1]);
      return new THREE.BoxGeometry(len, plateT * 2, plateW * 2).rotateZ(Math.atan2(b[1] - a[1], bx - ax)).translate((ax + bx) / 2, (a[1] + b[1]) / 2, 0);
    };
    const ball = new THREE.SphereGeometry(tipR, 10, 8).translate(side * tip[0], tip[1], 0);
    return mergeGeometries([seg([0, 0], elbow), seg(elbow, tip), ball].map((x) => (x.index ? x.toNonIndexed() : x)))!;
  };
  return {
    head: new RoundedBoxGeometry(H.hx * 2, H.hy * 2, H.hz * 2, 1, 0.01),
    black: new THREE.BoxGeometry(H.hx * 2 + 0.002, 0.012, H.hz * 2 + 0.002).translate(0, H.hy * 0.45, 0),
    red: new THREE.BoxGeometry(H.hx * 2 + 0.004, 0.006, H.hz * 2 + 0.004).translate(0, H.hy * 0.05, 0),
    sticker: new THREE.PlaneGeometry(0.05, 0.022).translate(0, -H.hy * 0.4, H.hz + 0.002),
    armR: arm(1), armL: arm(-1),
    cable: new THREE.CylinderGeometry(0.004, 0.004, 1, 6).translate(0, 0.5, 0),
  };
});
const stickerTex = once(() => canvasTex(128, 56, (g) => {
  g.fillStyle = '#ffe14d'; g.fillRect(0, 0, 128, 56);
  g.fillStyle = '#2a2a32'; g.font = `30px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('피규어', 64, 30);
}));
export const clawMats = once(() => ({
  head: toon(0xfbfbfd), black: toon(0x2a2a32), red: toon(0xe8384f), sticker: new THREE.MeshBasicMaterial({ map: stickerTex() }),
  arm: toonWith({ color: 0xeaf2ff, transparent: true, opacity: 0.85 }), cable: toon(0x3b3445),
}));
