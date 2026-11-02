import * as THREE from 'three';
import { beforeAll, expect, test, vi } from 'vitest';
import { DOLLS } from '../data/catalog';
import { MACHINES } from '../data/storeLayout';
import { PUSHER, PUSHERS, plateFront } from '../data/pushers';
import { uidOf } from '../net/protocol';
import { stubCanvas } from '../test/canvasStub';
import { LITE_CACHE_MAX, buildBigZone, liteCacheSize } from './bigZone';
import { CONTROLS } from './machine';
import { PLAIN, makeDoll } from './dolls';
import { spot } from '../test/spots';

beforeAll(stubCanvas);
// 새 겉모습은 프레임마다 나눠 지으므로(최종 리뷰 I1) 다 지을 때까지 돌린다
const fill = (zone: ReturnType<typeof buildBigZone>, t = 0) => { for (let i = 0; i < 5000; i++) { zone.update(t); if (!zone.pending()) return; } };

test('big zone builds 24 machines in two fade rows', () => {
  const zone = buildBigZone(new THREE.Scene());
  expect(zone.occluders).toHaveLength(4); // 큰 홀: 서쪽 세 줄(d1·d2·d3) + 미는 뽑기 한 줄(p1)
  expect(MACHINES.every((m) => zone.worldOf(m.id))).toBe(true);
});

test('setContents skips unknown dolls', () => {
  const zone = buildBigZone(new THREE.Scene());
  expect(() => {
    zone.setContents('A-1', [spot('bunny', 0, 0, 0), spot('gone-doll', 0.1, 0.1, 0)]);
    fill(zone);
  }).not.toThrow();
});

// 겨냥 고리: 집게를 따라 바닥에 비치고, 하는 동안에만 보인다
test('aim ring follows the claw and starts hidden', () => {
  const zone = buildBigZone(new THREE.Scene());
  const aim = zone.clawOf('C-6').getObjectByName('aim')!;
  expect(aim.visible).toBe(false);
  zone.showAim('C-6', true);
  expect(aim.visible).toBe(true);
});

// 기계 하나 결과마다 행 전체(섬 99개 인형)를 다시 합치면 휴대폰이 멈춘다 — 그 기계가 든 묶음만 다시 합친다 (최종 리뷰 I5)
test('a contents change rebuilds only its block of machines', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  for (const m of MACHINES) zone.setContents(m.id, [spot('bear', 0, 0, 0)]);
  fill(zone);
  const groups: THREE.Object3D[] = [];
  scene.traverse((o) => { if (o.name.startsWith('dolls-')) groups.push(o); });
  const blocks = () => groups.map((b) => b.children.slice());
  const before = blocks();
  zone.setContents('C-6', [spot('cat', 0.1, 0.1, 0)]);
  zone.update(0.1);
  const after = blocks();
  const changed = before.filter((meshes, i) => meshes.some((m, k) => m !== after[i][k]));
  expect(changed).toHaveLength(1);
  expect(groups.length).toBe(8); // 큰 홀: 세 줄 × 8대 → 줄마다 2묶음 (6대 이하씩) + 미는 뽑기 4대 → 2묶음(2대씩)
});

// 서버가 정한 얹힌 높이(y)대로 그린다 — 위층 인형이 바닥 인형보다 높이 있다
test('dolls are drawn at their resting height', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  zone.setContents('C-6', [spot('bear', 0, 0, 0, 0.22)]);
  fill(zone);
  const box = new THREE.Box3();
  scene.traverse((o) => { if (o.name.startsWith('dolls-')) box.expandByObject(o); });
  expect(box.min.y).toBeGreaterThan(0.87 + 0.15);
});

// 하는 기계에서만 움직이는 집게로 바꿔 끼우고, 끝나면 쉬는 집게로 돌려놓는다(35대 모두 움직이는 집게면 휴대폰이 무겁다)
test('a machine borrows the moving claw while in use', () => {
  const zone = buildBigZone(new THREE.Scene());
  const idle = zone.clawOf('C-6').getObjectByName('idle-claw')!;
  const rig = zone.activateClaw('C-6');
  expect(idle.visible).toBe(false);
  expect(rig.root.parent).toBe(zone.clawOf('C-6'));
  zone.releaseClaw('C-6');
  expect(idle.visible).toBe(true);
  expect(rig.root.parent).toBeNull();
});

// 간판 전구가 켜졌다 꺼지며 돈다 (행마다 인스턴싱 한 덩어리)
test('marquee bulbs chase around over time', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  const bulbs = scene.getObjectByName('bulbs-big-d3') as THREE.InstancedMesh;
  fill(zone);
  const a = Array.from(bulbs.instanceColor!.array);
  zone.update(0.2);
  expect(Array.from(bulbs.instanceColor!.array)).not.toEqual(a);
});

// 간판 전구는 2.4cm짜리라 각진 작은 구로 충분하다 — 35대 × 58개 (최종 리뷰 I5)
test('marquee bulbs are cheap little gems', () => {
  const scene = new THREE.Scene();
  buildBigZone(scene);
  const bulbs = scene.getObjectByName('bulbs-big-d3') as THREE.InstancedMesh;
  const geo = bulbs.geometry;
  expect((geo.index ? geo.index.count : geo.attributes.position.count) / 3).toBeLessThanOrEqual(40);
});

// 내가 하는 기계에는 움직이는 레버·하강 버튼(machineControls)을 따로 그린다. 기계 그림의 고정 레버·버튼이 그 밑에 남으면
// 레버를 기울이거나 버튼을 누를 때 원래 자리에 하나가 더 보인다(잔상) — 하는 동안 그 기계의 고정 레버·버튼은 숨는다
test('the lever and drop button of the machine I play are not drawn twice', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  scene.updateMatrixWorld(true);
  const id = MACHINES[3].id;
  const ballAt = zone.worldOf(id).localToWorld(new THREE.Vector3(CONTROLS.lever[0], CONTROLS.lever[1] + 0.1, CONTROLS.lever[2]));
  const domeAt = zone.worldOf(id).localToWorld(new THREE.Vector3(...CONTROLS.drop));
  expect([redNear(scene, ballAt), redNear(scene, domeAt)]).toEqual([1, 1]);
  zone.hideControls(id, true);
  expect([redNear(scene, ballAt), redNear(scene, domeAt)]).toEqual([0, 0]);
  zone.hideControls(id, false);
  expect([redNear(scene, ballAt), redNear(scene, domeAt)]).toEqual([1, 1]);
});

// p에서 5cm 안에 꼭짓점이 있는 빨간(레버 공·하강 버튼 색) 그림의 수 — 여러 기계가 든 InstancedMesh는 기계마다 따로 센다
function redNear(scene: THREE.Scene, p: THREE.Vector3): number {
  let n = 0;
  const v = new THREE.Vector3(), m = new THREE.Matrix4();
  const near = (pos: THREE.BufferAttribute, world: THREE.Matrix4) => {
    for (let i = 0; i < pos.count; i++) if (v.fromBufferAttribute(pos, i).applyMatrix4(world).distanceTo(p) < 0.05) return true;
    return false;
  };
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const mat = mesh.material as THREE.MeshToonMaterial | undefined;
    if (!mesh.isMesh || !mat?.color || mat.color.getHex() !== 0xff3b5c) return;
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      const inst = mesh as THREE.InstancedMesh;
      for (let k = 0; k < inst.count; k++) { inst.getMatrixAt(k, m); if (near(pos, m.premultiply(inst.matrixWorld))) n++; }
    } else if (near(pos, mesh.matrixWorld)) n++;
  });
  return n;
}

// ---- 인형 변형 (설계 2026-10-31 인형 채우기 §4.1·§4.4, 제약 §5: 휴대폰 그리기 호출이 늘지 않게) ----
const nineDolls = (kind: string, color: number) =>
  Array.from({ length: 9 }, (_, i) => spot(kind, -0.3 + (i % 3) * 0.25, -0.25 + Math.floor(i / 3) * 0.22, i, 0, { color, face: i % 5 }));
const materialsIn = (scene: THREE.Scene, name: string) => new Set(scene.getObjectByName(name)!.children.map((c) => (c as THREE.Mesh).material)).size;

test('six machines of different colors still bake into few materials', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  for (const [k, m] of MACHINES.slice(0, 6).entries()) zone.setContents(m.id, nineDolls(m.kind, k % 6));
  fill(zone);
  expect(materialsIn(scene, 'dolls-big-d1-0')).toBeLessThanOrEqual(6);
});

// 물리 뽑기 설계 §4.5·§9.2: 안 앉은 인형(y null)은 물리가 앉힐 차례이고, 앉힌 자리·돌림을 입히면 y가 채워진다
test('unsettled dolls are listed and settleWith fills their poses', () => {
  const zone = buildBigZone(new THREE.Scene());
  const dolls = [spot('octopus', 0, 0, 0, 0), spot('octopus', 0.2, 0.1, 0, null), spot('octopus', -0.2, 0.1, 0, null)];
  zone.setContents('C-6', dolls);
  expect(zone.unsettled('C-6').map((d) => d[12])).toEqual([dolls[1][12], dolls[2][12]]);
  zone.settleWith('C-6', [{ uid: dolls[1][12], p: [0.21, 0.9, 0.11], q: [0, 0.707, 0, 0.707] }]);
  expect(zone.unsettled('C-6').map((d) => d[12])).toEqual([dolls[2][12]]);
  const settled = zone.contentsOf('C-6').find((d) => d[12] === dolls[1][12])!;
  expect(settled.slice(1, 8)).toEqual([0.21, 0.9, 0.11, 0, 0.707, 0, 0.707]);
});

// 한 판 동안 그 기계의 인형은 무더기에서 빠져 따로 그려지고(자세를 매 프레임 입힌다), 끝나면 무더기로 돌아간다
test('live mode draws a machine\'s dolls one by one and returns them to the pile', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  const dolls = nineDolls('octopus', 0);
  zone.setContents('C-6', dolls);
  fill(zone);
  expect(zone.pileOf('C-6')).toHaveLength(9);
  const live = zone.live('C-6');
  zone.update(0.1);
  expect(zone.pileOf('C-6')).toHaveLength(0);
  const uid = dolls[3][12];
  live.set(uid, [0.1, 1.5, 0.2], [0, 0, 0, 1]);
  let found: THREE.Object3D | undefined;
  scene.traverse((o) => { if (o.userData.uid === uid) found = o; });
  expect(found!.position.y).toBeCloseTo(1.5);
  live.remove(uid); // 구멍에 빠진 인형: 숨긴다 (꼭짓점 범위가 0으로 접힌다)
  expect(found!.visible).toBe(false);
  live.dispose();
  zone.update(0.2);
  expect(zone.pileOf('C-6')).toHaveLength(9);
});

// 희귀가 든 기계 위에는 '★ 희귀'/'★★ 황금' 이름표와 제자리 별 반짝임 — 날벌레처럼 도는 점은 없다 (교환소 개편 설계 §4.7.1)
test('machines holding a rare show a name tag and twinkles above them', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  const count = (prefix: string) => { let n = 0; scene.traverse((o) => { if (o.name.startsWith(prefix) && o.visible) n += (o as THREE.InstancedMesh).count; }); return n; };
  zone.setContents('A-1', [spot('bunny', 0, 0, 0, 0, { rare: 'star' })]);
  fill(zone);
  expect([count('rare-tags-rare'), count('rare-tags-gold')]).toEqual([1, 0]);
  expect(count('rare-twinkles')).toBe(3);
  zone.setContents('A-2', [spot('fox', 0, 0, 0, 0, { rare: 'gold' })]);
  zone.update(0.1);
  expect([count('rare-tags-rare'), count('rare-tags-gold')]).toEqual([1, 1]);
  zone.setContents('A-1', [spot('bunny', 0, 0, 0)]);
  zone.setContents('A-2', [spot('fox', 0, 0, 0)]);
  zone.update(0.2);
  expect(count('rare-tags') + count('rare-twinkles')).toBe(0);
  expect(scene.getObjectByName('rare-sparkles-big-d1')).toBeUndefined();
});

test('chubby dolls are drawn wider', () => {
  const width = (body: 'n' | 'c' | 's') => {
    const scene = new THREE.Scene();
    const zone = buildBigZone(scene);
    zone.setContents('C-6', [spot('bear', 0, 0, 0, 0, { body })]);
    fill(zone);
    return new THREE.Box3().setFromObject(scene.getObjectByName('dolls-big-d3-0')!).getSize(new THREE.Vector3()).z; // 큰 홀: 기계가 +x를 보니 인형 폭(기계 안 x)은 세계 z
  };
  expect(width('c')).toBeGreaterThan(width('n') * 1.08);
  expect(width('s')).toBeLessThan(width('n') * 0.94);
});

// 다람쥐는 줄무늬 그림이 있어도 색마다 재질이 따로 생기지 않는다 — 무늬는 무채색 한 장, 색은 꼭짓점 색으로 (최종 리뷰 I2)
test('squirrels of every color share one striped material', () => {
  const count = (colors: number[]) => {
    const scene = new THREE.Scene();
    const zone = buildBigZone(scene);
    zone.setContents('A-10', colors.map((c, i) => spot('squirrel', -0.3 + (i % 3) * 0.25, -0.25 + Math.floor(i / 3) * 0.22, i, 0, { color: c })));
    fill(zone);
    return materialsIn(scene, 'dolls-big-d2-0');
  };
  expect(count([0, 1, 2, 3, 4, 5])).toBe(count([0, 0, 0, 0, 0, 0]));
});

// 인형 겉모습마다 합쳐 둔 모양은 끝없이 쌓이지 않는다 — 오래 하면 휴대폰 메모리가 넘친다 (최종 리뷰 M7)
test('baked doll shapes are kept to a bounded number', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  const kinds = MACHINES.map((m) => m.kind);
  for (let round = 0; round < 60; round++) {
    zone.setContents('C-6', Array.from({ length: 9 }, (_, i) => spot(kinds[(round * 9 + i) % kinds.length], (i % 3) * 0.2 - 0.2, Math.floor(i / 3) * 0.2 - 0.2, 0, 0, { color: (round + i) % 6, face: Math.floor(round / 6) % 5 })));
    fill(zone, round);
  }
  expect(liteCacheSize()).toBeLessThanOrEqual(LITE_CACHE_MAX);
  expect(LITE_CACHE_MAX).toBeLessThan(500);
});

// 최종 리뷰 C1: 한 기계가 live 모드여도 같은 묶음의 다른 기계 인형은 그대로 그려지고, 묶음이 매 프레임 다시 합쳐지지 않는다
test('live mode on one machine leaves the rest of its block drawn', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  for (const id of ['C-1', 'C-2', 'C-3', 'C-4', 'C-5', 'C-6']) zone.setContents(id, nineDolls('octopus', 0));
  fill(zone);
  const block = scene.getObjectByName('dolls-big-d2-1')!; // 큰 홀: C-1·C-2·C-3은 d2 둘째 묶음
  const before = block.children.length;
  expect(before).toBeGreaterThan(0);
  const live = zone.live('C-3');
  zone.update(0.1);
  expect(block.children.length).toBe(before);
  const meshes = block.children.slice();
  zone.update(0.2);
  expect(block.children).toEqual(meshes); // 다시 합치지 않았다
  expect(zone.pileOf('C-3')).toHaveLength(0);
  expect(zone.pileOf('C-2')).toHaveLength(9);
  live.dispose();
});

// 최종 리뷰 I6: live 덩어리는 유리 칸 크기의 경계 구로 화면 밖이면 걸러지고, 같은 자세를 다시 넣으면 꼭짓점을 다시 올리지 않는다
test('live meshes are frustum culled and unchanged poses are not re-uploaded', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  const dolls = nineDolls('octopus', 0);
  zone.setContents('C-6', dolls);
  fill(zone);
  const live = zone.live('C-6');
  zone.update(0.1);
  const uid = dolls[3][12];
  let obj: THREE.Object3D | undefined;
  scene.traverse((o) => { if (o.userData.uid === uid) obj = o; });
  const meshes = obj!.parent!.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh && (o.geometry.getAttribute('position') as THREE.BufferAttribute).usage === THREE.DynamicDrawUsage);
  expect(meshes.length).toBeGreaterThan(0);
  for (const m of meshes) { expect(m.frustumCulled).toBe(true); expect(m.geometry.boundingSphere).not.toBeNull(); }
  const version = () => meshes.map((m) => (m.geometry.getAttribute('position') as THREE.BufferAttribute).version);
  const before = version();
  live.set(uid, [obj!.position.x, obj!.position.y, obj!.position.z], [obj!.quaternion.x, obj!.quaternion.y, obj!.quaternion.z, obj!.quaternion.w]);
  zone.update(0.2);
  expect(version()).toEqual(before);
  // 눈에 안 보이는 떨림(0.3mm·아주 작은 돌림)도 다시 쓰지 않는다 — 깬 미는 뽑기 무더기 26개가 매 프레임 꼭짓점을 다시 써 휴대폰에서 멈칫했다
  const tiny = new THREE.Quaternion(obj!.quaternion.x, obj!.quaternion.y, obj!.quaternion.z, obj!.quaternion.w).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.002));
  live.set(uid, [obj!.position.x + 0.0003, obj!.position.y, obj!.position.z], [tiny.x, tiny.y, tiny.z, tiny.w]);
  zone.update(0.25);
  expect(version()).toEqual(before);
  live.set(uid, [obj!.position.x, obj!.position.y + 0.1, obj!.position.z], [obj!.quaternion.x, obj!.quaternion.y, obj!.quaternion.z, obj!.quaternion.w]);
  zone.update(0.3);
  expect(version()).not.toEqual(before);
  live.dispose();
});

// Review Focus 3: 24종·5표정·희귀가 섞여도 한 묶음 재질 ≤ 6 (인형 리뉴얼 설계 §7)
test('a block mixing every kind, face and rarity keeps few materials', () => {
  const scene = new THREE.Scene(), zone = buildBigZone(scene);
  const kinds = Object.keys(DOLLS);
  for (const [k, m] of MACHINES.slice(0, 6).entries())
    zone.setContents(m.id, Array.from({ length: 9 }, (_, i) => spot(kinds[(k * 9 + i) % kinds.length], -0.3 + (i % 3) * 0.25, -0.25 + Math.floor(i / 3) * 0.22, i, 0, { color: i % 6, face: i % 5, rare: i === 4 ? 'star' : '' })));
  fill(zone);
  expect(materialsIn(scene, 'dolls-big-d1-0')).toBeLessThanOrEqual(6);
});
// Review Focus 5: 처음 들어올 때 기계 하나(9마리, 서로 다른 겉모습) lite 만들기 200ms 이하
test('building one machine of fresh lite dolls is quick', () => {
  const t0 = performance.now();
  Object.keys(DOLLS).slice(0, 9).forEach((id, i) => makeDoll(id, { ...PLAIN, color: (i + 2) % 6, face: (i + 3) % 5 }, true));
  expect(performance.now() - t0).toBeLessThan(200);
});

// 매장 입장(최종 리뷰 I1): 새 겉모습 216마리를 한 프레임에 지으면 휴대폰이 3초 넘게 멈춘다 — 프레임마다 조금씩 짓고 다 지은 묶음부터 합친다.
// 첫 프레임은 얼굴 그림 같은 한 번뿐인 준비가 들어 있어 빼고, 그 뒤 프레임마다 인형 하나·묶음 하나쯤만
test('a store full of new looks is built a little each frame', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  const kinds = Object.keys(DOLLS);
  MACHINES.forEach((m, i) => zone.setContents(m.id, Array.from({ length: 9 }, (_, k) => spot(kinds[(i + k) % kinds.length], (k % 3) * 0.2 - 0.2, Math.floor(k / 3) * 0.2 - 0.2, 0, 0, { color: (i + k) % 6, face: 1 + (k % 4) }))));
  zone.update(0);
  expect(zone.pending()).toBeGreaterThan(0);
  let frames = 1, worst = 0;
  while (zone.pending() && frames < 5000) { const t0 = performance.now(); zone.update(frames / 60); worst = Math.max(worst, performance.now() - t0); frames++; }
  expect(zone.pending()).toBe(0);
  expect(frames).toBeGreaterThan(10);
  expect(worst).toBeLessThan(150);
  let drawn = 0;
  scene.traverse((o) => { if (o.name.startsWith('dolls-')) drawn += o.children.length; });
  expect(drawn).toBeGreaterThan(0);
}, 120_000);

// 왕관 달린 인형(희귀·황금·효과)도 무더기에서 재질별로 빠짐없이 합쳐진다 — 왕관 도형만 uv가 없어 합치기가 실패하고 그 재질 덩어리가 통째로 빠졌다 (배포 뒤 콘솔 오류)
test('crowned dolls bake into the pile without dropping a material', () => {
  const err = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const zone = buildBigZone(new THREE.Scene());
    zone.setContents('C-6', ['star', 'gold', 'galaxy'].map((rare, i) => spot('octopus', -0.2 + i * 0.2, 0, 0, 0, { rare, color: 5, face: 4 })));
    fill(zone);
    expect(err.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('mergeGeometries'))).toEqual([]);
  } finally { err.mockRestore(); }
}, 60_000);

// 큰 홀(설계 2026-11-01): 기계 줄은 배치 데이터의 row에서 — 서쪽 세 줄(d1·d2·d3), 묶음마다 6대 이하. 미는 뽑기는 한 줄(p1), 두 대씩
test('rows come from the layout, three doll rows of at most six per block', () => {
  const scene = new THREE.Scene();
  buildBigZone(scene);
  const blocks: string[] = [];
  scene.traverse((o) => { if (o.name.startsWith('dolls-big-')) blocks.push(o.name); });
  expect(new Set(blocks.map((n) => n.split('-')[2]))).toEqual(new Set(['d1', 'd2', 'd3', 'p1']));
  expect(blocks.filter((n) => !n.includes('-p1-'))).toHaveLength(6);
  expect(blocks.filter((n) => n.includes('-p1-'))).toHaveLength(2);
});

// 큰 홀(설계 2026-11-01 §6): 기계 앞 화면(내 기계는 광장 쪽 +x를 봄)에서는 내 기계보다 뒤(서쪽)에 있는 줄을 숨긴다 —
// 기계에 가려 거의 안 보이는데 그리기 호출을 100개 가까이 써서 휴대폰 기계 앞 기준(160)을 넘었다
test('while playing a machine, rows behind it are hidden and come back after', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  const visible = () => ['d1', 'd2', 'd3'].map((r) => scene.getObjectByName(`big-${r}`)!.visible);
  zone.hideRowsBehind('C-6'); // C-6은 광장 쪽 줄(d3)
  expect(visible()).toEqual([false, false, true]);
  zone.hideRowsBehind('A-9'); // A-9는 가운데 줄(d2)
  expect(visible()).toEqual([false, true, true]);
  zone.hideRowsBehind(null);
  expect(visible()).toEqual([true, true, true]);
});

// 큰 홀(설계 2026-11-01 §6): 내 자리에서 먼(18m 넘게) 묶음은 인형 외곽선 덩어리를 그리지 않는다 — 몇 픽셀 크기라 티가 안 나고 삼각형은 절반 가까이 준다
test('blocks far from the focus drop their doll outlines and bring them back when near', () => {
  const scene = new THREE.Scene();
  const zone = buildBigZone(scene);
  zone.setContents('A-1', nineDolls('bear', 0));
  fill(zone);
  const block = scene.getObjectByName('dolls-big-d1-0')!;
  const outlines = () => (block.children as THREE.Mesh[]).filter((m) => (m.material as THREE.Material).side === THREE.BackSide);
  expect(outlines().length).toBeGreaterThan(0);
  zone.setFocus(30, 0);
  expect(outlines().every((m) => !m.visible)).toBe(true);
  zone.setFocus(-16, 0);
  expect(outlines().every((m) => m.visible)).toBe(true);
  zone.setFocus(30, 0);
  zone.setContents('A-1', nineDolls('cat', 1)); fill(zone); // 다시 합쳐도 먼 상태를 지킨다
  expect(outlines().length).toBeGreaterThan(0);
  expect(outlines().every((m) => !m.visible)).toBe(true);
});


// 미는 뽑기(설계 ring-hook §4): 기계 속 미니 인형은 24종이 섞여 작게(doll_scale) 그려진다
test('pusher dolls are small and mixed', () => {
  const scene = new THREE.Scene(), zone = buildBigZone(scene);
  const kinds = Object.keys(DOLLS);
  const mixed = kinds.slice(0, 12).map((k, i) => spot(k, -0.05 + (i % 4) * 0.12, -0.3 + Math.floor(i / 4) * 0.2, i, 0));
  zone.setContents('P-1', mixed);
  fill(zone);
  expect(zone.pileOf('P-1')).toEqual(mixed.map(uidOf));
  // 같은 곰 하나를 인형 기계와 미는 뽑기에 — 높이 비가 크기 비(0.18 / 0.3)
  const heights = () => {
    const out: number[] = [];
    scene.traverse((o) => { if (o.name.startsWith('dolls-') && o.children.length) out.push(new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).y); });
    return out;
  };
  zone.setContents('P-1', []);
  zone.setContents('P-3', [spot('bear', 0.2, 0, 0, 0)]);
  zone.setContents('A-1', [spot('bear', 0, 0, 0, 0)]);
  fill(zone);
  const [a, b] = heights();
  expect(Math.min(a, b) / Math.max(a, b)).toBeCloseTo(PUSHER.doll_scale / 0.3, 1);
}, 60_000);

// 휴대폰 관문: 미는 뽑기 네 대(섞인 미니 인형 28개씩)를 다 채워도 인형 기계 한 줄(8대)보다 그리기 호출이 많지 않다
test('four pusher machines draw within the phone budget', () => {
  const scene = new THREE.Scene(), zone = buildBigZone(scene);
  const kinds = Object.keys(DOLLS);
  PUSHERS.forEach((p, k) => zone.setContents(p.id, Array.from({ length: 28 }, (_, i) => spot(kinds[(k * 7 + i) % kinds.length], -0.05 + (i % 7) * 0.07, -0.3 + Math.floor(i / 7) * 0.15, i, 0, { color: i % 6, face: i % 5, rare: k === 0 && i === 3 ? 'star' : '' }))));
  MACHINES.filter((m) => m.row === 'd1').forEach((m, k) => zone.setContents(m.id, nineDolls(m.kind, k % 6)));
  fill(zone);
  const draws = (name: string) => { let n = 0; scene.getObjectByName(name)!.traverseVisible((o) => { if ((o as THREE.Mesh).isMesh || (o as THREE.LineSegments).isLineSegments) n++; }); return n; };
  expect(draws('big-p1')).toBeGreaterThan(0);
  expect(draws('big-p1')).toBeLessThanOrEqual(draws('big-d1'));
  // 삼각형도: 미니 인형 112개(낮은 면)가 인형 기계 한 줄(72개)보다 가볍다 — 휴대폰 걷기 180만 관문
  const tris = (name: string) => { let n = 0; scene.getObjectByName(name)!.traverseVisible((o) => { const m = o as THREE.Mesh; if (m.isMesh) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3 * ((m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1); }); return n; };
  expect(tris('big-p1')).toBeLessThanOrEqual(tris('big-d1'));
}, 120_000);

// 미는 판은 판 사이에도 벽시계(모든 화면이 같은 박자)로 턱 깊이의 3분의 1을 오가고, 한 판 중엔 그 화면의 물리 판 자리를 따른다
test('pusher plates slide with the clock and follow the world while playing', () => {
  vi.useFakeTimers();
  try {
    const scene = new THREE.Scene(), zone = buildBigZone(scene);
    const plates = scene.getObjectByName('pusher-plates-big-p1') as THREE.InstancedMesh;
    const m = new THREE.Matrix4(), at = new THREE.Vector3();
    const front = (i: number) => { plates.getMatrixAt(i, m); at.setFromMatrixPosition(m); return at.z - PUSHERS[i].z; }; // 판 도형은 앞면이 원점(미는 뽑기는 ry 0)
    vi.setSystemTime(0); zone.update(0);
    expect(front(0)).toBeCloseTo(plateFront(0), 3);
    vi.setSystemTime(1500); zone.update(1.5);
    expect(front(0)).toBeCloseTo(plateFront(1.5), 3);
    zone.plateAt('P-2', -0.1); zone.update(1.6);
    expect(front(1)).toBeCloseTo(-0.1, 3);
    expect(front(0)).toBeCloseTo(plateFront(1.5), 3);
    zone.plateAt('P-2', null); zone.update(1.7);
    expect(front(1)).toBeCloseTo(plateFront(1.5), 3);
  } finally { vi.useRealTimers(); }
});

// 미니 인형 외곽선은 10m 안에서만(인형 기계는 18m) — 높이 빠진 걷기 카메라에선 1픽셀도 안 되는데 삼각형은 미는 뽑기 줄의 절반이다
test('pusher blocks drop their mini doll outlines sooner', () => {
  const scene = new THREE.Scene(), zone = buildBigZone(scene);
  zone.setContents('P-1', nineDolls('bear', 0));
  fill(zone);
  const block = scene.getObjectByName('dolls-big-p1-0')!;
  const outlines = () => (block.children as THREE.Mesh[]).filter((m) => (m.material as THREE.Material).side === THREE.BackSide);
  const p = PUSHERS[0], q = PUSHERS[1], cx = (p.x + q.x) / 2;
  zone.setFocus(cx, p.z + 8);
  expect(outlines().length).toBeGreaterThan(0);
  expect(outlines().every((m) => m.visible)).toBe(true);
  zone.setFocus(cx, p.z + 13); // 인형 기계라면 아직 그리는 거리
  expect(outlines().every((m) => !m.visible)).toBe(true);
});
