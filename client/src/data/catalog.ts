// 인형 목록(shared/catalog.json, 서버 server/src/toycrane/domain/catalog.py와 같은 파일): 4세트 × (일반 6 + 희귀 1) = 28종
import catalog from '../../../shared/catalog.json';

export type SetInfo = { id: string; name: string; color: string };
export type DollInfo = { id: string; name: string; set: string; rare: boolean; base?: string };

export const SETS: SetInfo[] = catalog.sets;
export const DOLLS: Record<string, DollInfo> = Object.fromEntries((catalog.dolls as DollInfo[]).map((d) => [d.id, d]));

// 목록에 없는 인형(배포로 목록이 바뀜)은 일반으로 본다
export function isRare(id: string): boolean {
  return DOLLS[id]?.rare ?? false;
}
