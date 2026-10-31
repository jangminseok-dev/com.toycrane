// 인형 목록(shared/catalog.json, 서버 server/src/toycrane/domain/catalog.py와 같은 파일): 4세트 × 일반 6 = 24종.
// 캐릭터마다 색 6가지(0번이 기본색), 희귀 효과 8가지와 황금은 모든 캐릭터에 입힌다 (설계 2026-10-31 인형 채우기 §4.2·§4.4)
import catalog from '../../../shared/catalog.json';

export type SetInfo = { id: string; name: string; color: string };
export type DollInfo = { id: string; name: string; set: string; palette: { name: string; color: string }[] };
export type EffectInfo = { id: string; name: string };

export const SETS: SetInfo[] = catalog.sets;
export const DOLLS: Record<string, DollInfo> = Object.fromEntries((catalog.dolls as DollInfo[]).map((d) => [d.id, d]));
export const EFFECTS: EffectInfo[] = catalog.effects;
export const GOLD: EffectInfo = catalog.gold;

// 가게 이름표처럼: "민트 곰돌이", "별빛 곰돌이", "황금 곰돌이" (rare: ''·효과 id·'gold')
export function dollName(kind: string, color: number, rare: string): string {
  const info = DOLLS[kind];
  if (!info) return kind;
  const prefix = rare === GOLD.id ? GOLD.name : rare ? EFFECTS.find((e) => e.id === rare)?.name : info.palette[color]?.name;
  return prefix ? `${prefix} ${info.name}` : info.name;
}
