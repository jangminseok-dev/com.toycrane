import { expect, test } from 'vitest';
import { DOLLS, EFFECTS, GOLD } from '../data/catalog';
import { COUNTER_SIGN, DROP_LABEL, MACHINE_SIGNS, POP_CARDS, PREP, STICKER, WALL_SIGN } from './copy';

// 설계 2026-10-31 §2 안티목표: 간판·카드·스티커·장식 어디에도 일본어(가나·한자)를 쓰지 않는다
const JP = /[぀-ヿㇰ-ㇿ一-鿿]/;
test('on-screen copy has no Japanese characters', () => {
  for (const s of [...POP_CARDS, STICKER, ...WALL_SIGN, PREP, COUNTER_SIGN, DROP_LABEL, ...Object.values(MACHINE_SIGNS),
    ...Object.values(DOLLS).flatMap((d) => [d.name, ...d.palette.map((c) => c.name)]), ...EFFECTS.map((e) => e.name), GOLD.name]) expect(JP.test(s)).toBe(false);
});

test('every character has its own machine sign', () => {
  expect(Object.keys(MACHINE_SIGNS).sort()).toEqual(Object.keys(DOLLS).sort());
});
