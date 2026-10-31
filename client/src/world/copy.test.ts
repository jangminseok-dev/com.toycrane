import { expect, test } from 'vitest';
import { COUNTER_SIGN, MACHINE_NAMES, POP_CARDS, PREP, STICKER, WALL_SIGN } from './copy';

// 설계 2026-10-31 §2 안티목표: 간판·카드·스티커·장식 어디에도 일본어(가나·한자)를 쓰지 않는다
const JP = /[぀-ヿㇰ-ㇿ一-鿿]/;
test('on-screen copy has no Japanese characters', () => {
  for (const s of [...MACHINE_NAMES, ...POP_CARDS, STICKER, ...WALL_SIGN, PREP, COUNTER_SIGN]) expect(JP.test(s)).toBe(false);
});
