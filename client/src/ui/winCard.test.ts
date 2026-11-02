import { expect, test } from 'vitest';
import { winCardText, winTier } from './winCard';

// 당첨 카드 글자 (설계 2026-10-31 인형 채우기 §4.6): "민트 곰돌이", "★ 별빛 곰돌이", "★★ 황금 곰돌이"
test('the win card names the tier', () => {
  expect(winCardText(['황금 곰돌이'], 'gold')).toEqual({ head: '★★ 매우 희귀!', title: '★★ 황금 곰돌이', more: [] });
  expect(winCardText(['별빛 곰돌이'], 'rare')).toEqual({ head: '★ 희귀!', title: '★ 별빛 곰돌이', more: [] });
  expect(winCardText(['민트 곰돌이'], '')).toEqual({ head: '짠!', title: '민트 곰돌이', more: [] });
});

// 한 판에 여러 개(미는 뽑기·탑이 무너진 인형 기계)면 카드에 모두 — 첫 인형은 크게, 나머지는 아래 한 줄씩(많으면 '외 N개'). 하나만 보여 줘
// 하나만 뽑은 줄 알았다(사용자 2026-11-02). 등급은 가장 높은 것
test('the win card lists every doll of a multi win', () => {
  expect(winCardText(['토끼', '곰돌이', '펭귄'], '')).toEqual({ head: '짠! 3개!', title: '토끼', more: ['곰돌이', '펭귄'] });
  expect(winCardText(['토끼'], '')).toEqual({ head: '짠!', title: '토끼', more: [] });
  expect(winCardText(['별빛 곰돌이', '토끼'], 'rare')).toEqual({ head: '★ 희귀! 2개!', title: '★ 별빛 곰돌이', more: ['토끼'] });
  const many = winCardText(['a', 'b', 'c', 'd', 'e', 'f', 'g'], '');
  expect(many.more).toEqual(['b', 'c', 'd', 'e', '외 2개']);
  expect(winTier(['', 'star', ''])).toBe('rare');
  expect(winTier(['star', 'gold'])).toBe('gold');
  expect(winTier(['', ''])).toBe('');
});
