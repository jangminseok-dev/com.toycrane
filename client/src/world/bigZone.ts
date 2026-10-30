import * as THREE from 'three';
import { MACHINES, type MachineSpot } from '../data/storeLayout';
import type { Occluder } from '../game/occlusion';
import { bakeByMaterial, fadeMaterials, materialCloner } from './bake';
import { makeDoll } from './dolls';
import { CLAW_REST, DOLL_FLOOR, clawMat, ledBaseMat, ledFlashMat, makeMachineParts } from './machine';

// 기계 속 인형 한 칸: [인형 id, x, z, 몸 돌림] — 기계 안 좌표 (서버 welcome·machine 메시지와 같은 모양)
export type DollSpot = [string, number, number, number];

export interface BigZone {
  setContents(machineId: string, dolls: DollSpot[]): void; // 목록에 없는 인형은 건너뜀
  clawOf(machineId: string): THREE.Object3D;
  worldOf(machineId: string): THREE.Object3D; // 기계 자리·방향 (모션·카메라 기준)
  flash(machineId: string, gold: boolean, seconds: number): void;
  update(t: number): void; // 깜빡임, 바뀐 행의 인형 다시 합치기
  occluders: Occluder[]; // 행 2개: 벽 줄, 섬
}

const DOLL_SCALE = 0.3;
type Row = { group: THREE.Group; dolls: THREE.Group; cloner: ReturnType<typeof materialCloner>; spots: MachineSpot[]; dirty: boolean };
type Unit = { row: Row; anchor: THREE.Group; claw: THREE.Group; led: THREE.Mesh; contents: DollSpot[]; flashUntil: number; gold: boolean };

// 위쪽 큰인형 구역: 벽 줄 13대 + 등 맞댄 섬 22대 (shared/store_layout.json).
// 그리기 호출을 줄이려고 행마다 고정 부분·기계 속 인형을 재질별로 합치고, LED·집게는 기계마다 한 덩어리로 둔다.
// 재질은 행마다 복제해서, 내 캐릭터를 가리는 행만 흐리게 할 수 있다.
export function buildBigZone(scene: THREE.Scene): BigZone {
  const units = new Map<string, Unit>();
  const rows: Row[] = (['wall', 'island'] as const).map((name) => {
    const group = new THREE.Group(); group.name = `big-${name}`;
    const dolls = new THREE.Group(); group.add(dolls);
    scene.add(group);
    return { group, dolls, cloner: materialCloner(), spots: MACHINES.filter((m) => m.row === name), dirty: false };
  });

  MACHINES.forEach((spot, index) => {
    const row = rows.find((r) => r.spots.includes(spot))!;
    const { statics, ledGeo, clawGeo } = makeMachineParts(spot, index);
    const tmp = new THREE.Group(); tmp.add(statics);
    for (const m of bakeByMaterial(tmp, row.cloner.remap)) row.group.add(m);
    const anchor = new THREE.Group(); anchor.position.set(spot.x, 0, spot.z); anchor.rotation.y = spot.ry;
    const led = new THREE.Mesh(ledGeo, row.cloner.remap(ledBaseMat()));
    const claw = new THREE.Group(); claw.position.copy(CLAW_REST);
    claw.add(new THREE.Mesh(clawGeo, row.cloner.remap(clawMat())));
    anchor.add(led, claw);
    row.group.add(anchor);
    units.set(spot.id, { row, anchor, claw, led, contents: [], flashUntil: 0, gold: false });
  });
  const flashMats = new Map(rows.map((r) => [r, { hot: r.cloner.remap(ledFlashMat().hot), gold: r.cloner.remap(ledFlashMat().gold) }]));

  // 행의 인형을 처음부터 다시 합친다 (기계 하나가 바뀌어도 그 행 전체 — 성공한 판마다 한 번)
  function rebuild(row: Row) {
    for (const old of row.dolls.children as THREE.Mesh[]) old.geometry.dispose();
    row.dolls.clear();
    const tmp = new THREE.Group();
    for (const spot of row.spots) {
      const unit = units.get(spot.id)!;
      const holder = new THREE.Group(); holder.position.set(spot.x, 0, spot.z); holder.rotation.y = spot.ry;
      unit.contents.forEach(([id, x, z, r], i) => {
        const doll = makeDoll(id, true);
        if (!doll) return;
        doll.scale.setScalar(DOLL_SCALE);
        // 뒤쪽 셋은 위에 얹어 무더기처럼, 기울기는 r에서 정해 모든 화면에서 같게
        doll.position.set(x, DOLL_FLOOR + (i >= 6 ? DOLL_SCALE * 0.55 : 0), z);
        doll.rotation.set(Math.sin(r * 3) * 0.25, r, Math.cos(r * 5) * 0.25);
        holder.add(doll);
      });
      tmp.add(holder);
    }
    for (const m of bakeByMaterial(tmp, row.cloner.remap)) { m.castShadow = false; row.dolls.add(m); }
    row.dirty = false;
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
    setContents(id, dolls) { const u = units.get(id); if (!u) return; u.contents = dolls; u.row.dirty = true; },
    clawOf: (id) => unit(id).claw,
    worldOf: (id) => unit(id).anchor,
    flash(id, gold, seconds) { const u = unit(id); u.flashUntil = performance.now() / 1000 + seconds; u.gold = gold; },
    update(t) {
      for (const row of rows) if (row.dirty) rebuild(row);
      const now = performance.now() / 1000, blink = Math.floor(t * 10) % 2 === 0;
      for (const u of units.values()) {
        const flashing = now < u.flashUntil, mats = flashMats.get(u.row)!;
        u.led.material = flashing && blink ? (u.gold ? mats.gold : mats.hot) : u.row.cloner.remap(ledBaseMat());
      }
    },
  };
}
