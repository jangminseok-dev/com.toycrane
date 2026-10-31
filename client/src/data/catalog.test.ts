import { expect, test } from 'vitest';
import { DOLLS, EFFECTS, dollName } from './catalog';

// 인형 이름: 색이나 효과를 앞에 붙인다 (설계 2026-10-31 인형 채우기 §4.6)
test('doll names read like a shop tag', () => {
  expect(dollName('bear', 0, '')).toBe(`${DOLLS.bear.palette[0].name} 곰돌이`);
  expect(dollName('bear', 3, 'star')).toBe('별빛 곰돌이');
  expect(dollName('bear', 3, 'gold')).toBe('황금 곰돌이');
});

test('every character has six colors and there are eight effects', () => {
  expect(Object.keys(DOLLS)).toHaveLength(24);
  expect(Object.values(DOLLS).every((d) => d.palette.length === 6)).toBe(true);
  expect(EFFECTS).toHaveLength(8);
});
