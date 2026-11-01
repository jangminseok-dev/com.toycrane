import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { DOLLS } from '../data/catalog';
import { FIGURE, FIGURES, variantOf } from '../data/figures';
import { CAMERA_OFFSETS } from '../game/followCamera';
import { OcclusionFader, type Occluder } from '../game/occlusion';
import type { BoxWire } from '../net/protocol';
import { drawnTexts, stubCanvas } from '../test/canvasStub';
import { buildFigureZone } from './figureZone';

beforeAll(stubCanvas);
const LYING: BoxWire = [0, FIGURE.bars.y + FIGURE.bars.radius + variantOf('long').box.d / 2, 0, 0, 0, 0, 1];

// 9단계 피규어 기계 그림(그래픽 설계 §3.5): 14대를 줄마다 합쳐 그리고, 상자·집게·버튼은 인스턴스로 — 메시 60개 이하
test('fourteen figure machines draw in a few meshes', () => {
  const scene = new THREE.Scene(), zone = buildFigureZone(scene);
  let n = 0;
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; });
  expect(n).toBeLessThanOrEqual(60);
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
  expect(fadeAt(f1, { x: 15.8, z: 0 })).toBe(1);
  expect(fadeAt(f2, { x: 15.8, z: 0 })).toBe(1);
  expect(fadeAt(f1, { x: 13.2, z: -9.2 })).toBeLessThan(0.5);
});
