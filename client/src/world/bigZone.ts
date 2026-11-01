import * as THREE from 'three';
import { MACHINES, type MachineSpot } from '../data/storeLayout';
import type { Occluder } from '../game/occlusion';
import { bakeByMaterial, fadeMaterials, materialCloner, mergeBuckets } from './bake';
import { BODY_W, makeDoll } from './dolls';
import { dollPose } from './dollPose';
import { PLUSH_VC, plushVCWithMap } from './plush/kit';
import { rareTagTex, twinkleTex } from './signs';
import { TOP_LAYER } from './topView';
import { CHROME, idleClawGeometry, makeClawRig, type ClawRig } from './claw';
import { CLAW_REST, DOLL_FLOOR, DOLL_SCALE, bulbSpots, ledBaseMat, ledFlashMat, makeControlParts, makeMachineParts } from './machine';

// 기계 속 인형 한 칸: [캐릭터, x, z, 몸 돌림, 얹힌 높이, 색, 체형, 표정, 희귀, 번호] — 서버 welcome·machine 메시지와 같은 모양
import { lookOf, uidOf, type DollPose, type DollSpot } from '../net/protocol';
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
  pileOf(machineId: string): number[]; // 지금 무더기에 합쳐 그린 인형 번호 (live 모드인 기계는 빠짐)
  unsettled(machineId: string): DollSpot[]; // 아직 안 앉은(y null) 인형들 — 물리가 앉힐 차례
  settleWith(machineId: string, poses: DollPose[]): void; // 물리가 앉힌 자리·돌림을 입힌다
  live(machineId: string): LiveDolls; // 한 판 동안 그 기계의 인형을 무더기에서 빼 따로 그린다 (물리·중계 자세를 입히려고)
  update(t: number): void; // 깜빡임, 바뀐 행의 인형 다시 합치기(새 겉모습은 프레임마다 조금씩 지어 다 지은 묶음부터), 희귀 반짝임
  pending(): number; // 아직 다시 합치지 못한 묶음 수
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
// live 모드: 인형 하나하나를 따로 그리는 메시 (set으로 자세를 입히고, 없어진 번호는 지운다)
export type LiveDolls = { set(uid: number, p: [number, number, number], q: [number, number, number, number]): void; remove(uid: number): void; dispose(): void };
type Unit = {
  row: Row; block: Block; anchor: THREE.Group; claw: THREE.Group; idle: THREE.Mesh; rig: ClawRig | null;
  led: THREE.Mesh; contents: DollSpot[]; flashUntil: number; gold: boolean; bulbStart: number;
  live: Live | null; baked: number[]; rare: '' | 'rare' | 'gold';
};
// live 모드의 속: 인형마다 자세(빈 Object3D, userData.uid)와 재질별로 합쳐 둔 꼭짓점 범위. 매 프레임 바뀐 인형의 범위만 다시 옮겨 쓴다 —
// 인형 9개를 따로 그리면 메시 70여 개(뒷판 모니터까지 두 번)라 휴대폰 그리기 예산을 넘긴다. 합치면 재질 수(2~4)만큼만 그린다
type LiveRange = { uid: number; start: number; count: number; pos: Float32Array; nor: Float32Array };
type LiveBucket = { mesh: THREE.Mesh; ranges: LiveRange[] };
type Live = { poses: Map<number, THREE.Object3D>; buckets: LiveBucket[]; dirty: Set<number>; scale: Map<number, number> };
// 간판 둘레 전구: 행마다 InstancedMesh 하나, 켜졌다 꺼지며 돈다(3개 중 하나가 어둡게, 초당 8칸). 당첨 땐 그 기계 전구가 분홍·금색으로 깜빡
const BULB = { bright: new THREE.Color(0xfff4c8), dim: new THREE.Color(0x8a8070), hot: new THREE.Color(0xff5fa2), gold: new THREE.Color(0xffd36b) };
const bulbGeo = new THREE.IcosahedronGeometry(0.024, 0); // 2.4cm라 각진 작은 구로 충분 (35대 × 58개)
const rigPool: ClawRig[] = [];

// 인형 겉모습(캐릭터·색·표정·희귀)마다 lite 모양을 재질별로 한 번만 합쳐 두고, 다시 합칠 때는 옮겨 붙이기만 한다.
// 빛나지 않는 툰 칠 부품은 색을 꼭짓점 색으로 옮겨 공용 재질(무늬 없으면 DOLL_VC, 다람쥐 줄무늬처럼 무채색 무늬면 그 무늬마다 하나)로
// 모은다 — 색이 여러 가지여도 그리기 호출이 늘지 않게. 빛나는 특수효과·황금만 따로 묶인다 (설계 2026-10-31 인형 채우기 §5)
type Part = { geo: THREE.BufferGeometry; mat: THREE.Material };
// 새 인형(plush)의 빛나지 않는 칠은 색을 꼭짓점 색(주름 그늘)에 곱해 PLUSH_VC 하나로 모은다 (인형 리뉴얼 설계 §7)
const tintable = (m: THREE.Material): m is THREE.MeshToonMaterial => m instanceof THREE.MeshToonMaterial && m.userData.plush === true && m.emissive.getHex() === 0;
// 합칠 수 있게 속성을 position·normal·uv·color 넷으로 맞춘다(외곽선·왕관처럼 uv·색이 없는 도형도)
function uniform(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.getAttribute('position').count;
  for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(key)) g.deleteAttribute(key);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.getAttribute('color')) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return g;
}
// 합쳐 둔 모양은 최근에 쓴 것만 이만큼 둔다 — 겉모습이 2천 가지 가까이라 다 두면 휴대폰 메모리가 넘친다(매장 무더기는 216개)
export const LITE_CACHE_MAX = 300;
const partsCache = new Map<string, Part[] | null>();
export const liteCacheSize = () => partsCache.size;
const lookKey = (spot: DollSpot) => { const look = lookOf(spot); return `${spot[0]}|${look.color}|${look.face}|${look.rare}`; };
// 한 프레임에 새 겉모습을 짓는 시간(ms): 매장 입장 때 216마리를 한 번에 지으면 휴대폰이 3초 넘게 멈췄다(최종 리뷰 I1)
const BUILD_MS = 10;
function liteParts(spot: DollSpot): Part[] | null {
  const look = lookOf(spot), key = lookKey(spot);
  const known = partsCache.get(key);
  if (known !== undefined) { partsCache.delete(key); partsCache.set(key, known); return known; } // 최근에 쓴 것으로
  const doll = makeDoll(spot[0], look, true);
  let parts: Part[] | null = null;
  if (doll) {
    // 조각마다 속성을 맞춘 뒤(uniform) 한 번에 합친다 — 재질별로 먼저 합치면 uv 없는 왕관과 uv 있는 몸이 한 재질(외곽선)에서 만나 합치기가 실패하고 그 덩어리가 통째로 빠졌다
    const buckets = new Map<THREE.Material, { line: boolean; geos: THREE.BufferGeometry[] }>();
    doll.updateMatrixWorld(true);
    doll.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      let mat = m.material as THREE.Material;
      const geo = uniform(m.geometry.clone().applyMatrix4(m.matrixWorld));
      if (tintable(mat)) {
        const c = mat.color, col = geo.getAttribute('color') as THREE.BufferAttribute;
        for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * c.r, col.getY(i) * c.g, col.getZ(i) * c.b);
        mat = mat.map ? plushVCWithMap(mat.map) : PLUSH_VC;
      }
      if (!buckets.has(mat)) buckets.set(mat, { line: false, geos: [] });
      buckets.get(mat)!.geos.push(geo);
    });
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
// 희귀가 든 기계 표시 (교환소 개편 설계 §4.7.1): 간판 위 이름표('★ 희귀'·'★★ 황금', 천천히 위아래로)와 둘레 별 3개가 제자리에서 반짝
// — 4단계의 도는 반짝이는 날벌레처럼 보였다. 이름표 그림 위·아래 절반이 희귀·황금
const tagGeo = (half: 0 | 1) => {
  const geo = new THREE.PlaneGeometry(0.62, 0.155), uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let k = 0; k < uv.count; k++) uv.setY(k, (half === 0 ? 0.5 : 0) + uv.getY(k) * 0.5);
  return geo;
};
const TWINKLE = { rare: new THREE.Color(0xffa8e0), gold: new THREE.Color(0xffd75a) };
const TWINKLE_SPOTS: [number, number, number][] = [[-0.42, 2.7, 0.32], [0.42, 2.64, 0.32], [0.05, 2.86, 0.3]];

// 위쪽 큰인형 구역: 벽 줄 13대 + 등 맞댄 섬 22대 (shared/store_layout.json).
// 그리기 호출을 줄이려고 행마다 고정 부분·기계 속 인형을 재질별로 합치고, LED·집게는 기계마다 한 덩어리로 둔다.
// 재질은 행마다 복제해서, 내 캐릭터를 가리는 행만 흐리게 할 수 있다.
export function buildBigZone(scene: THREE.Scene): BigZone {
  const units = new Map<string, Unit>();
  // 기계 줄은 배치 데이터의 row 값에서, 처음 나온 순서대로 (큰 홀: 서쪽 세 줄 d1·d2·d3)
  const rows: Row[] = [...new Set(MACHINES.map((m) => m.row))].map((name) => {
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
      live: null, baked: [], rare: '',
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
  // 행마다 희귀 이름표·황금 이름표·별 반짝이 InstancedMesh (없으면 그리지 않는다)
  const tagMat = new THREE.MeshBasicMaterial({ map: rareTagTex(), transparent: true, depthWrite: false });
  const twinkleMat = new THREE.MeshBasicMaterial({ map: twinkleTex(), transparent: true, depthWrite: false });
  const instanced = (row: Row, geo: THREE.BufferGeometry, mat: THREE.Material, n: number, name: string) => {
    const mesh = new THREE.InstancedMesh(geo, row.cloner.remap(mat), n);
    mesh.name = `${name}-${row.group.name}`; mesh.count = 0; mesh.visible = false; mesh.renderOrder = 2; // 경계 구는 개수가 바뀔 때 다시 잰다(화면 밖이면 그리지 않게)
    row.group.add(mesh);
    return mesh;
  };
  const markRows = rows.map((row) => ({
    row,
    rare: instanced(row, tagGeo(0), tagMat, row.spots.length, 'rare-tags-rare'),
    gold: instanced(row, tagGeo(1), tagMat, row.spots.length, 'rare-tags-gold'),
    twinkle: instanced(row, new THREE.PlaneGeometry(0.16, 0.16), twinkleMat, row.spots.length * TWINKLE_SPOTS.length, 'rare-twinkles'),
  }));
  const markAt = new THREE.Matrix4(), markPos = new THREE.Vector3(), markTurn = new THREE.Quaternion(), markSize = new THREE.Vector3();
  let bulbKey = '';
  const flashMats = new Map(rows.map((r) => [r, { hot: r.cloner.remap(ledFlashMat().hot), gold: r.cloner.remap(ledFlashMat().gold) }]));

  // 묶음의 인형을 다시 합친다 (성공한 판마다 그 기계가 든 묶음 하나)
  const holder = new THREE.Matrix4(), local = new THREE.Matrix4(), world = new THREE.Matrix4();
  const at = new THREE.Vector3(), turn = new THREE.Quaternion(), size = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  // 묶음의 새 겉모습을 시간 안에서 짓는다 — 다 지었으면 true (합칠 수 있음)
  function warm(block: Block, until: number): boolean {
    for (const spot of block.spots) {
      const u = units.get(spot.id)!;
      if (u.live) continue;
      for (const d of u.contents) {
        if (partsCache.has(lookKey(d))) continue;
        if (performance.now() >= until) return false;
        liteParts(d);
      }
    }
    return true;
  }

  function rebuild(block: Block) {
    for (const old of block.group.children as THREE.Mesh[]) old.geometry.dispose();
    block.group.clear();
    const buckets = new Map<THREE.Material, { line: boolean; geos: THREE.BufferGeometry[] }>();
    for (const spot of block.spots) {
      holder.compose(at.set(spot.x, 0, spot.z), turn.setFromAxisAngle(UP, spot.ry), new THREE.Vector3(1, 1, 1));
      const u = units.get(spot.id)!;
      u.baked = [];
      if (u.live) continue; // 한 판 중인 기계는 따로 그린다 (같은 묶음의 다른 기계는 그대로 합친다 — 최종 리뷰 C1)
      u.contents.forEach((dollSpot) => {
        const parts = liteParts(dollSpot);
        if (!parts) return; // 목록에 없는 인형
        u.baked.push(uidOf(dollSpot));
        // 서버가 기록한 자리·돌림(안 앉은 인형은 임시 자세, world/dollPose.ts), 체형만큼 옆으로 넓거나 좁게
        const pose = dollPose(dollSpot, u.contents), w = BODY_W[dollSpot[9]];
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
  // live 모드 만들기: 지금 배치의 인형들을 재질별로 한 덩어리씩(꼭짓점만 모아) 만들고, 인형마다 자세 Object3D를 둔다
  function buildLive(u: Unit): Live {
    const live: Live = { poses: new Map(), buckets: [], dirty: new Set(), scale: new Map() };
    const perMat = new Map<THREE.Material, { pos: Float32Array[]; nor: Float32Array[]; col: (Float32Array | null)[]; uv: (Float32Array | null)[]; uids: number[] }>();
    for (const d of u.contents) {
      const parts = liteParts(d);
      if (!parts) continue;
      const uid = uidOf(d), pose = dollPose(d, u.contents);
      const obj = new THREE.Object3D(); obj.userData.uid = uid; obj.position.copy(pose.position); obj.quaternion.copy(pose.quaternion);
      u.anchor.add(obj); live.poses.set(uid, obj); live.scale.set(uid, BODY_W[d[9]]); live.dirty.add(uid);
      for (const { geo, mat } of parts) {
        const g = geo.index ? geo.toNonIndexed() : geo;
        const b = perMat.get(mat) ?? { pos: [], nor: [], col: [], uv: [], uids: [] };
        b.pos.push(g.getAttribute('position').array as Float32Array); b.nor.push(g.getAttribute('normal').array as Float32Array);
        b.col.push(g.hasAttribute('color') ? (g.getAttribute('color').array as Float32Array) : null);
        b.uv.push(g.hasAttribute('uv') ? (g.getAttribute('uv').array as Float32Array) : null);
        b.uids.push(uid);
        perMat.set(mat, b);
      }
    }
    for (const [mat, b] of perMat) {
      const total = b.pos.reduce((n, a) => n + a.length / 3, 0);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(total * 3), 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(total * 3), 3).setUsage(THREE.DynamicDrawUsage));
      if (b.col.some((c) => c)) { const col = new Float32Array(total * 3).fill(1); let o = 0; b.col.forEach((c, i) => { if (c) col.set(c, o); o += b.pos[i].length; }); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
      if (b.uv.some((c) => c)) { const uv = new Float32Array(total * 2); let o = 0; b.uv.forEach((c, i) => { if (c) uv.set(c, o); o += (b.pos[i].length / 3) * 2; }); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.4, 0), 1.6); // 기계 유리 칸 — 다시 재지 않는다
      const ranges: LiveRange[] = []; let start = 0;
      b.pos.forEach((pos, i) => { ranges.push({ uid: b.uids[i], start, count: pos.length / 3, pos, nor: b.nor[i] }); start += pos.length / 3; });
      const mesh = new THREE.Mesh(geo, u.row.cloner.remap(mat)); mesh.castShadow = false; mesh.layers.enable(TOP_LAYER); // 경계 구를 위에서 정해 두어 화면 밖이면 걸러진다
      u.anchor.add(mesh);
      live.buckets.push({ mesh, ranges });
    }
    return live;
  }
  const liveM = new THREE.Matrix4(), liveN = new THREE.Matrix3(), liveV = new THREE.Vector3(), liveS = new THREE.Vector3();
  // 바뀐 인형의 꼭짓점을 자세에 맞춰 옮겨 쓴다
  function refreshLive(u: Unit): void {
    const live = u.live;
    if (!live || !live.dirty.size) return;
    for (const { mesh, ranges } of live.buckets) {
      const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute, nor = mesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
      for (const r of ranges) {
        if (!live.dirty.has(r.uid)) continue;
        const obj = live.poses.get(r.uid)!, w = live.scale.get(r.uid) ?? 1;
        liveM.compose(obj.position, obj.quaternion, liveS.set(DOLL_SCALE * w, DOLL_SCALE, DOLL_SCALE * w).multiplyScalar(obj.visible ? 1 : 0));
        liveN.getNormalMatrix(liveM);
        for (let i = 0; i < r.count; i++) {
          liveV.set(r.pos[i * 3], r.pos[i * 3 + 1], r.pos[i * 3 + 2]).applyMatrix4(liveM); pos.setXYZ(r.start + i, liveV.x, liveV.y, liveV.z);
          liveV.set(r.nor[i * 3], r.nor[i * 3 + 1], r.nor[i * 3 + 2]).applyMatrix3(liveN).normalize(); nor.setXYZ(r.start + i, liveV.x, liveV.y, liveV.z);
        }
      }
      pos.needsUpdate = true; nor.needsUpdate = true;
    }
    live.dirty.clear();
  }
  function disposeLive(u: Unit): void {
    if (!u.live) return;
    for (const { mesh } of u.live.buckets) { mesh.removeFromParent(); mesh.geometry.dispose(); }
    for (const o of u.live.poses.values()) o.removeFromParent();
    u.live = null; u.block.dirty = true;
  }
  return {
    occluders,
    setContents(id, dolls) {
      const u = units.get(id);
      if (!u) return;
      u.rare = dolls.some((d) => d[11] === 'gold') ? 'gold' : dolls.some((d) => d[11]) ? 'rare' : '';
      u.contents = dolls; u.block.dirty = true;
      if (u.live) { // 한 판 중에 새 배치가 오면(판 끝 machine): 없어진 인형은 숨기고 자리를 맞춘다 (새 인형은 live가 끝난 뒤 무더기에)
        const uids = new Set(dolls.map(uidOf));
        for (const [uid, obj] of u.live.poses) if (!uids.has(uid)) { obj.visible = false; u.live.dirty.add(uid); }
        for (const d of dolls) { const o = u.live.poses.get(uidOf(d)); if (o && d[2] !== null) { o.position.set(d[1], d[2], d[3]); o.quaternion.set(d[4], d[5], d[6], d[7]); u.live.dirty.add(uidOf(d)); } }
      }
    },
    pileOf: (id) => units.get(id)?.baked ?? [],
    unsettled: (id) => (units.get(id)?.contents ?? []).filter((d) => d[2] === null),
    settleWith(id, poses) {
      const u = units.get(id);
      if (!u) return;
      const by = new Map(poses.map((p) => [p.uid, p]));
      this.setContents(id, u.contents.map((d) => {
        const p = by.get(uidOf(d));
        return p ? ([d[0], p.p[0], p.p[1], p.p[2], p.q[0], p.q[1], p.q[2], p.q[3], d[8], d[9], d[10], d[11], d[12]] as DollSpot) : d;
      }));
    },
    live(id) {
      const u = unit(id);
      if (!u.live) { u.live = buildLive(u); u.block.dirty = true; }
      const live = u.live;
      return {
        set(uid, p, q) {
          const o = live.poses.get(uid);
          if (!o || (o.position.x === p[0] && o.position.y === p[1] && o.position.z === p[2] && o.quaternion.x === q[0] && o.quaternion.y === q[1] && o.quaternion.z === q[2] && o.quaternion.w === q[3])) return; // 그대로면 꼭짓점을 다시 쓰지 않는다 (최종 리뷰 I6)
          o.position.set(p[0], p[1], p[2]); o.quaternion.set(q[0], q[1], q[2], q[3]); live.dirty.add(uid);
        },
        remove(uid) { const o = live.poses.get(uid); if (o) { o.visible = false; live.dirty.add(uid); } },
        dispose() { if (u.live === live) disposeLive(u); },
      };
    },
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
    pending() {
      return blocks.filter((b) => b.dirty).length;
    },
    hideControls(id, hidden) {
      const u = unit(id), spot = MACHINES.find((m) => m.id === id)!, j = u.row.spots.indexOf(spot);
      for (const mesh of controlRows.find((c) => c.row === u.row)!.meshes) {
        mesh.setMatrixAt(j, hidden ? HIDDEN : machineAt(spot));
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
    update(t) {
      const until = performance.now() + BUILD_MS;
      for (const block of blocks) if (block.dirty && performance.now() < until && warm(block, until)) rebuild(block); // 합치기도 시간이 남을 때만 — 한 프레임에 묶음 하나쯤
      for (const u of units.values()) refreshLive(u);
      for (const m of markRows) {
        const n = { rare: 0, gold: 0, twinkle: 0 };
        m.row.spots.forEach((spot, j) => {
          const u = units.get(spot.id)!;
          if (!u.rare) return;
          const mesh = m[u.rare], big = u.rare === 'gold' ? 1.3 : 1;
          markAt.compose(markPos.set(0, 2.62 + Math.sin(t * 2 + j) * 0.03, 0.3), markTurn.identity(), markSize.setScalar(big)).premultiply(machineAt(spot));
          mesh.setMatrixAt(n[u.rare]++, markAt);
          TWINKLE_SPOTS.forEach(([x, y, z], k) => {
            const pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 3 + j * 1.7 + k * 2.1)); // 제자리에서 커졌다 작아짐
            markAt.compose(markPos.set(x * big, y, z), markTurn.identity(), markSize.setScalar(pulse * big)).premultiply(machineAt(spot));
            m.twinkle.setMatrixAt(n.twinkle, markAt); m.twinkle.setColorAt(n.twinkle++, TWINKLE[u.rare as 'rare' | 'gold']);
          });
        });
        for (const key of ['rare', 'gold', 'twinkle'] as const) {
          const mesh = m[key];
          if (!n[key] && !mesh.count) continue;
          const changed = mesh.count !== n[key];
          mesh.count = n[key]; mesh.visible = n[key] > 0; mesh.instanceMatrix.needsUpdate = true;
          if (changed && n[key] > 0) mesh.computeBoundingSphere();
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
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
