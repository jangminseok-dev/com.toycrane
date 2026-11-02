import { expect, test } from 'vitest';
import { buttonParts } from './actionButton';

// 버튼 안에는 할 일만, 코인 값은 오른쪽 작은 배지로 (교환소 개편 설계 §4.7)
test('a button shows its action and a coin badge apart', () => {
  expect(buttonParts('한 판 하기', 1)).toEqual({ text: '한 판 하기', badge: '🪙 1' });
  expect(buttonParts('교환소 가기', null)).toEqual({ text: '교환소 가기', badge: null });
});

// 오른쪽 아래 버튼(조르기·한 판 하기·다섯 판 하기·한 판 더·다섯 판 더·그만하기)은 모두 같은 크기의 알약, 예전보다 조금 작게,
// 휴대폰도 같은 모양(조금 더 작게) — 아래부터 차례로 쌓여 겹치지 않는다(사용자 2026-11-02 사진 231·232·236)
test('every bottom-right button is the same pill, a little smaller, stacked without overlap', async () => {
  const { buttonBox, stackBottom } = await import('./actionButton');
  for (const mobile of [false, true]) {
    const b = buttonBox(mobile);
    expect(b.height).toBeLessThan(52); // 예전 큰 버튼(약 52px)·동그라미(112px)보다 작게
    expect(b.width).toBeLessThanOrEqual(mobile ? 136 : 156);
    for (let slot = 1; slot < 3; slot++) expect(stackBottom(slot, mobile) - stackBottom(slot - 1, mobile)).toBeGreaterThanOrEqual(b.height + 8);
  }
  expect(buttonBox(true).width).toBeLessThan(buttonBox(false).width);
});
