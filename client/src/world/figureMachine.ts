import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FIGURE, FIGURES, variantOf, type BoxKind, type FigureSpot } from '../data/figures';
import { clawShapeOf, type ClawShape } from '../physics/figureClaw';
import { barZ } from '../physics/figureWorld';
import { FIGURE_BOX, FIGURE_SIGN } from './copy';
import { machineAcryl, machinePopMat, machineSignMat, makeCabinetShell } from './machine';
import { canvasTex, part, toon, toonWith } from './toon';

// 피규어 기계 그림(9단계, 그래픽 설계 §3.5 모양 — 물리와 같은 치수, 설계 §8 큰 상자 두 종류): 인형 기계와 같은 몸통에 속만 다르다.
// 기계 폭을 가로지르는 쇠막대 두 개를 양옆 흰 기둥 죔쇠가 잡고, 막대 아래는 상자가 떨어지는 구멍('GET!' 바닥), 앞은 낮은 투명판(테두리 없음),
// 뒤는 받침 막대와 테두리 있는 투명 벽, 그 뒤 진열대에 같은 랜덤 상자를 세워 둔다. 상자 그림은 모두 같다(겉으로 캐릭터를 알 수 없게, 설계 §4)
const FONT = '"Jua", "Apple SD Gothic Neo", -apple-system, sans-serif';
const FLOOR_Y = 0.86, FRONT_TOP = 0.07, WALL_TOP = 0.3; // 앞판·뒤 벽 윗변(막대 위, 물리 figureWorld와 같음)
const once = <T>(make: () => T) => { let v: T | undefined; return () => (v ??= make()); };
type V3 = [number, number, number];
const flat = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, rot: V3 = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.rotation.set(...rot); return m;
};

// 랜덤 상자 그림 한 장(512×512): 왼쪽은 앞면 그림(물음표·'toycrane 피규어 컬렉션') — 긴 상자는 세로로 긴 칸(256×512, 세우면 바로 서고
// 눕히면 그림 위쪽이 상자 끝을 향한다), 정사각형 상자는 정사각 칸(256×256, 위). 오른쪽 위는 옆면(남색·로고), 오른쪽 아래는 끝면(별)
const boxTex = (kind: BoxKind) => canvasTex(512, 512, (g) => {
  const fh = kind === 'square' ? 256 : 512, front = g.createLinearGradient(0, 0, 256, fh);
  front.addColorStop(0, '#c9b6ff'); front.addColorStop(1, '#ffb8d9');
  g.fillStyle = front; g.fillRect(0, 0, 256, 512);
  g.fillStyle = 'rgba(255,255,255,.35)';
  for (let k = 0; k < fh / 64; k++) { g.beginPath(); g.arc(28 + (k % 2) * 200, 40 + k * 60, 14, 0, Math.PI * 2); g.fill(); }
  const cy = kind === 'square' ? 104 : 210, r = kind === 'square' ? 64 : 86;
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(128, cy, r, 0, Math.PI * 2); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${kind === 'square' ? 96 : 130}px ${FONT}`; g.fillStyle = '#7c4ff0'; g.fillText('?', 128, cy + 8);
  g.fillStyle = '#2c2470'; let size = kind === 'square' ? 24 : 30;
  do { g.font = `${size}px ${FONT}`; size -= 2; } while (g.measureText(FIGURE_BOX).width > 236 && size > 10);
  g.fillText(FIGURE_BOX, 128, kind === 'square' ? 218 : 410);
  g.fillStyle = '#2c2470'; g.fillRect(256, 0, 256, 256);
  g.font = `44px ${FONT}`; g.fillStyle = '#ffe14d'; g.fillText('toycrane', 384, 128);
  g.fillStyle = '#3a2f8a'; g.fillRect(256, 256, 256, 256);
  g.font = `110px ${FONT}`; g.fillText('★', 384, 390);
});
const boxMats = new Map<BoxKind, THREE.Material>();
export const blindBoxMat = (kind: BoxKind = 'long'): THREE.Material => { // 고리 걸기 상자도 같은 그림
  let m = boxMats.get(kind);
  if (!m) boxMats.set(kind, (m = toonWith({ map: boxTex(kind) })));
  return m;
};

// 상자 도형(물리와 같은 치수, 그림 면이 위): BoxGeometry 면 순서 +x, −x, +y, −y, +z, −z — 윗면 앞면 그림, 옆면·밑면 로고, 끝면 별.
// 칸(u0, u1, v0, v1)은 그림 아래가 v 0. 종류마다 하나
const boxGeos = new Map<BoxKind, THREE.BufferGeometry>();
export const blindBoxGeo = (kind: BoxKind = 'long'): THREE.BufferGeometry => {
  const cached = boxGeos.get(kind);
  if (cached) return cached;
  const { w, d, h } = variantOf(kind).box, geo = new THREE.BoxGeometry(w, d, h), uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const FRONT = kind === 'square' ? [0, 0.5, 0.5, 1] : [0, 0.5, 0, 1], SIDE = [0.5, 1, 0.5, 1], END = [0.5, 1, 0, 0.5];
  const region = [SIDE, SIDE, FRONT, SIDE, END, END];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k, [u0, u1, v0, v1] = region[f];
    uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  }
  boxGeos.set(kind, geo);
  return geo;
};

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
export const getMat = once(() => new THREE.MeshBasicMaterial({ map: getTex() }));
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
  pane: new THREE.BoxGeometry(FIGURE.bars.half_len * 2, 1, 0.008), // 앞판·뒤 벽(높이는 scale)
  edge: new THREE.BoxGeometry(1, 1, 0.012), // 뒤 벽 테두리
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
  const kind = spot.box, { box } = variantOf(kind), { y, half_len } = FIGURE.bars, { front, back_bar, back_wall } = FIGURE.guards;
  const bz = barZ(kind), white = toon(0xfafafc), floorMat = toon(0xffeef6);
  // 쇠막대: 앞·뒤 막대(사이가 GET 구멍)와 뒤 받침 막대(옅은 회색) — 양옆 흰 기둥(바닥에서 막대까지)과 죔쇠
  for (const [z, color] of [[bz, 0xe9c3d6], [-bz, 0xe9c3d6], [-(bz + back_bar), 0xd9dbe3]] as const) {
    add(part(g.bar, toon(color), [0, y, z], [1, 1, 1], [0, 0, 0], 1.25));
    for (const sx of [-1, 1]) {
      add(part(g.post, white, [sx * (half_len + 0.006), (FLOOR_Y + y) / 2, z], [1, y - FLOOR_Y, 1], [0, 0, 0], 1.08));
      add(part(g.clamp, white, [sx * (half_len - 0.02), y, z], [1, 1, 1], [0, 0, 0], 1.06));
    }
  }
  // 막대 밖 바닥판(막대 사이는 상자가 떨어지는 구멍)
  for (const side of [-1, 1]) {
    const edge = bz + 0.01, len = 0.49 - edge;
    add(part(g.floor, floorMat, [0, FLOOR_Y, side * (edge + len / 2)], [1, 1, len], [0, 0, 0], 0));
  }
  // 앞판: 앞 막대 바로 앞 낮은 투명판(테두리 없음 — 막대처럼 보이지 않게). 뒤 벽: 받침 막대 뒤 투명판 + 흰 테두리(앞뒤가 막힌 줄 보이게)
  add(flat(g.pane, machineAcryl(), [0, y + FRONT_TOP / 2 - 0.015, bz + front])).scale.y = FRONT_TOP + 0.03;
  const wz = -(bz + back_wall), wy = y + WALL_TOP / 2 - 0.015, wh = WALL_TOP + 0.03, ww = half_len * 2;
  add(flat(g.pane, machineAcryl(), [0, wy, wz])).scale.y = wh;
  for (const [dx, dy, sx, sy] of [[0, wh / 2, ww, 0.012], [0, -wh / 2, ww, 0.012], [ww / 2, 0, 0.012, wh], [-ww / 2, 0, 0.012, wh]]) {
    add(part(g.edge, white, [dx, wy + dy, wz], [sx, sy, 1], [0, 0, 0], 1.08));
  }
  // 구멍 아래 'GET!' 바닥(상자가 빠지면 여기로)
  add(flat(g.get, getMat(), [0, FLOOR_Y - 0.005, 0], [-Math.PI / 2, 0, 0])).scale.set(1, 2 * bz, 1); // 몸통 윗면 바로 위(상자는 몸통 속으로 빠진다)
  // 뒤 벽 뒤 진열대: 같은 랜덤 상자를 세워 둔다(실제 기계의 재고 진열). 2단, 단마다 3개(사용자 2026-11-02) — 위 단은 아래 상자 위 얇은 선반
  add(part(g.tier, floorMat, [0, FLOOR_Y + 0.08, -0.43], [1, 0.16, 1], [0, 0, 0], 1.03));
  const shelfY = FLOOR_Y + 0.16 + box.h + 0.01;
  add(part(g.tier, floorMat, [0, shelfY, -0.43], [1, 0.02, 1], [0, 0, 0], 1.03));
  for (const [y0, twist] of [[FLOOR_Y + 0.16, 0.04], [shelfY + 0.01, -0.03]] as const) {
    [-0.3, 0, 0.3].forEach((x, k) => {
      const b = new THREE.Mesh(blindBoxGeo(kind), blindBoxMat(kind));
      b.name = 'figure-display';
      b.position.set(x, y0 + box.h / 2, -0.44); b.rotation.set(Math.PI / 2, 0, (k - 1) * twist); // 상자를 세우고 그림 면(+y)이 앞(+z)으로
      m.add(b);
    });
  }
  m.traverse((o) => { o.castShadow = false; });
  return { statics: m, ledGeo };
}

// 집게 그림 도형(물리 figureClaw와 같은 모양, 경첩 기준): 각진 머리·검은·빨간 띠·앞 스티커, 판 팔(바깥 → 아래 → 끝이 안쪽 갈고리)
const clawGeoCache = new Map<BoxKind, ReturnType<typeof clawGeosOf>>();
export const clawGeos = (kind: BoxKind = 'long') => {
  let g = clawGeoCache.get(kind);
  if (!g) clawGeoCache.set(kind, (g = clawGeosOf(clawShapeOf(kind))));
  return g;
};
export function clawGeosOf(shape: ClawShape) {
  const { head: H, elbow, tip, plateT, plateW, tipR } = shape;
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
}

const stickerTex = (text: string) => canvasTex(128, 56, (g) => {
  g.fillStyle = '#ffe14d'; g.fillRect(0, 0, 128, 56);
  g.fillStyle = '#2a2a32'; g.font = `30px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 30);
});
// 집게 재질 — 머리는 진한 파랑, 팔은 진한 분홍, 둘 다 불투명: 연한 반투명 팔·흰 머리는 휴대폰에서 흰 선반·파스텔 상자에 묻혀 안 보였다(사용자 2026-11-02, 사진 202).
// 앞 스티커 글씨는 기계마다('피규어'·'고리')
const clawMatsCache = new Map<string, ReturnType<typeof makeClawMats>>();
const makeClawMats = (text: string) => {
  const sticker = new THREE.MeshBasicMaterial({ map: stickerTex(text) });
  sticker.userData.text = text;
  return { head: toon(0x2f7cf6), black: toon(0x2a2a32), red: toon(0xe8384f), sticker, arm: toon(0xff3b8f), cable: toon(0x3b3445) };
};
export const clawMats = (text = '피규어') => clawMatsCache.get(text) ?? clawMatsCache.set(text, makeClawMats(text)).get(text)!;
