import { expect, test } from 'vitest';
import { takeButton } from './counter';

// 코인 받기 버튼(친구 피드백 2026-11-02 '코인 신청했는데 버튼이 안 먹기도'): 15개 이상이면 왜 안 되는지 버튼 글자로(흐리게, 안 보냄),
// 누르면 응답(coins·take_no)이 올 때까지 '받는 중'으로 바로 보이고 다시 눌러도 또 보내지 않는다
test('the take button explains a full wallet and shows it is working', () => {
  expect(takeButton(3, false)).toEqual({ label: '코인 받기', status: null, dim: false, send: true });
  expect(takeButton(3, true)).toEqual({ label: '코인 받기', status: '받는 중이에요', dim: true, send: false });
  expect(takeButton(15, false)).toEqual({ label: '15개까지만 받아요', status: null, dim: true, send: false });
  expect(takeButton(54, true)).toMatchObject({ label: '15개까지만 받아요', send: false });
});
