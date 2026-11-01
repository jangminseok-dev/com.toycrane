import { afterEach, expect, test, vi } from 'vitest';
import { FinishWaits } from './buttonPlay';

afterEach(() => vi.useRealTimers());
const flag = (p: Promise<void>) => { const s = { done: false }; void p.then(() => { s.done = true; }); return s; };

// 결과(result)가 오면 바로 기다리기 시작해, 그 뒤에 오는 찌르기·밀기가 끝날 때 풀린다 — 앞 판의 그리기가 끝나도 풀리지 않는다(최종 리뷰)
test('a wait is released by the drawing that follows the result, not an earlier one', async () => {
  vi.useFakeTimers();
  const w = new FinishWaits(4000);
  const first = w.arrived('R-1'); // 앞 판 그리기가 아직 도는 중
  const s = flag(w.wait('R-1')); // 이번 판 결과가 왔다
  w.finished('R-1', first);
  await vi.advanceTimersByTimeAsync(0);
  expect(s.done).toBe(false);
  const mine = w.arrived('R-1');
  w.finished('R-1', mine);
  await vi.advanceTimersByTimeAsync(0);
  expect(s.done).toBe(true);
});

// 앞 기다림의 대비 시계가 다음 판의 기다림을 일찍 풀지 않는다. 그리기 메시지가 끝내 안 오면 대비 시계로 풀린다
test("an earlier wait's fallback does not release a later one", async () => {
  vi.useFakeTimers();
  const w = new FinishWaits(4000);
  const a = flag(w.wait('P-1'));
  w.finished('P-1', w.arrived('P-1'));
  await vi.advanceTimersByTimeAsync(0);
  expect(a.done).toBe(true);
  await vi.advanceTimersByTimeAsync(2000);
  const b = flag(w.wait('P-1'));
  await vi.advanceTimersByTimeAsync(2500); // a의 대비 시계(4초)가 지남
  expect(b.done).toBe(false);
  await vi.advanceTimersByTimeAsync(1600); // b의 대비 시계
  expect(b.done).toBe(true);
});
