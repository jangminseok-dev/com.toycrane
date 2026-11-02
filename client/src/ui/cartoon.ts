// 카툰풍 알약(사용자 2026-11-02 사진 259~262 '잘 안 보여, 카툰풍으로 규칙성 있게'): 반투명 유리 대신 진한 남색 테두리 + 납작한 그림자 + 간판 글꼴(Jua).
// 화면 위 글자(코인·가방·소리, 진행 안내, 알림, 판 수·조작 안내)와 오른쪽 아래 버튼이 모두 같은 규칙 — 채움색만 다르다
export const INK = '#2c2470';
export const CARTOON_FONT = '"Jua", "Apple SD Gothic Neo", -apple-system, sans-serif';
export const FILL = { white: '#ffffff', pink: '#ff8fc8', gold: '#ffd466', mint: '#9ff0dc' } as const;
export type Fill = keyof typeof FILL;

// 알약 한 개의 공통 모양 — 글자는 늘 남색, 테두리 2.5px, 아래로 떨어진 납작 그림자
export function cartoonPill(fill: Fill = 'white', extra: Partial<CSSStyleDeclaration> = {}): Partial<CSSStyleDeclaration> {
  return {
    color: INK, background: FILL[fill], border: `2.5px solid ${INK}`, borderRadius: '999px', boxShadow: `0 3px 0 ${INK}`,
    fontFamily: CARTOON_FONT, whiteSpace: 'nowrap', ...extra,
  };
}
