import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { MACHINES } from '../data/storeLayout';
import { stubCanvas } from '../test/canvasStub';
import { bakeByMaterial } from './bake';
import { HOLE, MACHINE_COLORS, bulbSpots, makeMachineParts } from './machine';

beforeAll(stubCanvas);

// 밝은 게임센터: 기계마다 원색 몸통 (설계 2026-10-31 §4.1)
test('each machine body takes its colour from the palette', () => {
  const parts = makeMachineParts(MACHINES[3], 3);
  const cab = parts.statics.getObjectByName('cabinet') as THREE.Mesh;
  expect((cab.material as THREE.MeshToonMaterial).color.getHex()).toBe(MACHINE_COLORS[3]);
});

// 예전 어두운 매장 시절의 체크무늬 삼각 깃발(ShapeGeometry)은 뺀다
test('the old chequered flags are gone', () => {
  for (let i = 0; i < 4; i++) {
    const shapes: THREE.Object3D[] = [];
    makeMachineParts(MACHINES[i], i).statics.traverse((o) => { if ((o as THREE.Mesh).geometry?.type === 'ShapeGeometry') shapes.push(o); });
    expect(shapes).toHaveLength(0);
  }
});

test('bulbs ring the marquee', () => {
  const spots = bulbSpots();
  expect(spots.length).toBeGreaterThanOrEqual(30);
  expect(spots.length).toBeLessThanOrEqual(60);
});

// 디테일이 늘어도 행마다 재질 단위로 합치면 그리기 호출이 적게 남아야 한다 —
// 기계마다 다른 그림(간판·번호판·안내 카드) 3개 말고는 모두 같은 재질을 나눠 쓴다
test('six machines bake into a small number of materials', () => {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) g.add(makeMachineParts(MACHINES[i], i).statics);
  expect(bakeByMaterial(g).length).toBeLessThanOrEqual(30 + 3 * 6);
});

// 휴대폰: 기계 35대라 한 대의 삼각형 수가 그대로 곱해진다 — 둥근 상자 마디·외곽선이 과하지 않게 (최종 리뷰 I5)
test('one machine stays light in triangles', () => {
  let tris = 0;
  makeMachineParts(MACHINES[0], 0).statics.traverse((o) => {
    const geo = (o as THREE.Mesh).geometry;
    if ((o as THREE.Mesh).isMesh && geo) tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
  });
  expect(tris).toBeLessThan(9000);
});

// 물리 뽑기 설계 §9.3: 구멍은 34cm 네모, 둘레는 6cm 낮은 턱 (20cm 가림막은 '조금 들어서 넘기기'를 막았다)
test('the prize hole has a low lip', () => {
  expect(HOLE).toEqual({ size: 0.34, lip: 0.06 });
  const statics = makeMachineParts(MACHINES[0], 0).statics;
  let lip: THREE.Mesh | undefined;
  statics.traverse((o) => { const g = (o as THREE.Mesh).geometry as THREE.BoxGeometry | undefined; if (g?.type === 'BoxGeometry' && g.parameters.width === 0.34 && g.parameters.depth === 0.34) lip = o as THREE.Mesh; });
  expect((lip!.geometry as THREE.BoxGeometry).parameters.height).toBeCloseTo(0.06);
});
