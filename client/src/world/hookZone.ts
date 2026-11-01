import type * as THREE from 'three';
import { HOOK } from '../data/hooks';
import { RINGS } from '../data/rings';
import { hookClawShape } from '../physics/hookWorld';
import { buildBoxZone, type BoxLook, type FigureZone } from './figureZone';
import { flapGeo, gluedGeo, hookBoxGeo, hookBoxMat, hookClawGeos, makeHookMachineParts, restFlap, ringMat } from './hookMachine';

// 고리 걸기 구역(설계 2026-11-02 ring-hook §3): 북쪽 두 줄 10대(R-1~R-10). 피규어 구역과 같은 굽기·인스턴스(상자 기계 공용 buildBoxZone),
// 상자는 세운 '?' 상자, 고리 판은 상자에 붙은 부분 + 접히는 날개(인스턴스 둘). 줄마다 고리 방향 하나(r1 오른쪽, r2 왼쪽)
const ROWS = [{ id: 'r1', color: 0x16b39a }, { id: 'r2', color: 0xff8a3d }] as const;
const sideOfRow = (row: number) => (row === 0 ? 'right' : 'left');

const HOOK_LOOK: BoxLook = {
  name: 'hook',
  rows: ROWS.map((r) => ({ id: r.id, spots: RINGS.filter((s) => s.row === r.id), color: r.color })),
  parts: (spot, color) => makeHookMachineParts(spot, color),
  boxGeo: () => hookBoxGeo(),
  boxMat: () => hookBoxMat(),
  claw: () => ({ shape: hookClawShape(), geos: hookClawGeos() }),
  sticker: '고리',
  restBox: () => [0, HOOK.shelf.y + HOOK.box.h / 2, HOOK.start.z, 0, 0, 0, 1],
  extra: { geo: (row) => flapGeo(sideOfRow(row)), glued: (row) => gluedGeo(sideOfRow(row)), mat: ringMat(), rest: (row, box) => restFlap(sideOfRow(row), box) },
};

export function buildHookZone(scene: THREE.Scene): FigureZone {
  return buildBoxZone(scene, HOOK_LOOK);
}
