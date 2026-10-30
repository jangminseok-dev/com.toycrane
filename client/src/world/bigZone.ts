import * as THREE from 'three';
import { MACHINES, type MachineSpot } from '../data/storeLayout';
import type { Occluder } from '../game/occlusion';
import { bakeByMaterial, fadeMaterials, materialCloner, mergeBuckets } from './bake';
import { makeDoll } from './dolls';
import { CLAW_REST, DOLL_FLOOR, DOLL_SCALE, STACK_RAISE, clawMat, ledBaseMat, ledFlashMat, makeMachineParts } from './machine';

// 기계 속 인형 한 칸: [인형 id, x, z, 몸 돌림] — 기계 안 좌표 (서버 welcome·machine 메시지와 같은 모양)
export type DollSpot = [string, number, number, number];

export interface BigZone {
  setContents(machineId: string, dolls: DollSpot[]): void; // 목록에 없는 인형은 건너뜀
  contentsOf(machineId: string): DollSpot[];
  clawOf(machineId: string): THREE.Object3D;
  worldOf(machineId: string): THREE.Object3D; // 기계 자리·방향 (모션·카메라 기준)
  flash(machineId: string, gold: boolean, seconds: number): void;
  showAim(machineId: string, on: boolean): void; // 집게 아래 바닥의 겨냥 고리 (하는 동안만)
  update(t: number): void; // 깜빡임, 바뀐 행의 인형 다시 합치기
  occluders: Occluder[]; // 행 2개: 벽 줄, 섬
}

const aimGeo = new THREE.RingGeometry(0.035, 0.06, 28);
// 인형 더미에 가려도 보이게 맨 위에 그린다
const aimMat = new THREE.MeshBasicMaterial({ color: 0xff3b8f, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false });
// 기계 속 인형은 행 안에서 기계 4~6대씩 묶어 합친다 — 한 기계가 바뀌면 그 묶음만 다시 합친다(행 전체는 휴대폰에서 멈칫함)
const BLOCK_MAX = 6;
type Row = { group: THREE.Group; cloner: ReturnType<typeof materialCloner>; spots: MachineSpot[] };
type Block = { row: Row; group: THREE.Group; spots: MachineSpot[]; dirty: boolean };
type Unit = { row: Row; block: Block; anchor: THREE.Group; claw: THREE.Group; led: THREE.Mesh; contents: DollSpot[]; flashUntil: number; gold: boolean };

// 인형 종류마다 lite 모양을 재질별로 한 번만 합쳐 두고, 다시 합칠 때는 옮겨 붙이기만 한다
type Part = { geo: THREE.BufferGeometry; mat: THREE.Material };
const partsCache = new Map<string, Part[] | null>();
function liteParts(kind: string): Part[] | null {
  if (!partsCache.has(kind)) {
    const doll = makeDoll(kind, true);
    partsCache.set(kind, doll ? bakeByMaterial(doll).map((m) => ({ geo: m.geometry, mat: m.material as THREE.Material })) : null);
  }
  return partsCache.get(kind)!;
}

// 위쪽 큰인형 구역: 벽 줄 13대 + 등 맞댄 섬 22대 (shared/store_layout.json).
// 그리기 호출을 줄이려고 행마다 고정 부분·기계 속 인형을 재질별로 합치고, LED·집게는 기계마다 한 덩어리로 둔다.
// 재질은 행마다 복제해서, 내 캐릭터를 가리는 행만 흐리게 할 수 있다.
export function buildBigZone(scene: THREE.Scene): BigZone {
  const units = new Map<string, Unit>();
  const rows: Row[] = (['wall', 'island'] as const).map((name) => {
    const group = new THREE.Group(); group.name = `big-${name}`;
    scene.add(group);
    return { group, cloner: materialCloner(), spots: MACHINES.filter((m) => m.row === name) };
  });
  const blocks: Block[] = rows.flatMap((row) => {
    const count = Math.ceil(row.spots.length / BLOCK_MAX), size = Math.ceil(row.spots.length / count);
    return Array.from({ length: count }, (_, i) => {
      const group = new THREE.Group(); group.name = `dolls-${row.group.name}-${i}`;
      row.group.add(group);
      return { row, group, spots: row.spots.slice(i * size, (i + 1) * size), dirty: false };
    });
  });

  MACHINES.forEach((spot, index) => {
    const row = rows.find((r) => r.spots.includes(spot))!;
    const block = blocks.find((b) => b.spots.includes(spot))!;
    const { statics, ledGeo, clawGeo } = makeMachineParts(spot, index);
    const tmp = new THREE.Group(); tmp.add(statics);
    for (const m of bakeByMaterial(tmp, row.cloner.remap)) row.group.add(m);
    const anchor = new THREE.Group(); anchor.position.set(spot.x, 0, spot.z); anchor.rotation.y = spot.ry;
    const led = new THREE.Mesh(ledGeo, row.cloner.remap(ledBaseMat()));
    const claw = new THREE.Group(); claw.position.copy(CLAW_REST);
    claw.add(new THREE.Mesh(clawGeo, row.cloner.remap(clawMat())));
    // 겨냥 고리: 집게를 따라 펠트 바닥에 비친다(실제 크레인 게임의 집게 그림자처럼)
    const aim = new THREE.Mesh(aimGeo, aimMat);
    aim.name = 'aim'; aim.visible = false; aim.renderOrder = 10; aim.rotation.x = -Math.PI / 2; aim.position.y = DOLL_FLOOR + 0.012 - CLAW_REST.y;
    claw.add(aim);
    anchor.add(led, claw);
    row.group.add(anchor);
    units.set(spot.id, { row, block, anchor, claw, led, contents: [], flashUntil: 0, gold: false });
  });
  const flashMats = new Map(rows.map((r) => [r, { hot: r.cloner.remap(ledFlashMat().hot), gold: r.cloner.remap(ledFlashMat().gold) }]));

  // 묶음의 인형을 다시 합친다 (성공한 판마다 그 기계가 든 묶음 하나)
  const holder = new THREE.Matrix4(), local = new THREE.Matrix4(), world = new THREE.Matrix4();
  const at = new THREE.Vector3(), turn = new THREE.Quaternion(), tilt = new THREE.Euler(), size = new THREE.Vector3().setScalar(DOLL_SCALE);
  const UP = new THREE.Vector3(0, 1, 0);
  function rebuild(block: Block) {
    for (const old of block.group.children as THREE.Mesh[]) old.geometry.dispose();
    block.group.clear();
    const buckets = new Map<THREE.Material, { line: boolean; geos: THREE.BufferGeometry[] }>();
    for (const spot of block.spots) {
      holder.compose(at.set(spot.x, 0, spot.z), turn.setFromAxisAngle(UP, spot.ry), new THREE.Vector3(1, 1, 1));
      units.get(spot.id)!.contents.forEach(([id, x, z, r], i) => {
        const parts = liteParts(id);
        if (!parts) return; // 목록에 없는 인형
        // 뒤쪽 셋은 위에 얹은 것처럼, 기울기는 r에서 정해 모든 화면에서 같게
        tilt.set(Math.sin(r * 3) * 0.25, r, Math.cos(r * 5) * 0.25);
        local.compose(at.set(x, DOLL_FLOOR + (i >= 6 ? STACK_RAISE : 0), z), turn.setFromEuler(tilt), size);
        world.multiplyMatrices(holder, local);
        for (const { geo, mat } of parts) {
          if (!buckets.has(mat)) buckets.set(mat, { line: false, geos: [] });
          buckets.get(mat)!.geos.push(geo.clone().applyMatrix4(world));
        }
      });
    }
    for (const m of mergeBuckets(buckets, block.row.cloner.remap)) { m.castShadow = false; block.group.add(m); }
    block.dirty = false;
  }

  const occluders: Occluder[] = rows.map((row) => {
    const box = new THREE.Box3().setFromObject(row.group);
    return { box, setOpacity: (o: number) => fadeMaterials(row.cloner.materials, o) };
  });

  const unit = (id: string) => {
    const u = units.get(id);
    if (!u) throw new Error(`모르는 기계 ${id}`);
    return u;
  };
  return {
    occluders,
    setContents(id, dolls) { const u = units.get(id); if (!u) return; u.contents = dolls; u.block.dirty = true; },
    contentsOf: (id) => units.get(id)?.contents ?? [],
    clawOf: (id) => unit(id).claw,
    worldOf: (id) => unit(id).anchor,
    flash(id, gold, seconds) { const u = unit(id); u.flashUntil = performance.now() / 1000 + seconds; u.gold = gold; },
    showAim(id, on) { unit(id).claw.getObjectByName('aim')!.visible = on; },
    update(t) {
      for (const block of blocks) if (block.dirty) rebuild(block);
      const now = performance.now() / 1000, blink = Math.floor(t * 10) % 2 === 0;
      for (const u of units.values()) {
        const flashing = now < u.flashUntil, mats = flashMats.get(u.row)!;
        u.led.material = flashing && blink ? (u.gold ? mats.gold : mats.hot) : u.row.cloner.remap(ledBaseMat());
      }
    },
  };
}
