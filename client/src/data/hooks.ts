// 고리 걸기 기계(설계 2026-11-02 ring-hook §3): 자리는 shared/store_layout.json rings(R-1~R-10), 수치는 shared/hook.json
import hook from '../../../shared/hook.json';
import { RINGS } from './rings';

export type HookSpec = Omit<typeof hook, '_note'>;
export const HOOK: HookSpec = hook;
export type RingSide = 'right' | 'left';

// 고리 판이 상자 어느 옆으로 튀어나오나 — 줄마다(r1 오른쪽, r2 왼쪽: 줄마다 한 도형으로 그린다). 뒤쪽 고리는 집게 팔이 x로만 벌어져 끌어오기 어려워 뺐다(시뮬: 절반이 30판 넘음)
export function ringSideOf(id: string): RingSide {
  return RINGS.find((r) => r.id === id)?.row === 'r2' ? 'left' : 'right';
}
