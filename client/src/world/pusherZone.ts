import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GOLD } from '../data/catalog';
import { PUSHER, PUSHERS } from '../data/pushers';
import type { Occluder } from '../game/occlusion';
import type { ItemWire } from '../net/protocol';
import { bakeByMaterial, fadeMaterials, materialCloner } from './bake';
import { PUSHER_BUTTON, PUSHER_SIGN } from './copy';
import { BUTTON_SCALE, LABEL, LABEL_Y, labelMat } from './figureControls';
import { ledBaseMat, machinePopMat, machineSignMat, makeCabinetShell } from './machine';
import { thumbnailSoon } from './thumbs';
import { canvasTex, part, toon, toonWith } from './toon';

// 미는 뽑기 구역(설계 2026-11-02 §4): 북쪽 가운데 4대. 몸통·선반·벽·출구는 재질별로 합쳐 굽고, 미니 인형은 4대 전부 그림판 한 장 + 한 도형
// (인형마다 작은 그림을 세운 네모 — 기계마다 24칸, 인형 번호(uid)마다 칸 하나), 미는 판과 버튼 '밀기'는 인스턴스. 가림막은 4대 + 기계마다 상자
const COLOR = 0xffb81c;
const BODY_BOX = new THREE.Box3(new THREE.Vector3(-0.63, 0, -0.56), new THREE.Vector3(0.63, 2.6, 0.56));
const { shelf: S, plate: P, item: I } = PUSHER;
const SLOTS = 24, CELL = 128, ATLAS_COLS = 8, QUAD = I.r * 2.6; // 그림 속 인형은 네모의 75% 남짓 — 지름 8cm 인형이 그만하게
const PLATE_DEPTH = 0.03, PLATE_H = 0.08; // 인형(약 10cm) 뒤에서도 보이게
export const PUSH_BUTTON: [number, number, number] = [0.22, 0.925, 0.66]; // 조작대 버튼 '밀기'(기계 좌표)
const DOME = new THREE.SphereGeometry(0.055, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const HIT = new THREE.BoxGeometry(0.26, 0.16, 0.26);
const BUTTON_COLOR = 0x3b8bff, GLOW = 0.75, PRESS_DEPTH = 0.012;
const LABELS = [PUSHER_BUTTON, PUSHER_BUTTON] as const; // 윗면 글씨 '밀기 ▲'(① 자리 대신 ② 모양 — 위 화살표·파랑)

export type ShownItem = { item: ItemWire; x: number; y: number; z: number }; // 기계 좌표 x, z, 선반 위 높이 y(떨어지면 음수)
export type PusherZone = {
  setShelf(id: string, items: ItemWire[]): void; // 멈춘 선반(서버가 둔 자리)
  shelfOf(id: string): ItemWire[];
  show(id: string, items: ShownItem[]): void; // 밀기 그리는 동안의 자리
  shown(id: string): ShownItem[];
  setPlate(id: string, x: number, push: number): void; // 미는 판 가운데 x, push 0(뒤) ~ 1(stroke만큼 앞)
  plateOf(id: string): { x: number; push: number };
  worldOf(id: string): THREE.Object3D;
  hideControls(id: string, hidden: boolean): void;
  occluders: Occluder[];
};

// 판 동안 누르는 진짜 버튼 '밀기' — 두근두근 빛나고 누르는 동안 들어간다(피규어 버튼과 같은 크기·누르는 범위)
export type PushButton = { pick(ray: THREE.Raycaster): 1 | null; setPressed(on: boolean): void; update(t: number): void; dispose(): void };
export function buildPushButton(anchor: THREE.Object3D): PushButton {
  const group = new THREE.Group(); group.name = 'pusher-controls';
  const [x, y, z] = PUSH_BUTTON, mat = toonWith({ color: BUTTON_COLOR, emissive: BUTTON_COLOR, emissiveIntensity: GLOW });
  const dome = part(DOME, mat, [x, y, z], BUTTON_SCALE, [0, 0, 0], 1.04);
  const label = new THREE.Mesh(LABEL, labelMat(1, LABELS)); label.rotation.x = -Math.PI / 2; label.position.y = LABEL_Y;
  dome.add(label);
  const hit = new THREE.Mesh(HIT, new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(x, y + 0.04, z);
  group.add(dome, hit);
  group.traverse((o) => { o.castShadow = false; });
  anchor.add(group);
  return {
    pick: (ray) => (ray.intersectObject(hit, false).length ? 1 : null),
    setPressed(on) { dome.position.y = y - (on ? PRESS_DEPTH : 0); },
    update(t) { mat.emissiveIntensity = GLOW * (0.55 + 0.45 * Math.sin(t * 7)); },
    dispose() { anchor.remove(group); },
  };
}

// 미니 인형 칸 하나: 투명 바탕에 작은 그림(아직이거나 없으면 색 동그라미 — 찍히면 onReady), 희귀·황금은 발밑 별
function drawItem(g: CanvasRenderingContext2D, x: number, y: number, item: ItemWire | null, onReady: () => void) {
  g.clearRect(x, y, CELL, CELL);
  if (!item) return;
  const [, kind, color, rare] = item, pic = thumbnailSoon(kind, color, rare, onReady);
  if (pic) g.drawImage(pic, x, y, CELL, CELL);
  else { g.fillStyle = rare === GOLD.id ? '#e3a400' : '#ff8fbf'; g.beginPath(); g.arc(x + CELL / 2, y + CELL / 2, CELL * 0.35, 0, Math.PI * 2); g.fill(); }
  if (rare) { g.fillStyle = rare === GOLD.id ? '#e3a400' : '#b46cff'; g.font = '26px sans-serif'; g.textAlign = 'center'; g.fillText(rare === GOLD.id ? '★★' : '★', x + CELL / 2, y + CELL - 10); }
}

// 번호판 P-1~P-4 한 장(가로 2 × 세로 2, 칸 256×64)
const plateTex = () => canvasTex(512, 128, (g) => {
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '44px "Jua", sans-serif';
  PUSHERS.forEach((p, i) => {
    const x = (i % 2) * 256, y = Math.floor(i / 2) * 64;
    g.fillStyle = '#ffffff'; g.fillRect(x, y, 256, 64); g.fillStyle = '#2c2470'; g.fillText(p.id, x + 128, y + 34);
  });
});

export function buildPusherZone(scene: THREE.Scene): PusherZone {
  type Unit = { index: number; matrix: THREE.Matrix4; anchor: THREE.Object3D; shelf: ItemWire[]; shown: ShownItem[]; slots: Map<number, number>; plate: { x: number; push: number }; hidden: boolean };
  const units = new Map<string, Unit>(), root = new THREE.Group(), cloner = materialCloner();
  root.name = 'pusher-zone';
  scene.add(root);
  const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), flatUp = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const depth = S.front_z - S.back_z, shelfBack = S.back_z - 0.06;
  const G = {
    shelf: new THREE.BoxGeometry(S.half_w * 2, 0.03, S.front_z - shelfBack), wall: new THREE.BoxGeometry(0.015, 0.07, depth + 0.06),
    back: new THREE.BoxGeometry(S.half_w * 2 + 0.03, 0.16, 0.015), chute: new THREE.BoxGeometry(S.half_w * 2, 0.05, 0.12),
    plate: new THREE.BoxGeometry(P.half_w * 2, PLATE_H, PLATE_DEPTH),
  };
  const plateNo = new THREE.MeshBasicMaterial({ map: plateTex() }), shelfMat = toon(0xfff4d6), wallMat = toon(0xd9eef7), chuteMat = toon(0xff7ab6);
  // 몸통·선반·옆벽·뒷벽·출구: 재질별로 합쳐 굽기 + LED 한 덩어리
  const statics = new THREE.Group(), leds: THREE.BufferGeometry[] = [];
  PUSHERS.forEach((s, i) => {
    const m = new THREE.Group(); m.position.set(s.x, 0, s.z); m.rotation.y = s.ry;
    const led = makeCabinetShell(m, COLOR, { sign: machineSignMat(PUSHER_SIGN, COLOR), plate: plateNo, pop: machinePopMat(3) });
    const pm = m.getObjectByName('plate') as THREE.Mesh, uv = (pm.geometry = pm.geometry.clone()).getAttribute('uv') as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (i % 2) / 2 + uv.getX(k) / 2, 1 - (Math.floor(i / 2) + 1) / 2 + uv.getY(k) / 2);
    m.add(part(G.shelf, shelfMat, [0, S.y - 0.015, (S.front_z + shelfBack) / 2], [1, 1, 1], [0, 0, 0], 1.02));
    for (const sx of [-1, 1]) m.add(part(G.wall, wallMat, [sx * (S.half_w + 0.0075), S.y + 0.035, (S.front_z + shelfBack) / 2], [1, 1, 1], [0, 0, 0], 1.03));
    m.add(part(G.back, wallMat, [0, S.y + 0.08, shelfBack], [1, 1, 1], [0, 0, 0], 1.03));
    m.add(part(G.chute, chuteMat, [0, S.y - 0.06, S.front_z + 0.06], [1, 1, 1], [0, 0, 0], 1.04));
    m.traverse((o) => { o.castShadow = false; });
    statics.add(m);
    m.updateMatrix();
    leds.push(led.clone().applyMatrix4(m.matrix));
  });
  for (const mesh of bakeByMaterial(statics, cloner.remap)) root.add(mesh);
  root.add(new THREE.Mesh(mergeGeometries(leds)!, cloner.remap(ledBaseMat())));
  // 미니 인형: 4대 × 24칸 네모 한 도형(칸 자리는 그대로, 꼭짓점만 옮김) + 그림판 한 장
  const canvas = document.createElement('canvas'); canvas.width = CELL * ATLAS_COLS; canvas.height = CELL * Math.ceil((PUSHERS.length * SLOTS) / ATLAS_COLS);
  const atlas = canvas.getContext('2d')!, tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const quads = PUSHERS.length * SLOTS, pos = new Float32Array(quads * 12), uvs = new Float32Array(quads * 8), index: number[] = [];
  for (let c = 0; c < quads; c++) {
    const u0 = ((c % ATLAS_COLS) * CELL) / canvas.width, u1 = u0 + CELL / canvas.width;
    const v1 = 1 - (Math.floor(c / ATLAS_COLS) * CELL) / canvas.height, v0 = v1 - CELL / canvas.height;
    uvs.set([u0, v0, u1, v0, u1, v1, u0, v1], c * 8);
    index.push(c * 4, c * 4 + 1, c * 4 + 2, c * 4, c * 4 + 2, c * 4 + 3);
  }
  const itemGeo = new THREE.BufferGeometry();
  itemGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); itemGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); itemGeo.setIndex(index);
  const itemMesh = new THREE.Mesh(itemGeo, cloner.remap(new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.3, side: THREE.DoubleSide })));
  itemMesh.name = 'pusher-items'; itemMesh.frustumCulled = false;
  root.add(itemMesh);
  // 인스턴스: 미는 판, 버튼, 버튼 글씨
  const n = PUSHERS.length, make = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const im = new THREE.InstancedMesh(geo, cloner.remap(mat), n);
    im.frustumCulled = false; im.castShadow = false; root.add(im); return im;
  };
  const inst = { plate: make(G.plate, toon(0x7a5cff)), button: make(DOME, toonWith({ color: BUTTON_COLOR, emissive: 0x001133, emissiveIntensity: 0.3 })), label: make(LABEL, labelMat(1, LABELS)) };
  const body = new THREE.Box3(), boxes: THREE.Box3[] = [];
  PUSHERS.forEach((s, index) => {
    const anchor = new THREE.Object3D(); anchor.position.set(s.x, 0, s.z); anchor.rotation.y = s.ry; anchor.name = `pusher-${s.id}`;
    root.add(anchor); anchor.updateMatrix();
    const u: Unit = { index, matrix: anchor.matrix.clone(), anchor, shelf: [], shown: [], slots: new Map(), plate: { x: 0, push: 0 }, hidden: false };
    units.set(s.id, u);
    const b = BODY_BOX.clone().applyMatrix4(u.matrix); boxes.push(b); body.union(b);
    placePlate(u); placeButton(u); drawItems(u);
  });
  const occluders: Occluder[] = [{ box: body, boxes, setOpacity: (o) => fadeMaterials(cloner.materials, o) }];

  function set(im: THREE.InstancedMesh, i: number, local: THREE.Matrix4, base: THREE.Matrix4) {
    im.setMatrixAt(i, tmp.multiplyMatrices(base, local)); im.instanceMatrix.needsUpdate = true;
  }
  function placePlate(u: Unit) {
    const front = S.back_z + P.stroke * Math.min(1, Math.max(0, u.plate.push));
    set(inst.plate, u.index, new THREE.Matrix4().compose(v.set(u.plate.x, S.y + PLATE_H / 2, front - PLATE_DEPTH / 2), q.identity(), new THREE.Vector3(1, 1, 1)), u.matrix);
  }
  function placeButton(u: Unit) {
    const [bx, by, bz] = PUSH_BUTTON, s = u.hidden ? 0 : 1;
    set(inst.button, u.index, new THREE.Matrix4().compose(v.set(bx, by, bz), q.identity(), new THREE.Vector3(BUTTON_SCALE[0] * s, BUTTON_SCALE[1] * s, BUTTON_SCALE[2] * s)), u.matrix);
    set(inst.label, u.index, new THREE.Matrix4().compose(v.set(bx, by + LABEL_Y * BUTTON_SCALE[1] + 0.001, bz), flatUp, new THREE.Vector3(BUTTON_SCALE[0] * s, BUTTON_SCALE[2] * s, 1)), u.matrix);
  }
  // 그 기계의 24칸: 보이는 인형은 자기 칸(처음 보일 때 그림), 나머지 칸은 한 점으로 접는다
  function drawItems(u: Unit) {
    const live = new Set(u.shown.map((s) => s.item[0]));
    for (const [uid, slot] of u.slots) if (!live.has(uid)) { u.slots.delete(uid); drawCell(u, slot, null); }
    const used = new Set(u.slots.values()), corner = new THREE.Vector3();
    for (const s of u.shown) {
      let slot = u.slots.get(s.item[0]);
      if (slot === undefined) {
        slot = [...Array(SLOTS).keys()].find((k) => !used.has(k));
        if (slot === undefined) continue; // 칸이 모자라면(있을 수 없음) 그리지 않는다
        u.slots.set(s.item[0], slot); used.add(slot); drawCell(u, slot, s.item);
      }
      const c = u.index * SLOTS + slot, h = QUAD / 2, y = S.y + s.y;
      [[-h, 0], [h, 0], [h, QUAD], [-h, QUAD]].forEach(([dx, dy], k) => pos.set(corner.set(s.x + dx, y + dy, s.z).applyMatrix4(u.matrix).toArray(), (c * 4 + k) * 3));
    }
    for (let k = 0; k < SLOTS; k++) if (!used.has(k)) pos.fill(0, (u.index * SLOTS + k) * 12, (u.index * SLOTS + k + 1) * 12);
    itemGeo.getAttribute('position').needsUpdate = true;
  }
  function drawCell(u: Unit, slot: number, item: ItemWire | null) {
    const c = u.index * SLOTS + slot;
    drawItem(atlas, (c % ATLAS_COLS) * CELL, Math.floor(c / ATLAS_COLS) * CELL, item, () => { if (item && u.slots.get(item[0]) === slot) drawCell(u, slot, item); });
    tex.needsUpdate = true;
  }
  const unit = (id: string) => { const u = units.get(id); if (!u) throw new Error(`no pusher machine ${id}`); return u; };

  return {
    setShelf(id, items) {
      const u = unit(id);
      u.shelf = items.map((i) => [...i] as ItemWire);
      u.shown = u.shelf.map((item) => ({ item, x: item[4], y: 0, z: item[5] }));
      drawItems(u);
    },
    shelfOf: (id) => unit(id).shelf.map((i) => [...i] as ItemWire),
    show(id, items) { const u = unit(id); u.shown = items.map((s) => ({ ...s })); drawItems(u); },
    shown: (id) => unit(id).shown.map((s) => ({ ...s })),
    setPlate(id, x, push) { const u = unit(id); u.plate = { x, push }; placePlate(u); },
    plateOf: (id) => ({ ...unit(id).plate }),
    worldOf: (id) => unit(id).anchor,
    hideControls(id, hidden) { const u = unit(id); u.hidden = hidden; placeButton(u); },
    occluders,
  };
}
