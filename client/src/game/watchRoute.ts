import { isFigure } from '../data/figures';
import { isPusher } from '../data/pushers';
import { isRing } from '../data/rings';
import { MACHINES } from '../data/storeLayout';

// 남이 기계에서 판을 시작했을 때 구경을 맡을 곳(계획 12): 인형 기계는 무더기 구경, 상자 기계(피규어·고리 걸기)는 그 기계의 판 객체,
// 미는 뽑기는 인형 기계와 같은 구경 길. 모르는 id는 아무 구경도 하지 않는다
export type WatchKind = 'doll' | 'box' | 'pusher' | null;
const DOLLS = new Set(MACHINES.map((m) => m.id));

export function watchKind(id: string): WatchKind {
  if (DOLLS.has(id)) return 'doll';
  if (isFigure(id) || isRing(id)) return 'box';
  if (isPusher(id)) return 'pusher';
  return null;
}
