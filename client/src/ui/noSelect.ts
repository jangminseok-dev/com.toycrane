// 휴대폰에서 버튼을 꾹 누르면(피규어 버튼 ①②는 누르고 있는 동안 움직인다) 화면 전체가 선택되어 파래지고 캔버스 그림 끌기가 떴다
// (사용자 2026-11-02, 카톡 인앱 iOS) — 게임 화면은 글자 선택·길게 누르기 메뉴·끌기를 막는다. 닉네임 입력칸은 그대로
type Prevented = { target: unknown; preventDefault(): void };
type Target = { style: object; addEventListener(type: string, fn: (e: Prevented) => void, opts?: { passive: boolean }): void };

export function blockSelect(e: Prevented): void {
  const tag = (e.target as { tagName?: string } | null)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  e.preventDefault();
}

export function installNoSelect(el: Target): void {
  Object.assign(el.style, { userSelect: 'none', webkitUserSelect: 'none', webkitTouchCallout: 'none', webkitTapHighlightColor: 'transparent' });
  for (const type of ['contextmenu', 'selectstart', 'dragstart']) el.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
