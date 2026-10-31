import { expect, test } from 'vitest';
import { buttonParts } from './actionButton';

// 버튼 안에는 할 일만, 코인 값은 오른쪽 작은 배지로 (교환소 개편 설계 §4.7)
test('a button shows its action and a coin badge apart', () => {
  expect(buttonParts('한 판 하기', 1)).toEqual({ text: '한 판 하기', badge: '🪙 1' });
  expect(buttonParts('교환소 가기', null)).toEqual({ text: '교환소 가기', badge: null });
});
