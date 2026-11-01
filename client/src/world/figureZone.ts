import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FIGURE, FIGURES, variantOf, type FigureSpot } from '../data/figures';
import type { Occluder } from '../game/occlusion';
import type { BoxWire } from '../net/protocol';
import { CLAW_SHAPE } from '../physics/figureClaw';
import { bakeByMaterial, fadeMaterials, materialCloner } from './bake';
import { BUTTON_SCALE, FIGURE_CONTROLS } from './figureControls';
import { blindBoxGeo, blindBoxMat, clawGeos, clawMats, makeFigureMachineParts } from './figureMachine';
import { ledBaseMat } from './machine';
import { toonWith } from './toon';

// 피규어 구역(9단계): 동쪽 두 줄 14대. 줄마다 몸통·속을 재질별로 합쳐 굽고(그리기 호출이 기계 수에 따라 늘지 않게),
// 상자·집게(머리·띠·스티커·팔·줄)·조작대 버튼은 줄마다 인스턴스 하나씩. 줄마다 가림막(흐리기) — 가림 판정은 기계마다 상자
const ROW_COLORS: Record<FigureSpot['row'], number> = { f1: 0x8b5cf6, f2: 0x2f7cf6 };
const BUTTON_COLORS = [new THREE.Color(0xff3b5c), new THREE.Color(0x3b8bff)];
const DOME = new THREE.SphereGeometry(0.055, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const BODY_BOX = new THREE.Box3(new THREE.Vector3(-0.63, 0, -0.56), new THREE.Vector3(0.63, 2.6, 0.56)); // 기계 하나(간판까지)
const lyingY = (f: FigureSpot) => FIGURE.bars.y + FIGURE.bars.radius + variantOf(f.box).box.d / 2; // 그 기계 상자 종류의 누운 높이

export type FigureZone = {
  setBox(id: string, box: BoxWire): void;
  boxOf(id: string): BoxWire;
  worldOf(id: string): THREE.Object3D; // 기계 기준점(앞 +z) — 카메라·조작대가 붙는다
  setClaw(id: string, x: number, y: number, z: number, open: number): void; // 기계 좌표 머리 자리, 팔 벌림 0~1
  hideControls(id: string, hidden: boolean): void; // 하는 기계는 살아 있는 버튼(figureControls)이 덮는다
  occluders: Occluder[];
};

type Unit = { row: number; slot: number; matrix: THREE.Matrix4; anchor: THREE.Object3D; box: BoxWire; claw: [number, number, number, number]; hidden: boolean };

export function buildFigureZone(scene: THREE.Scene): FigureZone {
  const units = new Map<string, Unit>(), rows: { inst: Record<string, THREE.InstancedMesh>; cloner: ReturnType<typeof materialCloner>; spots: FigureSpot[] }[] = [];
  const geos = clawGeos(), mats = clawMats(), tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const occluders: Occluder[] = [];
  (['f1', 'f2'] as const).forEach((rowId, r) => {
    const spots = FIGURES.filter((f) => f.row === rowId), root = new THREE.Group(), cloner = materialCloner();
    root.name = `figure-row-${rowId}`;
    scene.add(root);
    // 몸통·속: 재질별로 합쳐 굽기 + LED 한 덩어리
    const statics = new THREE.Group(), leds: THREE.BufferGeometry[] = [];
    spots.forEach((f) => {
      const { statics: m, ledGeo } = makeFigureMachineParts(f, FIGURES.indexOf(f), ROW_COLORS[rowId]);
      statics.add(m);
      m.updateMatrix();
      leds.push(ledGeo.clone().applyMatrix4(m.matrix));
    });
    for (const mesh of bakeByMaterial(statics, cloner.remap)) root.add(mesh);
    root.add(new THREE.Mesh(mergeGeometries(leds)!, cloner.remap(ledBaseMat())));
    // 인스턴스: 상자·집게 부품·버튼
    const n = spots.length, make = (geo: THREE.BufferGeometry, mat: THREE.Material, count = n) => {
      const im = new THREE.InstancedMesh(geo, cloner.remap(mat), count);
      im.frustumCulled = false; im.castShadow = false;
      root.add(im);
      return im;
    };
    const kind = spots[0].box; // 줄마다 한 종류(설계 §8.3: F-1~F-7 긴 상자, F-8~F-14 정사각형)
    const inst = {
      box: make(blindBoxGeo(kind), blindBoxMat(kind)), head: make(geos.head, mats.head), black: make(geos.black, mats.black), red: make(geos.red, mats.red),
      sticker: make(geos.sticker, mats.sticker), armR: make(geos.armR, mats.arm), armL: make(geos.armL, mats.arm), cable: make(geos.cable, mats.cable),
      button: make(DOME, toonWith({ color: 0xffffff, emissive: 0x220011, emissiveIntensity: 0.3 }), n * 2),
    };
    inst.box.name = 'figure-boxes';
    rows.push({ inst, cloner, spots });
    const body = new THREE.Box3(), boxes: THREE.Box3[] = [];
    spots.forEach((f, slot) => {
      const anchor = new THREE.Object3D();
      anchor.position.set(f.x, 0, f.z); anchor.rotation.y = f.ry; anchor.name = `figure-${f.id}`;
      root.add(anchor);
      anchor.updateMatrix();
      const u: Unit = { row: r, slot, matrix: anchor.matrix.clone(), anchor, box: [0, lyingY(f), 0, 0, 0, 0, 1], claw: [FIGURE.claw.home[0], FIGURE.claw.rest_y, FIGURE.claw.home[1], 1], hidden: false };
      units.set(f.id, u);
      const b = BODY_BOX.clone().applyMatrix4(u.matrix);
      boxes.push(b); body.union(b);
      for (let k = 0; k < 2; k++) inst.button.setColorAt(slot * 2 + k, BUTTON_COLORS[k]);
      placeBox(u); placeClaw(u); placeButtons(u);
    });
    occluders.push({ box: body, boxes, setOpacity: (o) => fadeMaterials(cloner.materials, o) });
  });

  function set(im: THREE.InstancedMesh, i: number, local: THREE.Matrix4, base: THREE.Matrix4) {
    im.setMatrixAt(i, tmp.multiplyMatrices(base, local));
    im.instanceMatrix.needsUpdate = true;
  }
  function placeBox(u: Unit) {
    const [x, y, z, qx, qy, qz, qw] = u.box;
    set(rows[u.row].inst.box, u.slot, new THREE.Matrix4().compose(v.set(x, y, z), q.set(qx, qy, qz, qw), one), u.matrix);
  }
  function placeClaw(u: Unit) {
    const { inst } = rows[u.row], [x, y, z, open] = u.claw, { hinge, head, open: OPEN, close: CLOSE } = CLAW_SHAPE;
    const at = new THREE.Matrix4().makeTranslation(x, y, z);
    for (const im of [inst.head, inst.black, inst.red, inst.sticker]) set(im, u.slot, at, u.matrix);
    const ang = -CLOSE + Math.min(1, Math.max(0, open)) * (OPEN + CLOSE); // 오른팔 경첩 각(벌림 +)
    set(inst.armR, u.slot, new THREE.Matrix4().makeTranslation(x + hinge[0], y + hinge[1], z).multiply(new THREE.Matrix4().makeRotationZ(ang)), u.matrix);
    set(inst.armL, u.slot, new THREE.Matrix4().makeTranslation(x - hinge[0], y + hinge[1], z).multiply(new THREE.Matrix4().makeRotationZ(-ang)), u.matrix);
    const top = y + head.hy, len = Math.max(0.001, FIGURE.claw.rest_y + 0.06 - top);
    set(inst.cable, u.slot, new THREE.Matrix4().compose(v.set(x, top, z), q.identity(), new THREE.Vector3(1, len, 1)), u.matrix);
  }
  function placeButtons(u: Unit) {
    [FIGURE_CONTROLS.one, FIGURE_CONTROLS.two].forEach(([bx, by, bz], k) => {
      const s = u.hidden ? 0 : 1;
      set(rows[u.row].inst.button, u.slot * 2 + k, new THREE.Matrix4().compose(v.set(bx, by, bz), q.identity(), new THREE.Vector3(BUTTON_SCALE[0] * s, BUTTON_SCALE[1] * s, BUTTON_SCALE[2] * s)), u.matrix);
    });
  }
  const unit = (id: string) => { const u = units.get(id); if (!u) throw new Error(`no figure machine ${id}`); return u; };

  return {
    setBox(id, box) { const u = unit(id); u.box = [...box] as BoxWire; placeBox(u); },
    boxOf: (id) => [...unit(id).box] as BoxWire,
    worldOf: (id) => unit(id).anchor,
    setClaw(id, x, y, z, open) { const u = unit(id); u.claw = [x, y, z, open]; placeClaw(u); },
    hideControls(id, hidden) { const u = unit(id); u.hidden = hidden; placeButtons(u); },
    occluders,
  };
}
