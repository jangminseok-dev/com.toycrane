import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { DOLLS } from '../data/catalog';
import { FIGURE, FIGURES, variantOf, guardsOf } from '../data/figures';
import { CAMERA_OFFSETS } from '../game/followCamera';
import { OcclusionFader, type Occluder } from '../game/occlusion';
import type { BoxWire } from '../net/protocol';
import { drawnTexts, stubCanvas } from '../test/canvasStub';
import { buildFigureZone } from './figureZone';

beforeAll(stubCanvas);
const LYING: BoxWire = [0, FIGURE.bars.y + FIGURE.bars.radius + variantOf('long').box.d / 2, 0, 0, 0, 0, 1];

// 9단계 피규어 기계 그림(그래픽 설계 §3.5): 14대를 줄마다 합쳐 그리고, 상자·집게·버튼은 인스턴스로 — 메시 64개 이하(받침 막대·뒤 벽 재질 포함, 설계 §8)
test('fourteen figure machines draw in a few meshes', () => {
  const scene = new THREE.Scene(), zone = buildFigureZone(scene);
  let n = 0;
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; });
  expect(n).toBeLessThanOrEqual(64);
  for (const f of FIGURES) {
    const a = zone.worldOf(f.id);
    expect([a.position.x, a.position.z, a.rotation.y]).toEqual([f.x, f.z, f.ry]);
  }
});

// 상자는 모두 같은 랜덤 상자 그림 — 겉으로 캐릭터를 알 수 없다(설계 §4). 그림은 한 번만 그려 함께 쓰므로 이 파일에서 그린 글씨 전체를 본다
test('every box shows the same blind box art', () => {
  buildFigureZone(new THREE.Scene());
  expect(drawnTexts).toContain('toycrane 피규어 컬렉션');
  const names = Object.values(DOLLS).map((d) => d.name);
  expect(drawnTexts.filter((t) => names.some((nm) => t.includes(nm)))).toEqual([]);
});

test('setBox moves the box of that machine only', () => {
  const zone = buildFigureZone(new THREE.Scene());
  const before = zone.boxOf('F-2');
  zone.setBox('F-3', [0.02, LYING[1], -0.03, 0, 0, 0, 1]);
  expect(zone.boxOf('F-3')).toEqual([0.02, LYING[1], -0.03, 0, 0, 0, 1]);
  expect(zone.boxOf('F-2')).toEqual(before);
});

// 줄마다 가림막이지만 기계마다 상자 — 두 줄 사이 통로에 서면 안 흐려지고, 기계 바로 뒤(북쪽 끝 뒤)에 서면 흐려진다
test('rows fade only when a machine really hides me', () => {
  const zone = buildFigureZone(new THREE.Scene());
  const fadeAt = (o: Occluder, at: { x: number; z: number }) => {
    let v = 1;
    const fader = new OcclusionFader([{ ...o, setOpacity: (x: number) => { v = x; } }]);
    const eye = new THREE.Vector3(at.x, 0, at.z).add(CAMERA_OFFSETS.WIDE);
    for (let i = 0; i < 30; i++) fader.update(0.1, eye, at);
    return v;
  };
  const [f1, f2] = zone.occluders;
  expect(fadeAt(f1, { x: 12.8, z: 0 })).toBe(1);
  expect(fadeAt(f2, { x: 12.8, z: 0 })).toBe(1);
  expect(fadeAt(f1, { x: 10.2, z: -9.2 })).toBeLessThan(0.5);
});

// 큰 상자 두 종류(설계 §8): 첫째 줄은 긴 상자(17×12×34cm), 둘째 줄은 넓은 정사각형(26×13×26cm, 두께가 위아래)
test('each row draws its own box size', () => {
  const scene = new THREE.Scene();
  buildFigureZone(scene);
  for (const [row, kind] of [['f1', 'long'], ['f2', 'square']] as const) {
    const boxes = scene.getObjectByName(`figure-row-${row}`)!.getObjectByName('figure-boxes') as THREE.InstancedMesh;
    boxes.geometry.computeBoundingBox();
    const size = boxes.geometry.boundingBox!.getSize(new THREE.Vector3()), b = variantOf(kind).box;
    expect([size.x, size.y, size.z].map((v) => +v.toFixed(6)), row).toEqual([b.w, b.d, b.h]);
  }
});

// 두 상자 그림 모두 같은 물음표 그림과 '피규어 컬렉션' 문구 — 종류마다 그림이 따로 있다(정사각형은 정사각 칸)
test('both box kinds carry the blind box art', () => {
  buildFigureZone(new THREE.Scene());
  expect(drawnTexts.filter((t) => t === 'toycrane 피규어 컬렉션').length).toBeGreaterThanOrEqual(2);
});

// 버튼 글씨는 판 사이에도 그대로(사용자 2026-11-02 "중간에 버튼에 글자가 사라지는데") — 기계에 그린 고정 버튼에도 '오른쪽'·'안쪽'.
// 하는 기계는 살아 있는 버튼이 덮으니 고정 글씨도 함께 숨는다
test('static buttons keep their labels between plays', () => {
  const scene = new THREE.Scene(), zone = buildFigureZone(scene);
  const row = scene.getObjectByName('figure-row-f1')!;
  const labels = [1, 2].map((b) => row.getObjectByName(`figure-labels-${b}`) as THREE.InstancedMesh);
  expect(labels.every((l) => l?.isInstancedMesh && l.count === 7)).toBe(true);
  const scaleOf = (im: THREE.InstancedMesh, i: number) => { const m = new THREE.Matrix4(); im.getMatrixAt(i, m); return new THREE.Vector3().setFromMatrixScale(m).x; };
  expect(scaleOf(labels[0], 0)).toBeGreaterThan(0);
  zone.hideControls('F-1', true);
  expect(scaleOf(labels[0], 0)).toBe(0);
  expect(scaleOf(labels[1], 1)).toBeGreaterThan(0); // 다른 기계는 그대로
});

// 피규어 기계 뒤 진열(사용자 2026-11-02): 3개짜리 한 단 → 2단 총 6개
test('the figure machine shows six display boxes in two tiers', async () => {
  const { makeFigureMachineParts } = await import('./figureMachine');
  const { FIGURES } = await import('../data/figures');
  for (const spot of [FIGURES[0], FIGURES[7]]) {
    const { statics } = makeFigureMachineParts(spot, 0, 0x3b6cff), shown: THREE.Object3D[] = [];
    statics.traverse((o) => { if (o.name === 'figure-display') shown.push(o); });
    expect(shown).toHaveLength(6);
    expect(new Set(shown.map((o) => o.position.y.toFixed(3))).size).toBe(2);
    expectRoomy(shown, 'figure-display-shelf', statics);
  }
});

// 2단 진열은 답답하지 않게 띄운다(사용자 2026-11-02 사진 223: 정사각형 상자가 옆끼리 붙고 위 선반이 아래 상자에 얹혀 있었다) —
// 옆 상자 사이 4cm 넘게, 아래 상자 윗면과 위 선반 사이 4cm 넘게, 바깥 상자도 기계 기둥 안쪽(±0.54) 안
function expectRoomy(shown: THREE.Object3D[], shelfName: string, root: THREE.Object3D) {
  root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.updateMatrixWorld(true); // 기계 안 좌표로 잰다
  const boxes = shown.map((o) => new THREE.Box3().setFromObject(o));
  const rows = new Map<string, THREE.Box3[]>();
  for (const b of boxes) { const k = b.min.y.toFixed(2); rows.set(k, [...(rows.get(k) ?? []), b]); }
  for (const row of rows.values()) {
    row.sort((a, b) => a.min.x - b.min.x);
    for (let i = 1; i < row.length; i++) expect(row[i].min.x - row[i - 1].max.x).toBeGreaterThan(0.04);
    expect(Math.max(-row[0].min.x, row[row.length - 1].max.x)).toBeLessThanOrEqual(0.54);
  }
  const lowTop = Math.min(...boxes.map((b) => b.max.y)), shelf = root.getObjectByName(shelfName)!;
  expect(new THREE.Box3().setFromObject(shelf).min.y - lowTop).toBeGreaterThan(0.04);
}

test('the hook machine shows its display boxes in two roomy tiers', async () => {
  const { makeHookMachineParts } = await import('./hookMachine');
  const { RINGS } = await import('../data/rings');
  const { statics } = makeHookMachineParts(RINGS[0], 0xff8a3d), shown: THREE.Object3D[] = [];
  statics.traverse((o) => { if (o.name === 'hook-display') shown.push(o); });
  expect(shown).toHaveLength(6);
  expect(new Set(shown.map((o) => o.position.y.toFixed(3))).size).toBe(2);
  expectRoomy(shown, 'hook-display-shelf', statics);
});

// 사용자 2026-11-02(사진 202): 연한 반투명 집게가 휴대폰에서 잘 안 보였다 — 집게 머리·팔은 진하고 불투명한 색(흰 선반·파스텔 상자·민트 몸통 위에서 또렷이)
test('box machine claws are bold and opaque so they show on a phone', () => {
  const scene = new THREE.Scene();
  buildFigureZone(scene);
  for (const name of ['figure-claw-heads', 'figure-claw-arms']) {
    const mesh = scene.getObjectByName(name) as THREE.InstancedMesh;
    const mat = mesh.material as THREE.MeshToonMaterial, hsl = mat.color.getHSL({ h: 0, s: 0, l: 0 });
    expect(mat.transparent).toBe(false);
    expect(hsl.s).toBeGreaterThan(0.6);
    expect(hsl.l).toBeGreaterThan(0.3); expect(hsl.l).toBeLessThan(0.65);
  }
  expect((scene.getObjectByName('figure-claw-stickers') as THREE.InstancedMesh).material).toMatchObject({ userData: { text: '피규어' } });
});

// 쉬는 집게도 벌린 팔이 기계 안에 머무는 왼쪽 끝에 있다(정사각형 집게가 가장 넓다)
test('resting claws wait where their open arms stay inside', async () => {
  const { clawHalfX, clawShapeOf } = await import('../physics/figureClaw');
  const zone = buildFigureZone(new THREE.Scene());
  expect(zone.homeOf('F-1').x).toBeCloseTo(-clawHalfX(clawShapeOf('long')));
  expect(zone.homeOf('F-8').x).toBeCloseTo(-clawHalfX(clawShapeOf('square')));
  const { clawHalfZ } = await import('../physics/figureClaw');
  expect(zone.homeOf('F-1').z).toBeCloseTo(clawHalfZ('long')); // 앞 유리 안쪽
  expect(zone.homeOf('F-8').z).toBeCloseTo(clawHalfZ('square'));
});

// 앞 막대 바로 앞의 낮은 투명판(사진 244 '원래 저런 건 없는데')은 없애고, 앞도 뒤처럼 받침 막대 + 그 앞 유리 벽(사진 245 — 앞 막대 17cm 앞)
// 앞 막대와 받침 막대 사이에는 투명한 것이 없고, 유리는 앞 벽 자리에만
test('the front glass stands at the front wall line, not at the bar', async () => {
  const { makeFigureMachineParts } = await import('./figureMachine');
  const { barZ } = await import('../physics/figureWorld');
  for (const spot of [FIGURES[0], FIGURES[7]]) {
    const { statics } = makeFigureMachineParts(spot, 0, 0x3b6cff);
    statics.position.set(0, 0, 0); statics.rotation.set(0, 0, 0); statics.updateMatrixWorld(true);
    const bz = barZ(spot.box), { front_bar, front_wall } = guardsOf(spot.box);
    const front = new THREE.Box3(new THREE.Vector3(-0.4, FIGURE.bars.y + 0.01, bz + Math.min(0.03, front_bar / 2)), new THREE.Vector3(0.4, FIGURE.bars.y + 0.2, bz + front_wall - 0.02));
    const wall = new THREE.Box3(new THREE.Vector3(-0.4, FIGURE.bars.y + 0.05, bz + front_wall - 0.01), new THREE.Vector3(0.4, FIGURE.bars.y + 0.2, bz + front_wall + 0.01));
    let glassAtWall = false;
    const glass: string[] = [];
    statics.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.name === 'glass' || !(m.material as THREE.Material).transparent) return; // 몸통 유리(기계 가장자리)는 빼고
      if (new THREE.Box3().setFromObject(m).intersectsBox(front)) glass.push(m.geometry.type);
      if (new THREE.Box3().setFromObject(m).intersectsBox(wall)) glassAtWall = true;
    });
    expect(glass, spot.id).toEqual([]);
    expect(glassAtWall, spot.id).toBe(true);
  }
});
