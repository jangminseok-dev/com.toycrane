// 고리 걸기 기계(설계 2026-11-02 ring-hook §3): 자리는 shared/store_layout.json rings(R-1~R-10), 수치는 shared/hook.json
import hook from '../../../shared/hook.json';
import { RINGS } from './rings';

export type HookSpec = Omit<typeof hook, '_note'>;
export const HOOK: HookSpec = hook;
export type RingSide = 'right' | 'left';
const SIDES: RingSide[] = ['right', 'left'];

// 고리 판이 상자 어느 옆으로 튀어나오나 — 기계마다 번갈아(같은 기계는 늘 같은 쪽). 뒤쪽 고리는 집게 팔이 x로만 벌어져 끌어오기 어려워 뺐다(시뮬: 절반이 30판 넘음)
export function ringSideOf(id: string): RingSide {
  return SIDES[Math.max(0, RINGS.findIndex((r) => r.id === id)) % SIDES.length];
}
