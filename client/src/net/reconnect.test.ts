import { expect, test } from 'vitest';
import { closeAction, nextDelay, retrying } from './reconnect';

test('backoff', () => expect([0, 1, 2, 3, 4, 10].map(nextDelay)).toEqual([500, 1000, 2000, 4000, 8000, 8000]));

// 첫 화면에서 네트워크 오류가 나도 페이지가 멈추지 않고 간격을 두고 다시 시도한다 (최종 리뷰 #3)
test('retrying retries with backoff until the task succeeds', async () => {
  let calls = 0;
  const waits: number[] = [], notices: number[] = [];
  const value = await retrying(
    async () => { if (calls++ < 2) throw new Error('network'); return 'ok'; },
    (attempt) => notices.push(attempt),
    async (ms) => { waits.push(ms); },
  );
  expect(value).toBe('ok');
  expect(waits).toEqual([500, 1000]);
  expect(notices).toEqual([0, 1]);
});

// 만석(4001)도 바로 다시 붙지 않고 간격을 둔다 — 같은 매장으로 계속 튕기며 요청을 태우지 않게 (최종 리뷰 #1)
test('close codes', () => {
  expect(closeAction(4003)).toBe('stop');
  expect(closeAction(4002)).toBe('restart');
  expect(closeAction(4001)).toBe('retry');
  expect(closeAction(1006)).toBe('retry');
  expect(closeAction(1000)).toBe('retry');
});
