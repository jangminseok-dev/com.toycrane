import type { EyeStyle, Iris } from './faceAtlas';
import type { PlushBuilder, Slot } from './kit';
import { DREAM } from './dream';
import { FOREST } from './forest';
import { SOFT } from './soft';
import { WATER } from './water';

// 24종 생김새 등록표 (인형 리뉴얼 설계 §8: 생김새 세부는 빌더). 세트 파일이 6종씩 채운다.
// slots: 몸 말고 다른 칠 자리의 고정 색('accent'를 안 주면 몸 색을 흰색 쪽으로 0.55 섞은 색)
export type Species = {
  id: string;
  round: boolean;
  eyes: EyeStyle;
  iris: Iris;
  slots?: Partial<Record<Exclude<Slot, number | 'body'>, number>>;
  make(b: PlushBuilder, face: number): void;
};

export const SPECIES: Record<string, Species> = Object.fromEntries([...SOFT, ...FOREST, ...WATER, ...DREAM].map((s) => [s.id, s]));
