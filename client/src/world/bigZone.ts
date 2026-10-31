import * as THREE from 'three';
import { MACHINES, type MachineSpot } from '../data/storeLayout';
import type { Occluder } from '../game/occlusion';
import { bakeByMaterial, fadeMaterials, materialCloner, mergeBuckets } from './bake';
import { BODY_W, makeDoll } from './dolls';
import { dollPose } from './dollPose';
import { toonWith } from './toon';
import { TOP_LAYER } from './topView';
import { CHROME, idleClawGeometry, makeClawRig, type ClawRig } from './claw';
import { CLAW_REST, DOLL_FLOOR, DOLL_SCALE, bulbSpots, ledBaseMat, ledFlashMat, makeControlParts, makeMachineParts } from './machine';

// 기계 속 인형 한 칸: [캐릭터, x, z, 몸 돌림, 얹힌 높이, 색, 체형, 표정, 희귀, 번호] — 서버 welcome·machine 메시지와 같은 모양
import { lookOf, type DollSpot } from '../net/protocol';
export type { DollSpot };

export interface BigZone {
  setContents(machineId: string, dolls: DollSpot[]): void; // 목록에 없는 인형은 건너뜀
  contentsOf(machineId: string): DollSpot[];
  clawOf(machineId: string): THREE.Object3D;
  worldOf(machineId: string): THREE.Object3D; // 기계 자리·방향 (모션·카메라 기준)
  flash(machineId: string, gold: boolean, seconds: number): void;
  showAim(machineId: string, on: boolean): void; // 집게 아래 바닥의 겨냥 고리 (하는 동안만)
  activateClaw(machineId: string): ClawRig; // 하는 동안 그 기계에 움직이는 집게를 빌려 준다
  rigOf(machineId: string): ClawRig | null;
  releaseClaw(machineId: string): void;
  hideControls(machineId: string, hidden: boolean): void; // 내가 하는 동안 기계 그림의 레버·하강 버튼을 숨긴다 (움직이는 것을 따로 그리므로)
  pileOf(machineId: string): number[]; // 지금 무더기에 합쳐 그린 인형 번호 (떨어지는 중인 새 인형은 빠짐)
  resetSeen(): void; // 다시 접속한 welcome 앞에: 다음에 받는 내용을 처음 받는 것처럼 (그사이 채워진 인형을 한꺼번에 떨어뜨리지 않게)
  update(t: number): void; // 깜빡임, 바뀐 행의 인형 다시 합치기, 새 인형 떨어지기, 희귀 반짝임
  occluders: Occluder[]; // 행 2개: 벽 줄, 섬
}

const aimGeo = new THREE.RingGeometry(0.035, 0.06, 28);
// 인형 더미에 가려도 보이게 깊이를 무시하고 그린다. 불투명 목록에서 renderOrder 10으로 그려, 그 뒤(11)에 그리는 내 기계의 레버·버튼이
// 고리를 덮는다 — 반투명이면 맨 마지막에 그려져 집게가 앞쪽에 있을 때 레버 공 위에 겹쳐 보였다
export const AIM_ORDER = 10;
const aimMat = new THREE.MeshBasicMaterial({ color: 0xff3b8f, depthWrite: false, depthTest: false });
// 기계 속 인형은 행 안에서 기계 4~6대씩 묶어 합친다 — 한 기계가 바뀌면 그 묶음만 다시 합친다(행 전체는 휴대폰에서 멈칫함)
const BLOCK_MAX = 6;
type Row = { group: THREE.Group; cloner: ReturnType<typeof materialCloner>; spots: MachineSpot[] };
type Block = { row: Row; group: THREE.Group; spots: MachineSpot[]; dirty: boolean };
type Falling = { obj: THREE.Object3D; y: number; start: number | null };
type Unit = {
  row: Row; block: Block; anchor: THREE.Group; claw: THREE.Group; idle: THREE.Mesh; rig: ClawRig | null;
  led: THREE.Mesh; contents: DollSpot[]; flashUntil: number; gold: boolean; bulbStart: number;
  seen: Set<number> | null; // 이 화면이 본 적 있는 인형 번호 (처음 받기 전엔 null — 처음 받은 인형은 떨어뜨리지 않는다)
  falling: Map<number, Falling>; baked: number[]; rare: '' | 'rare' | 'gold';
};
// 간판 둘레 전구: 행마다 InstancedMesh 하나, 켜졌다 꺼지며 돈다(3개 중 하나가 어둡게, 초당 8칸). 당첨 땐 그 기계 전구가 분홍·금색으로 깜빡
const BULB = { bright: new THREE.Color(0xfff4c8), dim: new THREE.Color(0x8a8070), hot: new THREE.Color(0xff5fa2), gold: new THREE.Color(0xffd36b) };
const bulbGeo = new THREE.IcosahedronGeometry(0.024, 0); // 2.4cm라 각진 작은 구로 충분 (35대 × 58개)
const rigPool: ClawRig[] = [];

// 인형 겉모습(캐릭터·색·표정·희귀)마다 lite 모양을 재질별로 한 번만 합쳐 두고, 다시 합칠 때는 옮겨 붙이기만 한다.
// 빛나지 않는 툰 칠 부품은 색을 꼭짓점 색으로 옮겨 공용 재질(무늬 없으면 DOLL_VC, 다람쥐 줄무늬처럼 무채색 무늬면 그 무늬마다 하나)로
// 모은다 — 색이 여러 가지여도 그리기 호출이 늘지 않게. 빛나는 특수효과·황금만 따로 묶인다 (설계 2026-10-31 인형 채우기 §5)
type Part = { geo: THREE.BufferGeometry; mat: THREE.Material };
const DOLL_VC = toonWith({ color: 0xffffff, vertexColors: true });
const tintedVC = new Map<THREE.Texture, THREE.Material>();
const tintable = (m: THREE.Material): m is THREE.MeshToonMaterial => m instanceof THREE.MeshToonMaterial && m.emissive.getHex() === 0 && !m.vertexColors;
// 합쳐 둔 모양은 최근에 쓴 것만 이만큼 둔다 — 겉모습이 2천 가지 가까이라 다 두면 휴대폰 메모리가 넘친다(매장 무더기는 216개)
export const LITE_CACHE_MAX = 300;
const partsCache = new Map<string, Part[] | null>();
export const liteCacheSize = () => partsCache.size;
function liteParts(spot: DollSpot): Part[] | null {
  const look = lookOf(spot), key = `${spot[0]}|${look.color}|${look.face}|${look.rare}`;
  const known = partsCache.get(key);
  if (known !== undefined) { partsCache.delete(key); partsCache.set(key, known); return known; } // 최근에 쓴 것으로
  const doll = makeDoll(spot[0], look, true);
  let parts: Part[] | null = null;
  if (doll) {
    const buckets = new Map<THREE.Material, { line: boolean; geos: THREE.BufferGeometry[] }>();
    for (const m of bakeByMaterial(doll)) {
      let mat = m.material as THREE.Material;
      if (tintable(mat)) {
        const c = mat.color, n = m.geometry.getAttribute('position').count, colors = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
        m.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const map = mat.map;
        if (map && !tintedVC.has(map)) tintedVC.set(map, toonWith({ color: 0xffffff, map, vertexColors: true }));
        mat = map ? tintedVC.get(map)! : DOLL_VC;
      }
      if (!buckets.has(mat)) buckets.set(mat, { line: false, geos: [] });
      buckets.get(mat)!.geos.push(m.geometry);
    }
    parts = mergeBuckets(buckets).map((m) => ({ geo: m.geometry, mat: m.material as THREE.Material }));
  }
  partsCache.set(key, parts);
  while (partsCache.size > LITE_CACHE_MAX) {
    const [oldest, gone] = partsCache.entries().next().value!;
    gone?.forEach((p) => p.geo.dispose()); // 무더기에는 복제해 붙이므로 원본은 지워도 된다
    partsCache.delete(oldest);
  }
  return parts;
}
// 새로 채워진 인형: 위 0.6m에서 0.6초 동안 떨어져 한 번 톡 튄다
const FALL_SECONDS = 0.6, FALL_HEIGHT = 0.6;
const fallOffset = (k: number) => (k < 0.7 ? FALL_HEIGHT * (1 - (k / 0.7) ** 2) : 0.05 * Math.sin(Math.PI * ((k - 0.7) / 0.3)));
// 희귀가 든 기계 간판 위에서 도는 반짝임 (황금은 금빛, 더 많이·크게)
const sparkleGeo = new THREE.OctahedronGeometry(0.045);
const SPARKLE = { rare: { n: 4, scale: 1, color: new THREE.Color(0xffa8e0) }, gold: { n: 6, scale: 1.5, color: new THREE.Color(0xffd75a) } };

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
    const { statics, ledGeo } = makeMachineParts(spot, index);
    const tmp = new THREE.Group(); tmp.add(statics);
    for (const m of bakeByMaterial(tmp, row.cloner.remap)) row.group.add(m);
    const anchor = new THREE.Group(); anchor.position.set(spot.x, 0, spot.z); anchor.rotation.y = spot.ry;
    const led = new THREE.Mesh(ledGeo, row.cloner.remap(ledBaseMat()));
    const claw = new THREE.Group(); claw.position.copy(CLAW_REST);
    const idle = new THREE.Mesh(idleClawGeometry(), row.cloner.remap(CHROME())); idle.name = 'idle-claw';
    claw.add(idle);
    // 겨냥 고리: 집게를 따라 펠트 바닥에 비친다(실제 크레인 게임의 집게 그림자처럼)
    const aim = new THREE.Mesh(aimGeo, aimMat);
    aim.name = 'aim'; aim.visible = false; aim.renderOrder = AIM_ORDER; aim.rotation.x = -Math.PI / 2; aim.position.y = DOLL_FLOOR + 0.012 - CLAW_REST.y;
    claw.add(aim);
    anchor.add(led, claw);
    row.group.add(anchor);
    units.set(spot.id, {
      row, block, anchor, claw, idle, rig: null, led, contents: [], flashUntil: 0, gold: false, bulbStart: row.spots.indexOf(spot) * bulbSpots().length,
      seen: null, falling: new Map(), baked: [], rare: '',
    });
  });
  const bulbRows = rows.map((row) => {
    const spots = bulbSpots(), mesh = new THREE.InstancedMesh(bulbGeo, row.cloner.remap(new THREE.MeshBasicMaterial({ color: 0xffffff })), row.spots.length * spots.length);
    mesh.name = `bulbs-${row.group.name}`;
    const machine = new THREE.Matrix4(), bulb = new THREE.Matrix4();
    row.spots.forEach((spot, j) => {
      machine.makeRotationY(spot.ry).setPosition(spot.x, 0, spot.z);
      spots.forEach((p, k) => mesh.setMatrixAt(j * spots.length + k, bulb.makeTranslation(p.x, p.y, p.z).premultiply(machine)));
    });
    for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, BULB.bright);
    row.group.add(mesh);
    return { row, mesh };
  });
  // 레버 막대·공과 하강 버튼: 행마다 재질별 InstancedMesh (기계 그림에 합치면 하는 기계 것만 숨길 수 없다)
  const controlParts = bakeByMaterial(makeControlParts());
  const machineAt = (spot: MachineSpot) => new THREE.Matrix4().makeRotationY(spot.ry).setPosition(spot.x, 0, spot.z);
  const controlRows = rows.map((row) => {
    const meshes = controlParts.map((p) => {
      const mesh = new THREE.InstancedMesh(p.geometry, row.cloner.remap(p.material as THREE.Material), row.spots.length);
      mesh.name = `controls-${row.group.name}`; mesh.castShadow = false;
      row.spots.forEach((spot, j) => mesh.setMatrixAt(j, machineAt(spot)));
      row.group.add(mesh);
      return mesh;
    });
    return { row, meshes };
  });
  const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
  const sparkleRows = rows.map((row) => {
    const mesh = new THREE.InstancedMesh(sparkleGeo, row.cloner.remap(new THREE.MeshBasicMaterial({ color: 0xffffff })), row.spots.length * SPARKLE.gold.n);
    mesh.name = `rare-sparkles-${row.group.name}`; mesh.count = 0; mesh.frustumCulled = false; // 처음엔 하나도 없어 경계 구가 비므로
    row.group.add(mesh);
    return { row, mesh };
  });
  const sparkleAt = new THREE.Matrix4(), sparklePos = new THREE.Vector3(), sparkleTurn = new THREE.Quaternion(), sparkleSize = new THREE.Vector3();
  let bulbKey = '';
  const flashMats = new Map(rows.map((r) => [r, { hot: r.cloner.remap(ledFlashMat().hot), gold: r.cloner.remap(ledFlashMat().gold) }]));

  // 묶음의 인형을 다시 합친다 (성공한 판마다 그 기계가 든 묶음 하나)
  const holder = new THREE.Matrix4(), local = new THREE.Matrix4(), world = new THREE.Matrix4();
  const at = new THREE.Vector3(), turn = new THREE.Quaternion(), size = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  function rebuild(block: Block) {
    for (const old of block.group.children as THREE.Mesh[]) old.geometry.dispose();
    block.group.clear();
    const buckets = new Map<THREE.Material, { line: boolean; geos: THREE.BufferGeometry[] }>();
    for (const spot of block.spots) {
      holder.compose(at.set(spot.x, 0, spot.z), turn.setFromAxisAngle(UP, spot.ry), new THREE.Vector3(1, 1, 1));
      const u = units.get(spot.id)!;
      u.baked = [];
      u.contents.forEach((dollSpot) => {
        const parts = liteParts(dollSpot);
        if (!parts || u.falling.has(dollSpot[9])) return; // 목록에 없는 인형, 아직 떨어지는 중인 새 인형
        u.baked.push(dollSpot[9]);
        // 서버가 정한 얹힌 높이, r에서 정한 기울기, 머리 가운데가 인형 자리 위 (world/dollPose.ts), 체형만큼 옆으로 넓거나 좁게
        const pose = dollPose(dollSpot), w = BODY_W[dollSpot[6]];
        local.compose(pose.position, pose.quaternion, size.set(DOLL_SCALE * w, DOLL_SCALE, DOLL_SCALE * w));
        world.multiplyMatrices(holder, local);
        for (const { geo, mat } of parts) {
          if (!buckets.has(mat)) buckets.set(mat, { line: false, geos: [] });
          buckets.get(mat)!.geos.push(geo.clone().applyMatrix4(world));
        }
      });
    }
    for (const m of mergeBuckets(buckets, block.row.cloner.remap)) { m.castShadow = false; m.layers.enable(TOP_LAYER); block.group.add(m); } // 위에서 본 화면에도
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
    setContents(id, dolls) {
      const u = units.get(id);
      if (!u) return;
      const uids = new Set(dolls.map((d) => d[9]));
      for (const [uid, f] of u.falling) if (!uids.has(uid)) { f.obj.removeFromParent(); u.falling.delete(uid); }
      // 처음 받은 뒤로 처음 보는 번호 = 새로 채워진 인형 → 위에서 떨어뜨린다 (집게 연출이 잠깐 뺐다 넣은 인형은 이미 본 번호)
      if (u.seen) for (const d of dolls) if (!u.seen.has(d[9])) {
        const obj = makeDoll(d[0], lookOf(d), true);
        if (!obj) continue;
        const pose = dollPose(d), w = BODY_W[d[6]];
        obj.position.copy(pose.position); obj.quaternion.copy(pose.quaternion); obj.scale.set(DOLL_SCALE * w, DOLL_SCALE, DOLL_SCALE * w);
        obj.position.y += FALL_HEIGHT; obj.userData.uid = d[9];
        obj.traverse((o) => { o.castShadow = false; });
        u.anchor.add(obj);
        u.falling.set(d[9], { obj, y: pose.position.y, start: null });
      }
      u.seen = new Set([...(u.seen ?? []), ...uids]);
      u.rare = dolls.some((d) => d[8] === 'gold') ? 'gold' : dolls.some((d) => d[8]) ? 'rare' : '';
      u.contents = dolls; u.block.dirty = true;
    },
    pileOf: (id) => units.get(id)?.baked ?? [],
    resetSeen() { for (const u of units.values()) u.seen = null; },
    contentsOf: (id) => units.get(id)?.contents ?? [],
    clawOf: (id) => unit(id).claw,
    worldOf: (id) => unit(id).anchor,
    flash(id, gold, seconds) { const u = unit(id); u.flashUntil = performance.now() / 1000 + seconds; u.gold = gold; },
    showAim(id, on) { unit(id).claw.getObjectByName('aim')!.visible = on; },
    activateClaw(id) {
      const u = unit(id);
      if (!u.rig) { u.rig = rigPool.pop() ?? makeClawRig(); u.claw.add(u.rig.root); u.idle.visible = false; }
      return u.rig;
    },
    rigOf: (id) => units.get(id)?.rig ?? null,
    releaseClaw(id) {
      const u = unit(id);
      if (!u.rig) return;
      const rig = u.rig;
      rig.root.removeFromParent(); rig.setOpen(0.35); rig.setCable(0.05); rig.swing.rotation.set(0, 0, 0);
      for (const c of [...rig.grip.children]) rig.grip.remove(c);
      rigPool.push(rig); u.rig = null; u.idle.visible = true;
    },
    hideControls(id, hidden) {
      const u = unit(id), spot = MACHINES.find((m) => m.id === id)!, j = u.row.spots.indexOf(spot);
      for (const mesh of controlRows.find((c) => c.row === u.row)!.meshes) {
        mesh.setMatrixAt(j, hidden ? HIDDEN : machineAt(spot));
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
    update(t) {
      for (const u of units.values()) for (const [uid, f] of u.falling) {
        f.start ??= t;
        const k = (t - f.start) / FALL_SECONDS;
        if (k >= 1) { f.obj.removeFromParent(); u.falling.delete(uid); u.block.dirty = true; } // 같은 프레임에 무더기로 합친다
        else f.obj.position.y = f.y + fallOffset(k);
      }
      for (const block of blocks) if (block.dirty) rebuild(block);
      for (const { row, mesh } of sparkleRows) {
        let n = 0;
        row.spots.forEach((spot) => {
          const u = units.get(spot.id)!;
          if (!u.rare) return;
          const look = SPARKLE[u.rare];
          for (let i = 0; i < look.n; i++) {
            const a = t * 1.4 + (i / look.n) * Math.PI * 2;
            sparklePos.set(Math.cos(a) * 0.4, 2.62 + Math.sin(t * 3 + i) * 0.05, 0.25 + Math.sin(a) * 0.15);
            sparkleAt.compose(sparklePos, sparkleTurn.setFromAxisAngle(UP, a * 2), sparkleSize.setScalar(look.scale)).premultiply(machineAt(spot));
            mesh.setMatrixAt(n, sparkleAt); mesh.setColorAt(n, look.color); n++;
          }
        });
        if (n || mesh.count) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
      }
      const now = performance.now() / 1000, blink = Math.floor(t * 10) % 2 === 0;
      for (const u of units.values()) {
        const flashing = now < u.flashUntil, mats = flashMats.get(u.row)!;
        u.led.material = flashing && blink ? (u.gold ? mats.gold : mats.hot) : u.row.cloner.remap(ledBaseMat());
      }
      // 전구는 칸이 바뀔 때만 다시 칠한다 (깜빡이는 기계가 있으면 깜빡임 박자도)
      const tick = Math.floor(t * 8), flashing = [...units.values()].filter((u) => now < u.flashUntil);
      const key = `${tick}|${flashing.length ? blink : '-'}|${flashing.map((u) => u.bulbStart).join(',')}`;
      if (key !== bulbKey) {
        bulbKey = key;
        for (const { mesh } of bulbRows) for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, (i + tick) % 3 === 0 ? BULB.dim : BULB.bright);
        const n = bulbSpots().length;
        for (const u of flashing) {
          const mesh = bulbRows.find((b) => b.row === u.row)!.mesh;
          for (let k = 0; k < n; k++) mesh.setColorAt(u.bulbStart + k, blink ? (u.gold ? BULB.gold : BULB.hot) : BULB.dim);
        }
        for (const { mesh } of bulbRows) mesh.instanceColor!.needsUpdate = true;
      }
    },
  };
}
