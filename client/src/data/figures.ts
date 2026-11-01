// 피규어 뽑기 기계(9단계, 설계 2026-11-01-toycrane-figure-machine-design.md): 자리는 shared/store_layout.json figures, 수치는 shared/figure.json
import figure from '../../../shared/figure.json';
import layout from '../../../shared/store_layout.json';
import type { Vec2 } from '../game/movement';
import { MACHINE_SPEC, frontSpot } from './storeLayout';

export type FigureSpot = { id: string; x: number; z: number; ry: number; row: 'f1' | 'f2' };
export type FigureSpec = Omit<typeof figure, '_note'>;
export const FIGURES = layout.figures as FigureSpot[];
export const FIGURE: FigureSpec = figure;
const IDS = new Set(FIGURES.map((f) => f.id));

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
