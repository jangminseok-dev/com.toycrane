import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HOOK, type RingSide } from '../data/hooks';
import { RINGS } from '../data/rings';
import type { BoxWire } from '../net/protocol';
import { flapPieces, gluedPiece, hingeOf, hookClawShape, type Piece } from '../physics/hookWorld';
import { HOOK_SIGN } from './copy';
import { blindBoxMat, clawGeosOf, getMat } from './figureMachine';
import { machineAcryl, machinePopMat, machineSignMat, makeCabinetShell } from './machine';
import { canvasTex, part, toon } from './toon';

// 고리 걸기 기계 그림(설계 2026-11-02 ring-hook §3, 사진 180·181·186): 피규어 기계와 같은 몸통에 속만 다르다 — 흰 육각 무늬 선반 위 세운 '?' 상자,
// 상자 윗면 가장자리에 형광 연두 고리 판(밖으로 접히는 날개에 네모 구멍), 선반 앞 끝 아래 'GET!' 출구, 낮은 앞 투명판, 투명 옆·뒤 벽, 뒤에 진열 상자.
// 치수는 물리(hookWorld)와 같다
const FONT = '"Jua", "Apple SD Gothic Neo", -apple-system, sans-serif';
const FLOOR_Y = 0.86;
const once = <T>(make: () => T) => { let v: T | undefined; return () => (v ??= make()); };

// 육각 무늬 선반(사진 180의 검은 육각 판을 밝은 가게 결로)
const hexTex = once(() => canvasTex(256, 256, (g) => {
  g.fillStyle = '#f4f2fa'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#c9c3dc'; g.lineWidth = 3;
  const r = 22, w = r * Math.sqrt(3);
  for (let row = -1; row < 8; row++) for (let col = -1; col < 8; col++) {
    const cx = col * w + (row % 2 ? w / 2 : 0), cy = row * r * 1.5;
    g.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    g.closePath(); g.stroke();
  }
}, [2, 2]));
// 번호판 R-1~R-10 한 장(가로 2 × 세로 5, 칸 256×64)
const plateTex = once(() => canvasTex(512, 320, (g) => {
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `44px ${FONT}`;
  RINGS.forEach((r, i) => {
    const x = (i % 2) * 256, y = Math.floor(i / 2) * 64;
    g.fillStyle = '#ffffff'; g.fillRect(x, y, 256, 64); g.fillStyle = '#2c2470'; g.fillText(r.id, x + 128, y + 34);
  });
}));
const plateMat = once(() => new THREE.MeshBasicMaterial({ map: plateTex() }));
export const ringMat = once(() => toon(0xd4f53c)); // 형광 연두 고리 판

// 세운 상자(물리 치수 w×h×d): 앞뒤에 '?' 그림, 옆면 로고, 위아래 별 — 피규어 긴 상자 그림 칸을 쓴다
export const hookBoxGeo = once(() => {
  const { w, h, d } = HOOK.box, geo = new THREE.BoxGeometry(w, h, d), uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const FRONT = [0, 0.5, 0, 1], SIDE = [0.5, 1, 0.5, 1], END = [0.5, 1, 0, 0.5], region = [SIDE, SIDE, END, END, FRONT, FRONT];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k, [u0, u1, v0, v1] = region[f];
    uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  }
  return geo;
});
export const hookBoxMat = (): THREE.Material => blindBoxMat('long');
const pieceGeo = (ps: Piece[]) => mergeGeometries(ps.map((p) => new THREE.BoxGeometry(p.half[0] * 2, p.half[1] * 2, p.half[2] * 2).translate(...p.at).toNonIndexed()))!;
const flapGeos = new Map<RingSide, THREE.BufferGeometry>(), gluedGeos = new Map<RingSide, THREE.BufferGeometry>();
export const flapGeo = (side: RingSide) => flapGeos.get(side) ?? flapGeos.set(side, pieceGeo(flapPieces(side))).get(side)!;
export const gluedGeo = (side: RingSide) => gluedGeos.get(side) ?? gluedGeos.set(side, pieceGeo([gluedPiece(side)])).get(side)!;
// 쉬는 날개 자리: 상자와 같은 돌림으로 접는 선에 평평하게
export function restFlap(side: RingSide, box: BoxWire): BoxWire {
  const q = new THREE.Quaternion(box[3], box[4], box[5], box[6]), at = new THREE.Vector3(...hingeOf(side).at).applyQuaternion(q);
  return [box[0] + at.x, box[1] + at.y, box[2] + at.z, box[3], box[4], box[5], box[6]];
}
export const hookClawGeos = once(() => clawGeosOf(hookClawShape()));

const G = once(() => ({
  shelf: new THREE.BoxGeometry(HOOK.shelf.half_x * 2, 1, HOOK.shelf.front_z - HOOK.shelf.back_z),
  get: new THREE.PlaneGeometry(HOOK.shelf.half_x * 2, HOOK.exit.front_z - HOOK.shelf.front_z),
  pane: new THREE.BoxGeometry(1, 1, 0.008),
  tier: new THREE.BoxGeometry(1.0, 0.16, 0.14),
}));

// 한 대: 몸통(줄 색) + 속. LED 도형은 따로
export function makeHookMachineParts(spot: { id: string; x: number; z: number; ry: number }, color: number): { statics: THREE.Group; ledGeo: THREE.BufferGeometry } {
  const g = G(), m = new THREE.Group(), { shelf, exit, box } = HOOK, index = RINGS.findIndex((r) => r.id === spot.id);
  m.position.set(spot.x, 0, spot.z); m.rotation.y = spot.ry;
  const ledGeo = makeCabinetShell(m, color, { sign: machineSignMat(HOOK_SIGN, color), plate: plateMat(), pop: machinePopMat(5) });
  const plate = m.getObjectByName('plate') as THREE.Mesh, uv = (plate.geometry = plate.geometry.clone()).getAttribute('uv') as THREE.BufferAttribute;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (index % 2) / 2 + uv.getX(k) / 2, 1 - (Math.floor(index / 2) + 1) / 5 + uv.getY(k) / 5);
  const add = (o: THREE.Object3D) => { m.add(o); return o; };
  const shelfH = shelf.y - FLOOR_Y, shelfMat = toon(0xffffff);
  shelfMat.map = hexTex();
  add(part(g.shelf, shelfMat, [0, FLOOR_Y + shelfH / 2, (shelf.front_z + shelf.back_z) / 2], [1, shelfH, 1], [0, 0, 0], 1.02));
  const get = add(new THREE.Mesh(g.get, getMat())); get.rotation.x = -Math.PI / 2; get.position.set(0, FLOOR_Y + 0.002, (shelf.front_z + exit.front_z) / 2); // 출구
  // 투명판: 앞(낮게), 옆, 뒤 — 물리 벽 자리
  const pane = (w: number, h: number, at: [number, number, number], ry = 0) => { const p = add(new THREE.Mesh(g.pane, machineAcryl())); p.scale.set(w, h, 1); p.position.set(...at); p.rotation.y = ry; };
  pane(shelf.half_x * 2, 0.22, [0, FLOOR_Y + 0.11, exit.front_z]);
  pane(shelf.half_x * 2, 0.4, [0, shelf.y + 0.2, shelf.back_z]);
  for (const s of [-1, 1]) pane(exit.front_z - shelf.back_z, 0.4, [s * shelf.half_x, shelf.y + 0.2, (exit.front_z + shelf.back_z) / 2], Math.PI / 2);
  // 뒤 진열: 같은 '?' 상자 셋
  add(part(g.tier, toon(0xffeef6), [0, FLOOR_Y + 0.08, -0.43], [1, 1, 1], [0, 0, 0], 1.03));
  [-0.3, 0, 0.3].forEach((x, k) => { const b = add(new THREE.Mesh(hookBoxGeo(), hookBoxMat())); b.name = 'hook-display'; b.position.set(x, FLOOR_Y + 0.16 + box.h / 2, -0.44); b.rotation.y = (k - 1) * 0.06; });
  m.traverse((o) => { o.castShadow = false; });
  return { statics: m, ledGeo };
}
