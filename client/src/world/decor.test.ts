import * as THREE from 'three';
import { beforeAll, expect, test, vi } from 'vitest';
import { DECOR, OBSTACLES } from '../data/storeLayout';
import { CAMERA_OFFSETS } from '../game/followCamera';
import { OcclusionFader, type Occluder } from '../game/occlusion';
import { stubCanvas } from '../test/canvasStub';
import { buildDecor } from './decor';
import { makeDoll } from './dolls';

// 진짜 makeDoll을 감싸 부른 횟수만 센다
vi.mock('./dolls', async (importOriginal) => { const m = await importOriginal<typeof import('./dolls')>(); return { ...m, makeDoll: vi.fn(m.makeDoll) }; });

beforeAll(stubCanvas);

// 빈 미니·피규어 구역의 "준비 중" 장식: 몇 덩어리로 합쳐 그리고, 모두 걸어서 통과할 수 없는 장애물 (설계 2026-10-31 §3.8)
test('decor stays a few merged meshes and every piece is an obstacle', () => {
  const scene = new THREE.Scene();
  buildDecor(scene);
  let n = 0;
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; });
  expect(DECOR.length).toBeGreaterThanOrEqual(6);
  expect(n).toBeLessThanOrEqual(24);
  for (const d of DECOR) expect(OBSTACLES).toContainEqual(d.rect);
});

// 인형 리뉴얼: 진열장 인형도 그린 얼굴을 지킨다(얼굴 한 장 그림 재질), 새 외곽선은 앞을 덮는 껍질이 아니라 외곽선 덩어리로
test('shelf dolls keep their painted faces', () => {
  const scene = new THREE.Scene();
  buildDecor(scene);
  const shelf = scene.children.find((o) => o.name.startsWith('decor-shelf'))!;
  const mats = (shelf.children.filter((o) => (o as THREE.Mesh).isMesh) as THREE.Mesh[]).map((m) => m.material as THREE.MeshBasicMaterial); // 칸 표지(빈 물체)는 빼고
  expect(mats.some((m) => m.map && m.transparent)).toBe(true);
  expect(mats.filter((m) => m.side === THREE.BackSide)).toHaveLength(1);
});

// 진열장 인형(두 진열장 약 78마리, 6종)은 종마다 한 번만 짓고 복사한다 — 무더기용 판은 makePlush가 붙들지 않는다(최종 리뷰 I3)
test('shelves build each doll kind once', () => {
  vi.mocked(makeDoll).mockClear();
  buildDecor(new THREE.Scene());
  expect(vi.mocked(makeDoll).mock.calls.length).toBeLessThanOrEqual(6);
}, 60_000);

// 큰 홀(설계 2026-11-01 §3): 아직 없는 기계 자리마다 '준비 중' 덮개 기계 — 고리 10대, 미는 뽑기 4대, 쉼터 벤치.
// 피규어 구역은 9단계부터 진짜 기계(shared/store_layout.json figures)라 장식이 없다
test('every planned zone has covered machines: 10 ring, 4 pusher, no figure decor', () => {
  const scene = new THREE.Scene();
  buildDecor(scene);
  const count: Record<string, number> = {};
  scene.traverse((o) => { if (o.name.startsWith('decor-unit-')) { const k = o.name.slice('decor-unit-'.length); count[k] = (count[k] ?? 0) + 1; } });
  expect(count).toMatchObject({ ring: 10, pusher: 4 });
  expect(count.figure).toBeUndefined();
  expect(DECOR.every((d) => (d.kind as string) !== 'figure')).toBe(true);
  expect(count.bench).toBeGreaterThanOrEqual(2);
});

// 큰 홀 최종 리뷰 I2: 벽 너머까지 늘린 장애물 상자의 가운데가 아니라 앞면 바로 뒤에 선다 — 앞에 걸어갈 수 없는 빈틈(투명 벽)이 없게.
// 칸 가운데는 장애물 앞면에서 1.1m(가장 깊은 미는 뽑기의 반) 안
test('decor units stand right behind the front edge of their obstacle', () => {
  const scene = new THREE.Scene();
  buildDecor(scene);
  const marks: THREE.Object3D[] = [];
  scene.traverse((o) => { if (o.name.startsWith('decor-unit-')) marks.push(o); });
  expect(marks.length).toBeGreaterThan(15);
  for (const m of marks) {
    const d = DECOR.find((s) => m.position.x >= s.rect[0] && m.position.x <= s.rect[2] && m.position.z >= s.rect[1] && m.position.z <= s.rect[3])!;
    expect(d, m.name).toBeDefined();
    const fx = Math.round(Math.sin(d.ry)), fz = Math.round(Math.cos(d.ry)); // 앞쪽(±x 또는 ±z)
    const front = fx > 0 ? d.rect[2] - m.position.x : fx < 0 ? m.position.x - d.rect[0] : fz > 0 ? d.rect[3] - m.position.z : m.position.z - d.rect[1];
    expect(front, `${d.kind} ${m.position.x.toFixed(2)},${m.position.z.toFixed(2)}`).toBeLessThanOrEqual(1.1 + 1e-6);
  }
});

// 큰 홀 최종 리뷰 I1: 종류마다 한 무리로 합쳐도, 흐려지는 건 실제로 나를 가린 줄뿐 — 고리 두 줄 사이 길이나 입구 길에 서면 아무것도 안 흐려진다
test('decor fades only when a row really hides me', () => {
  const occluders = buildDecor(new THREE.Scene()), kinds = [...new Set(DECOR.map((d) => d.kind))];
  const fadeAt = (o: Occluder, at: { x: number; z: number }) => {
    let v = 1;
    const fader = new OcclusionFader([{ ...o, setOpacity: (x: number) => { v = x; } }]);
    const eye = new THREE.Vector3(at.x, 0, at.z).add(CAMERA_OFFSETS.WIDE);
    for (let i = 0; i < 30; i++) fader.update(0.1, eye, at);
    return v;
  };
  const ring = occluders[kinds.indexOf('ring')], pusher = occluders[kinds.indexOf('pusher')], shelf = occluders[kinds.indexOf('shelf')];
  expect(fadeAt(ring, { x: 0, z: -21 })).toBe(1); // 고리 두 줄 사이 길
  expect(fadeAt(shelf, { x: 0, z: 19 })).toBe(1); // 입구 길(두 진열장 사이)
  expect(fadeAt(pusher, { x: 0, z: -18.3 })).toBeLessThan(0.5); // 미는 뽑기 줄 바로 뒤 — 가려지면 흐려진다
});

// 덮개·안내 카드가 없는 장식(벤치·진열장)에 빈 add()를 부르면 three.js가 콘솔 오류를 낸다 — 매장 화면 콘솔은 깨끗해야 한다(e2e)
test('building decor logs no three.js errors', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  buildDecor(new THREE.Scene());
  const calls = spy.mock.calls.map((c) => String(c[0]));
  spy.mockRestore();
  expect(calls).toEqual([]);
});
