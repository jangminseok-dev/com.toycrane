import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { stubCanvas } from '../../test/canvasStub';
import { PlushBuilder } from './kit';
import { SPECIES } from './species';

beforeAll(stubCanvas);
const fmt = (v: { x: number; y: number; z: number }) => [v.x, v.y, v.z].map((n) => n.toFixed(2)).join(',');

// 사용자 2026-11-02: "왕관이랑 부위들이 떨어져 있는 얘들이 있어" — 팔·발·꼬리·날개 같은 부위는 몸에 조금 묻혀야 붙어 보인다.
// 점으로만 닿으면(묻힘 0~9%) 뒷면 외곽선이 부위 둘레를 다 그어 떨어져 보이고, 다 묻히면(95% 넘게) 안 보인다. 머리·가장 큰 몸통은 빼고 잰다
test('every limb of every doll is attached to its body', () => {
  const bad: string[] = [];
  for (const sp of Object.values(SPECIES)) for (const lite of [false, true]) {
    const b = new PlushBuilder({ lite });
    sp.make(b, 0);
    const parts = b.burial(), biggest = parts.reduce((m, p, i) => (p.size > parts[m].size ? i : m), 0);
    parts.forEach((p, i) => {
      if (!p.outline || p.name === 'head' || i === biggest) return;
      // lite(기계 속 무더기)는 면이 거칠어 꼭짓점으로 잰 비율이 낮게 나온다 — 아래 한도만 0.08
      if (p.share < (lite ? 0.08 : 0.12) || p.share > 0.97) bad.push(`${sp.id}${lite ? '(lite)' : ''} ${p.name ?? '부위'} @${fmt(p.at)} r${p.size.toFixed(2)} ${p.share.toFixed(2)}`);
    });
  }
  expect(bad).toEqual([]);
}, 120_000);

// 왕관은 머리에 씌워진다: 테 아래 둘레가 머리 겉면에서 뜨지 않는다(평균 틈 ≤ 1cm, 가장 큰 틈 ≤ 3cm). 테는 위아래가 뚫린 고리라 머리 꼭대기·뿔이 나와도 된다.
// 지금까지는 '부딪힘 공 맨 위 + 2cm'에 놓아 동글이형에서 8~16cm 떠 있었다(사용자 사진: 황금 동글이 왕관)
test('crowns sit on the head', async () => {
  const { makePlush } = await import('./index');
  const { PLAIN } = await import('../dolls');
  const { PLUSH_OUTLINE } = await import('./kit');
  const bad: string[] = [];
  for (const id of Object.keys(SPECIES)) for (const rare of ['gold', 'star']) {
    const g = makePlush(id, { ...PLAIN, rare }, false)!.group, crown = g.getObjectByName('crown')!;
    g.updateMatrixWorld(true);
    const heads: THREE.Mesh[] = [];
    g.traverse((o) => { const m = o as THREE.Mesh; let skip = false; for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.name === 'crown' || p.name === 'aura') skip = true; if (m.isMesh && !skip && m.material !== PLUSH_OUTLINE) heads.push(m); });
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    const surface = (x: number, z: number) => { ray.set(new THREE.Vector3(x, 5, z), down); return ray.intersectObjects(heads, false)[0]?.point.y ?? null; };
    const gaps: number[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, p = crown.localToWorld(new THREE.Vector3(Math.sin(a) * 0.15, -0.04, Math.cos(a) * 0.15)), y = surface(p.x, p.z);
      if (y !== null) gaps.push(p.y - y);
    }
    const mean = gaps.reduce((s, v) => s + v, 0) / Math.max(1, gaps.length), max = Math.max(...gaps);
    if (gaps.length < 4 || mean > 0.01 || max > 0.03) bad.push(`${id}/${rare} hits ${gaps.length} mean ${mean.toFixed(3)} max ${max.toFixed(3)}`);
  }
  expect(bad).toEqual([]);
}, 120_000);
