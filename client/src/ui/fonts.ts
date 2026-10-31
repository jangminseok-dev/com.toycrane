// 간판 글꼴(Jua)·손글씨 카드 글꼴(Gaegu 700)을 캔버스에 그리기 전에 불러 둔다(Google Fonts, OFL).
// 스타일시트는 여기서 붙인다 — index.html에 박으면 느린 글꼴 서버가 첫 화면을 막는다.
// 카톡 인앱·차단·오프라인이면 2.5초만 기다리고 시스템 글꼴로 그린다 — 절대 실패로 끝나지 않는다
type FontApi = { load(font: string, text?: string): Promise<unknown[]> };
type Doc = { fonts?: FontApi; head?: { appendChild(el: unknown): void }; createElement?(tag: string): Record<string, unknown> };
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Gaegu:wght@700&family=Jua&display=swap';

export async function loadFonts(sample: string, timeoutMs = 2500): Promise<boolean> {
  const doc = (globalThis as { document?: Doc }).document, fonts = doc?.fonts;
  if (!fonts?.load) return false;
  const css = new Promise<boolean>((resolve) => {
    if (!doc?.createElement || !doc.head) return resolve(true);
    const link = doc.createElement('link');
    Object.assign(link, { rel: 'stylesheet', href: FONT_CSS, onload: () => resolve(true), onerror: () => resolve(false) });
    doc.head.appendChild(link);
  });
  const loaded = css.then((ok) => ok && Promise.all([fonts.load('80px Jua', sample), fonts.load('700 80px Gaegu', sample)])
    .then((faces) => faces.every((f) => f.length > 0)), () => false).catch(() => false);
  const timeout = new Promise<boolean>((r) => setTimeout(() => r(false), timeoutMs));
  return Promise.race([loaded, timeout]);
}
