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

// 글꼴 스타일시트는 페이지 머리에 박지 않고 여기서 붙인다 — 박아 두면 느린 글꼴 서버가 첫 화면을 막는다 (최종 리뷰 I4)
test('loadFonts attaches the stylesheet itself and still gives up after the timeout', async () => {
  vi.useFakeTimers();
  const added: { rel?: string; href?: string }[] = [];
  g.document = {
    fonts: { load: () => Promise.resolve([{}]) },
    head: { appendChild: (el: { rel?: string; href?: string }) => added.push(el) },
    createElement: () => ({}),
  };
  const p = loadFonts('가', 2500); // 스타일시트가 끝내 안 온다
  await vi.advanceTimersByTimeAsync(2600);
  await expect(p).resolves.toBe(false);
  expect(added[0].rel).toBe('stylesheet');
  expect(added[0].href).toContain('family=Jua');
});
