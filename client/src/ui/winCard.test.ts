import { expect, test } from 'vitest';
import { winCardText } from './winCard';

// 당첨 카드 글자 (설계 2026-10-31 인형 채우기 §4.6): "민트 곰돌이", "★ 별빛 곰돌이", "★★ 황금 곰돌이"
test('the win card names the tier', () => {
  expect(winCardText('황금 곰돌이', 'gold')).toEqual({ head: '★★ 매우 희귀!', title: '★★ 황금 곰돌이' });
  expect(winCardText('별빛 곰돌이', 'rare')).toEqual({ head: '★ 희귀!', title: '★ 별빛 곰돌이' });
  expect(winCardText('민트 곰돌이', '')).toEqual({ head: '짠!', title: '민트 곰돌이' });
});
