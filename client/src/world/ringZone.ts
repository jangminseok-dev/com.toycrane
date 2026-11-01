import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { dollName, GOLD } from '../data/catalog';
import { RING, RINGS, pegXY, type RingSpot } from '../data/rings';
import type { Occluder } from '../game/occlusion';
import type { CardWire } from '../net/protocol';
import { bakeByMaterial, fadeMaterials, materialCloner } from './bake';
import { RING_BUTTONS, RING_SIGN } from './copy';
import { BUTTON_SCALE, FIGURE_CONTROLS, LABEL, LABEL_Y, labelMat } from './figureControls';
import { ledBaseMat, machinePopMat, machineSignMat, makeCabinetShell } from './machine';
import { thumbnailSoon } from './thumbs';
import { canvasTex, part, toon, toonWith } from './toon';

// 고리 뽑기 구역(설계 2026-11-02 §3): 북쪽 두 줄 10대. 줄마다 몸통·구멍판·걸이를 재질별로 합쳐 굽고, 카드(보이는 경품)는 줄마다 그림판 한 장
// (카드 60장 = 칸 60개, 바뀐 칸만 다시 그림), 갈고리(막대·팔)와 조작대 버튼 ①②('오른쪽'·'위로')는 줄마다 인스턴스. 가림막은 줄마다 + 기계마다 상자
const FONT = '"Jua", "Apple SD Gothic Neo", -apple-system, sans-serif';
const ROW_COLORS: Record<RingSpot['row'], number> = { r1: 0x16b39a, r2: 0xff8a3d };
const BODY_BOX = new THREE.Box3(new THREE.Vector3(-0.63, 0, -0.56), new THREE.Vector3(0.63, 2.6, 0.56));
const PEGS = RING.board.cols * RING.board.rows, SLOT_W = 128, SLOT_H = 176, ATLAS_COLS = 8;
const CARD_Z = RING.board.z + 0.05, HOOK_OUT_Z = 0.25, CHUTE: [number, number, number] = [-0.38, 0.95, 0.32];
const BUTTON_COLORS = [new THREE.Color(0xff3b5c), new THREE.Color(0x3b8bff)];
const DOME = new THREE.SphereGeometry(0.055, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);

export type RingZone = {
  setBoard(id: string, cards: CardWire[]): void;
  boardOf(id: string): CardWire[];
  setHook(id: string, x: number, y: number, poke: number): void; // 갈고리 끝(기계 좌표 x, y), poke 0(앞) ~ 1(구멍판 앞까지 쑥)
  hookTip(id: string): THREE.Vector3; // 갈고리 끝 자리(기계 좌표)
  showCard(id: string, peg: number, shown: boolean): void; // 걸린 카드는 걸이에서 빼고 따로 날린다
  flyCard(id: string, card: CardWire | null, at: THREE.Vector3): void; // 날아가는 카드(null이면 치움), 기계 좌표
  chute: THREE.Vector3; // 출구(기계 좌표)
  worldOf(id: string): THREE.Object3D;
  hideControls(id: string, hidden: boolean): void;
  occluders: Occluder[];
};

// 카드 한 장 그림: 투명 블리스터, 위 고리 구멍, 가운데 인형 작은 그림(아직이거나 없으면 색 동그라미 — 찍히면 onReady), 아래 이름. 희귀·황금은 테두리 색과 별
function drawCard(g: CanvasRenderingContext2D, x: number, y: number, card: CardWire | null, onReady: () => void = () => {}) {
  g.clearRect(x, y, SLOT_W, SLOT_H);
  if (!card) return;
  const [kind, color, rare] = card, edge = rare === GOLD.id ? '#e3a400' : rare ? '#b46cff' : '#ff8fbf';
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.roundRect(x + 4, y + 4, SLOT_W - 8, SLOT_H - 8, 14); g.fill();
  g.lineWidth = 6; g.strokeStyle = edge; g.stroke();
  g.fillStyle = '#d8d4e4'; g.beginPath(); g.arc(x + SLOT_W / 2, y + 20, 9, 0, Math.PI * 2); g.fill(); // 고리 구멍
  const pic = thumbnailSoon(kind, color, rare, onReady);
  if (pic) g.drawImage(pic, x + 14, y + 34, 100, 100);
  else { g.fillStyle = edge; g.beginPath(); g.arc(x + SLOT_W / 2, y + 84, 36, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#2c2470'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `17px ${FONT}`;
  g.fillText(dollName(kind, color, rare), x + SLOT_W / 2, y + SLOT_H - 22);
  if (rare) { g.fillStyle = edge; g.font = `22px ${FONT}`; g.fillText(rare === GOLD.id ? '★★' : '★', x + SLOT_W - 22, y + 22); }
}

// 구멍판: 흰 판에 고른 구멍 점
const boardTex = () => canvasTex(256, 256, (g) => {
  g.fillStyle = '#f7f5fb'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#d9d3e6';
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.beginPath(); g.arc(16 + i * 32, 16 + j * 32, 4, 0, Math.PI * 2); g.fill(); }
}, [3, 3]);
// 번호판 R-1~R-10 한 장(가로 2 × 세로 5, 칸 256×64)
const plateTex = () => canvasTex(512, 320, (g) => {
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `44px ${FONT}`;
  RINGS.forEach((r, i) => {
    const x = (i % 2) * 256, y = Math.floor(i / 2) * 64;
    g.fillStyle = '#ffffff'; g.fillRect(x, y, 256, 64); g.fillStyle = '#2c2470'; g.fillText(r.id, x + 128, y + 34);
  });
});

export function buildRingZone(scene: THREE.Scene): RingZone {
  type Unit = { row: number; slot: number; matrix: THREE.Matrix4; anchor: THREE.Object3D; cards: (CardWire | null)[]; shown: boolean[]; hook: [number, number, number]; hidden: boolean };
  const units = new Map<string, Unit>(), occluders: Occluder[] = [];
  const rows: { inst: Record<string, THREE.InstancedMesh>; atlas: CanvasRenderingContext2D; tex: THREE.CanvasTexture }[] = [];
  const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), flatUp = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const plate = new THREE.MeshBasicMaterial({ map: plateTex() }), boardMat = toonWith({ map: boardTex() }), pegMat = toon(0xc9ccd6), chuteMat = toon(0xff7ab6);
  const G = {
    board: new THREE.BoxGeometry(0.96, 0.82, 0.02), peg: new THREE.CylinderGeometry(0.006, 0.006, 0.07, 8).rotateX(Math.PI / 2),
    chute: new THREE.BoxGeometry(0.22, 0.04, 0.18), rod: new THREE.BoxGeometry(0.012, 1, 0.012), arm: new THREE.BoxGeometry(0.01, 0.01, 1),
  };
  (['r1', 'r2'] as const).forEach((rowId, r) => {
    const spots = RINGS.filter((s) => s.row === rowId), root = new THREE.Group(), cloner = materialCloner();
    root.name = `ring-row-${rowId}`;
    scene.add(root);
    // 몸통·구멍판·걸이·출구: 재질별로 합쳐 굽기 + LED 한 덩어리
    const statics = new THREE.Group(), leds: THREE.BufferGeometry[] = [];
    spots.forEach((s) => {
      const m = new THREE.Group(); m.position.set(s.x, 0, s.z); m.rotation.y = s.ry;
      const led = makeCabinetShell(m, ROW_COLORS[rowId], { sign: machineSignMat(RING_SIGN, ROW_COLORS[rowId]), plate, pop: machinePopMat(2) });
      const pm = m.getObjectByName('plate') as THREE.Mesh, i = RINGS.indexOf(s), uv = (pm.geometry = pm.geometry.clone()).getAttribute('uv') as THREE.BufferAttribute;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (i % 2) / 2 + uv.getX(k) / 2, 1 - (Math.floor(i / 2) + 1) / 5 + uv.getY(k) / 5);
      m.add(part(G.board, boardMat, [0, 1.45, RING.board.z - 0.012], [1, 1, 1], [0, 0, 0], 1.02));
      for (let p = 0; p < PEGS; p++) { const [px, py] = pegXY(p); m.add(part(G.peg, pegMat, [px, py, RING.board.z + 0.035], [1, 1, 1], [0, 0, 0], 0)); }
      m.add(part(G.chute, chuteMat, CHUTE, [1, 1, 1], [0, 0, 0], 1.04));
      m.traverse((o) => { o.castShadow = false; });
      statics.add(m);
      m.updateMatrix();
      leds.push(led.clone().applyMatrix4(m.matrix));
    });
    for (const mesh of bakeByMaterial(statics, cloner.remap)) root.add(mesh);
    root.add(new THREE.Mesh(mergeGeometries(leds)!, cloner.remap(ledBaseMat())));
    // 카드: 줄 그림판 한 장(칸 SLOT_W×SLOT_H), 기계마다 걸이 12장의 네모를 한 도형으로
    const canvas = document.createElement('canvas'); canvas.width = SLOT_W * ATLAS_COLS; canvas.height = 2048;
    const atlas = canvas.getContext('2d')!, tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const quads: THREE.BufferGeometry[] = [];
    spots.forEach((s, slot) => {
      const m = new THREE.Matrix4().compose(v.set(s.x, 0, s.z), q.setFromEuler(new THREE.Euler(0, s.ry, 0)), new THREE.Vector3(1, 1, 1));
      for (let p = 0; p < PEGS; p++) {
        const [px, py] = pegXY(p), cell = slot * PEGS + p, cu = (cell % ATLAS_COLS) * SLOT_W, cv = Math.floor(cell / ATLAS_COLS) * SLOT_H;
        const g = new THREE.PlaneGeometry(RING.card.w, RING.card.h).translate(px, py + 0.012 - RING.card.h / 2, CARD_Z).applyMatrix4(m);
        const uv = g.getAttribute('uv') as THREE.BufferAttribute;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, (cu + uv.getX(k) * SLOT_W) / canvas.width, 1 - (cv + (1 - uv.getY(k)) * SLOT_H) / canvas.height);
        quads.push(g);
      }
    });
    const cards = new THREE.Mesh(mergeGeometries(quads)!, cloner.remap(new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05 })));
    cards.name = 'ring-cards';
    root.add(cards);
    // 인스턴스: 갈고리 막대·팔, 버튼 ①②, 버튼 글씨
    const n = spots.length, make = (geo: THREE.BufferGeometry, mat: THREE.Material, count = n) => {
      const im = new THREE.InstancedMesh(geo, cloner.remap(mat), count);
      im.frustumCulled = false; im.castShadow = false; root.add(im); return im;
    };
    const inst = {
      rod: make(G.rod, toon(0xc9ccd6)), arm: make(G.arm, toon(0x9aa0ad)),
      button: make(DOME, toonWith({ color: 0xffffff, emissive: 0x220011, emissiveIntensity: 0.3 }), n * 2),
      label1: make(LABEL, labelMat(0, RING_BUTTONS)), label2: make(LABEL, labelMat(1, RING_BUTTONS)),
    };
    rows.push({ inst, atlas, tex });
    const body = new THREE.Box3(), boxes: THREE.Box3[] = [];
    spots.forEach((s, slot) => {
      const anchor = new THREE.Object3D(); anchor.position.set(s.x, 0, s.z); anchor.rotation.y = s.ry; anchor.name = `ring-${s.id}`;
      root.add(anchor); anchor.updateMatrix();
      const u: Unit = { row: r, slot, matrix: anchor.matrix.clone(), anchor, cards: Array(PEGS).fill(null), shown: Array(PEGS).fill(true), hook: [RING.hook.home[0], RING.hook.home[1], 0], hidden: false };
      units.set(s.id, u);
      const b = BODY_BOX.clone().applyMatrix4(u.matrix); boxes.push(b); body.union(b);
      for (let k = 0; k < 2; k++) inst.button.setColorAt(slot * 2 + k, BUTTON_COLORS[k]);
      placeHook(u); placeButtons(u);
    });
    occluders.push({ box: body, boxes, setOpacity: (o) => fadeMaterials(cloner.materials, o) });
  });

  function set(im: THREE.InstancedMesh, i: number, local: THREE.Matrix4, base: THREE.Matrix4) {
    im.setMatrixAt(i, tmp.multiplyMatrices(base, local)); im.instanceMatrix.needsUpdate = true;
  }
  function tipZ(poke: number) { return HOOK_OUT_Z - Math.min(1, Math.max(0, poke)) * (HOOK_OUT_Z - CARD_Z - 0.01); }
  function placeHook(u: Unit) {
    const { inst } = rows[u.row], [x, y, poke] = u.hook, top = 1.95, z = tipZ(poke), armLen = 0.14;
    set(inst.rod, u.slot, new THREE.Matrix4().compose(v.set(x, (top + y) / 2, z + armLen), q.identity(), new THREE.Vector3(1, top - y, 1)), u.matrix);
    set(inst.arm, u.slot, new THREE.Matrix4().compose(v.set(x, y, z + armLen / 2), q.identity(), new THREE.Vector3(1, 1, armLen)), u.matrix);
  }
  function placeButtons(u: Unit) {
    const { inst } = rows[u.row];
    [FIGURE_CONTROLS.one, FIGURE_CONTROLS.two].forEach(([bx, by, bz], k) => {
      const s = u.hidden ? 0 : 1;
      set(inst.button, u.slot * 2 + k, new THREE.Matrix4().compose(v.set(bx, by, bz), q.identity(), new THREE.Vector3(BUTTON_SCALE[0] * s, BUTTON_SCALE[1] * s, BUTTON_SCALE[2] * s)), u.matrix);
      set(k === 0 ? inst.label1 : inst.label2, u.slot, new THREE.Matrix4().compose(v.set(bx, by + LABEL_Y * BUTTON_SCALE[1] + 0.001, bz), flatUp, new THREE.Vector3(BUTTON_SCALE[0] * s, BUTTON_SCALE[2] * s, 1)), u.matrix);
    });
  }
  function drawSlot(u: Unit, p: number) {
    const row = rows[u.row], cell = u.slot * PEGS + p;
    drawCard(row.atlas, (cell % ATLAS_COLS) * SLOT_W, Math.floor(cell / ATLAS_COLS) * SLOT_H, u.shown[p] ? u.cards[p] : null, () => drawSlot(u, p));
    row.tex.needsUpdate = true;
  }
  const unit = (id: string) => { const u = units.get(id); if (!u) throw new Error(`no ring machine ${id}`); return u; };
  const flying = new Map<string, { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; key: string }>();

  return {
    setBoard(id, cards) {
      const u = unit(id);
      cards.forEach((c, p) => {
        const old = u.cards[p];
        if (old && old[0] === c[0] && old[1] === c[1] && old[2] === c[2]) return;
        u.cards[p] = [...c] as CardWire; drawSlot(u, p);
      });
    },
    boardOf: (id) => unit(id).cards.map((c) => (c ? ([...c] as CardWire) : (['', 0, ''] as CardWire))),
    setHook(id, x, y, poke) { const u = unit(id); u.hook = [x, y, poke]; placeHook(u); },
    hookTip: (id) => { const [x, y, poke] = unit(id).hook; return new THREE.Vector3(x, y, tipZ(poke)); },
    showCard(id, peg, shown) { const u = unit(id); if (u.shown[peg] !== shown) { u.shown[peg] = shown; drawSlot(u, peg); } },
    flyCard(id, card, at) {
      const u = unit(id), key = card ? card.join('|') : '';
      let f = flying.get(id);
      // 치우거나 바꿀 때 그 카드의 그림·재질·도형을 버린다(걸릴 때마다 새로 그리므로)
      const free = (m: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>) => { u.anchor.remove(m); m.geometry.dispose(); m.material.map?.dispose(); m.material.dispose(); };
      if (!card) { if (f) { free(f.mesh); flying.delete(id); } return; }
      if (!f || f.key !== key) {
        if (f) free(f.mesh);
        const tex = canvasTex(SLOT_W, SLOT_H, (g) => drawCard(g, 0, 0, card));
        f = { mesh: new THREE.Mesh(new THREE.PlaneGeometry(RING.card.w, RING.card.h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05 })), key };
        u.anchor.add(f.mesh); flying.set(id, f);
      }
      f.mesh.position.copy(at);
    },
    chute: new THREE.Vector3(...CHUTE),
    worldOf: (id) => unit(id).anchor,
    hideControls(id, hidden) { const u = unit(id); u.hidden = hidden; placeButtons(u); },
    occluders,
  };
}
