// 간판 글꼴(Jua)·손글씨 카드 글꼴(Gaegu 700)을 캔버스에 그리기 전에 불러 둔다(index.html의 Google Fonts).
// 카톡 인앱·차단·오프라인이면 기다리지 않고 시스템 글꼴로 그린다 — 절대 실패로 끝나지 않는다
type FontApi = { load(font: string, text?: string): Promise<unknown[]> };

export async function loadFonts(sample: string, timeoutMs = 2500): Promise<boolean> {
  const fonts = (globalThis as { document?: { fonts?: FontApi } }).document?.fonts;
  if (!fonts?.load) return false;
  const loaded = Promise.all([fonts.load('80px Jua', sample), fonts.load('700 80px Gaegu', sample)])
    .then((faces) => faces.every((f) => f.length > 0), () => false);
  const timeout = new Promise<boolean>((r) => setTimeout(() => r(false), timeoutMs));
  return Promise.race([loaded, timeout]);
}
