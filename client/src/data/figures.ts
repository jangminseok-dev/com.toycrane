// 피규어 뽑기 기계(9단계, 설계 2026-11-01-toycrane-figure-machine-design.md): 자리는 shared/store_layout.json figures, 수치는 shared/figure.json
import figure from '../../../shared/figure.json';
import layout from '../../../shared/store_layout.json';
import type { Vec2 } from '../game/movement';
import { MACHINE_SPEC, frontSpot } from './storeLayout';

export type BoxKind = 'long' | 'square'; // 큰 상자 두 종류(설계 §8): 긴 상자·넓은 정사각형 상자
export type FigureSpot = { id: string; x: number; z: number; ry: number; row: 'f1' | 'f2'; box: BoxKind };
export type FigureSpec = Omit<typeof figure, '_note'>;
export type Variant = FigureSpec['variants']['long'];
export const FIGURES = layout.figures as FigureSpot[];
export const FIGURE: FigureSpec = figure;
const IDS = new Set(FIGURES.map((f) => f.id));
const KINDS = new Map(FIGURES.map((f) => [f.id, f.box]));

export function variantOf(kind: BoxKind): Variant {
  return FIGURE.variants[kind];
}

// 막대 중심에서 바깥으로 받침 막대·유리 벽까지(앞뒤): 뒤는 두 종류 같고, 앞은 상자 종류마다(figure.json의 _note)
export type Guards = { front_bar: number; front_wall: number; back_bar: number; back_wall: number };
export function guardsOf(kind: BoxKind): Guards {
  return { ...FIGURE.guards, ...variantOf(kind).guards };
}

export function boxKindOf(id: string): BoxKind {
  const k = KINDS.get(id);
  if (!k) throw new Error(`no figure machine ${id}`);
  return k;
}

export function isFigure(id: string): boolean {
  return IDS.has(id);
}

// 손 닿는 거리(reach) 안의 앞자리 중 가장 가까운 피규어 기계
export function nearestFigure(pos: Vec2): FigureSpot | null {
  let best: FigureSpot | null = null, bestD = MACHINE_SPEC.reach;
  for (const f of FIGURES) {
    const s = frontSpot(f), d = Math.hypot(pos.x - s.x, pos.z - s.z);
    if (d <= bestD) { best = f; bestD = d; }
  }
  return best;
}
