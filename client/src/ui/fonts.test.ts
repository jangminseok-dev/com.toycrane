import { afterEach, expect, test, vi } from 'vitest';
import { loadFonts } from './fonts';

// 카톡 인앱·차단·오프라인에서 글꼴을 못 불러와도 2.5초 뒤 시스템 글꼴로 넘어가 입장이 막히지 않는다
const g = globalThis as { document?: unknown };
const stubFonts = (load: ((font: string, text: string) => Promise<unknown[]>) | undefined) => {
  g.document = load ? { fonts: { load } } : {};
};
afterEach(() => { vi.useRealTimers(); delete g.document; });

test('loadFonts gives up after the timeout', async () => {
  vi.useFakeTimers();
  stubFonts(() => new Promise(() => {}));
  const p = loadFonts('가', 2500);
  await vi.advanceTimersByTimeAsync(2600);
  await expect(p).resolves.toBe(false);
});

test('loadFonts reports success when both faces load', async () => {
  stubFonts(() => Promise.resolve([{}]));
  await expect(loadFonts('가')).resolves.toBe(true);
});

test('loadFonts copes without a font API', async () => {
  stubFonts(undefined);
  await expect(loadFonts('가')).resolves.toBe(false);
});
