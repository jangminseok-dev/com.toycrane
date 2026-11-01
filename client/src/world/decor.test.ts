import * as THREE from 'three';
import { beforeAll, expect, test, vi } from 'vitest';
import { DECOR, OBSTACLES } from '../data/storeLayout';
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
  const mats = (shelf.children as THREE.Mesh[]).map((m) => m.material as THREE.MeshBasicMaterial);
  expect(mats.some((m) => m.map && m.transparent)).toBe(true);
  expect(mats.filter((m) => m.side === THREE.BackSide)).toHaveLength(1);
});

// 진열장 인형(두 진열장 약 78마리, 6종)은 종마다 한 번만 짓고 복사한다 — 무더기용 판은 makePlush가 붙들지 않는다(최종 리뷰 I3)
test('shelves build each doll kind once', () => {
  vi.mocked(makeDoll).mockClear();
  buildDecor(new THREE.Scene());
  expect(vi.mocked(makeDoll).mock.calls.length).toBeLessThanOrEqual(6);
}, 60_000);
