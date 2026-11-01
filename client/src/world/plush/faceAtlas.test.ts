import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../../test/canvasStub';
import { FACE_MAT, cellUV, eyeCells, type Cell } from './faceAtlas';
import { PlushBuilder, plushMat } from './kit';

beforeAll(stubCanvas);

// 인형 리뉴얼 설계 §4: 표정 5가지(0 웃음 · 1 ω 입 · 2 윙크 · 3 졸린 눈 · 4 볼 빨개짐)가 구슬형·애니형 눈 모두에 있다
test('five faces pick five different eye sets', () => {
  for (const style of ['dot', 'anime'] as const) {
    const sig = (f: number) => JSON.stringify(eyeCells(style, 'violet', f));
    expect(new Set([0, 1, 2, 3, 4].map(sig)).size, style).toBe(5);
  }
  expect(eyeCells('dot', 'violet', 2)).toMatchObject({ left: 'dotEye', right: 'closed' });
  expect(eyeCells('anime', 'green', 0)).toMatchObject({ left: 'animeClosed', right: 'animeClosed' });
  expect(eyeCells('anime', 'green', 1)).toMatchObject({ left: 'anime-green', omega: true });
  expect(eyeCells('dot', 'violet', 4).blush).toBe('blushBig');
});

test('every cell has its own place on the atlas', () => {
  const cells: Cell[] = ['dotEye', 'closed', 'animeClosed', 'sleepy', 'blush', 'blushBig', 'anime-violet', 'anime-blue', 'anime-green', 'anime-amber', 'anime-pink', 'anime-brown'];
  const uvs = cells.map((c) => cellUV(c).join(','));
  expect(new Set(uvs).size).toBe(cells.length);
  for (const c of cells) {
    const [u0, v0, u1, v1] = cellUV(c);
    expect(u0).toBeGreaterThanOrEqual(0); expect(v1).toBeLessThanOrEqual(1); expect(u1).toBeGreaterThan(u0); expect(v1).toBeGreaterThan(v0);
  }
});

test('painted face pieces all share one material', () => {
  const built = new PlushBuilder({ lite: false }).sphere(0.6, [0, 1.2, 0], [1, 1, 1], [0, 0, 0], { name: 'head' })
    .paint('dotEye', [-0.21, 1.25], [0.095, 0.12], 'face-eye').paint('dotEye', [0.21, 1.25], [0.095, 0.12], 'face-eye')
    .paint('blush', [0.36, 1.06], [0.15, 0.09], 'face-cheek').stitch([[0, 1.07], [0, 1.03]], 0.009, 'face-mouth')
    .build((s) => plushMat(s === 'thread' ? 0x3a2330 : 0xc4a6ee));
  const faceMeshes: THREE.Mesh[] = [];
  built.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.material === FACE_MAT) faceMeshes.push(m); });
  expect(faceMeshes).toHaveLength(1);
  const names: string[] = [];
  built.group.traverse((o) => names.push(o.name));
  expect(names).toContain('face-mouth');
  expect(names.filter((n) => n === 'face-eye')).toHaveLength(2);
});

test('lite builds keep the mouth stitch and the painted face but drop other stitches', () => {
  const names = (lite: boolean) => {
    const b = new PlushBuilder({ lite }).sphere(0.6, [0, 1.2, 0], [1, 1, 1], [0, 0, 0], { name: 'head' })
      .paint('dotEye', [0.21, 1.25], [0.095, 0.12], 'face-eye').stitch([[0, 1.07], [0, 1.03]], 0.009, 'face-mouth').stitch([[0.3, 1.0], [0.4, 1.0]], 0.006, 'whisker');
    const out: string[] = []; b.build((s) => plushMat(s === 'thread' ? 0x3a2330 : 0xc4a6ee)).group.traverse((o) => out.push(o.name));
    return out;
  };
  expect(names(true)).toContain('face-mouth'); expect(names(true)).toContain('face-eye'); expect(names(true)).not.toContain('whisker');
  expect(names(false)).toContain('whisker');
});
