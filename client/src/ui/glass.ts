// 아이폰 리퀴드 글라스 느낌의 뒤 흐림 — 사파리(카톡 인앱 포함)는 -webkit- 접두어도 필요
export function backdropBlur(el: HTMLElement, value: string): void {
  el.style.setProperty('backdrop-filter', value);
  el.style.setProperty('-webkit-backdrop-filter', value);
}
