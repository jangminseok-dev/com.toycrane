import { expect, test } from 'vitest';
import { CoinShow } from './coinShow';

const coins = (n: number, got: number) => ({ t: 'coins' as const, n, got });

// 교환소 조르기: 3초 조르는 모션 뒤에 결과를 보인다 — 그사이 온 코인 수와 안내는 잡아 두었다가 끝날 때 함께 (설계 §4.2, 최종 리뷰 I3)
test('a counter beg holds coins and its note until the show ends', () => {
  const s = new CoinShow();
  expect(s.startBeg()).toBe(true);
  expect(s.startBeg()).toBe(false); // 오가는 동안 다시 눌러도 보내지 않는다
  expect(s.coins(coins(53, 48))).toEqual({ show: null, toast: false });
  s.holdNote('10분 뒤에 다시 와요');
  expect(s.endBeg()).toEqual({ coins: coins(53, 48), note: '10분 뒤에 다시 와요' });
  expect(s.startBeg()).toBe(true);
});

test('coins outside a counter beg show at once with a +N toast', () => {
  const s = new CoinShow();
  expect(s.coins(coins(10, 5))).toEqual({ show: coins(10, 5), toast: true });
  expect(s.coins(coins(9, -1))).toEqual({ show: coins(9, -1), toast: false });
});

// 누가 준 코인은 '○○ 님이 코인 N개를 줬어요'가 떠 있으니 '🪙 +N'으로 덮지 않는다 (설계 §4.4)
test('coins right after a gift do not toast over the gift message', () => {
  const s = new CoinShow();
  s.gaveMe();
  expect(s.coins(coins(8, 3))).toEqual({ show: coins(8, 3), toast: false });
  expect(s.coins(coins(13, 5)).toast).toBe(true);
});

test('reset lets go of everything held', () => {
  const s = new CoinShow();
  s.startBeg(); s.coins(coins(53, 48)); s.holdNote('x');
  s.reset();
  expect(s.endBeg()).toEqual({ coins: null, note: null });
  expect(s.startBeg()).toBe(true);
});
