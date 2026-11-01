import { expect, test } from 'vitest';
import { blockSelect, installNoSelect } from './noSelect';

// 휴대폰에서 버튼을 꾹 누르면 화면 전체가 선택되어 파래지고 그림 끌기가 떴다(사용자 2026-11-02, 카톡 인앱) —
// 게임 화면(캔버스)은 글자 선택·길게 누르기 메뉴·끌기를 막는다. 닉네임 입력칸의 선택은 그대로
test('the game canvas ignores long-press selection, menus and drags', () => {
  const listeners = new Map<string, (e: { target: unknown; preventDefault(): void }) => void>();
  const canvas = { style: {} as Record<string, string>, addEventListener: (type: string, fn: (e: { target: unknown; preventDefault(): void }) => void) => { listeners.set(type, fn); } };
  installNoSelect(canvas);
  expect(canvas.style).toMatchObject({ userSelect: 'none', webkitUserSelect: 'none', webkitTouchCallout: 'none' });
  for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
    let prevented = false;
    listeners.get(type)?.({ target: canvas, preventDefault: () => { prevented = true; } });
    expect(prevented, type).toBe(true);
  }
});

test('page selection is blocked except inside text inputs', () => {
  const run = (tagName: string) => { let prevented = false; blockSelect({ target: { tagName }, preventDefault: () => { prevented = true; } }); return prevented; };
  expect(run('DIV')).toBe(true);
  expect(run('CANVAS')).toBe(true);
  expect(run('INPUT')).toBe(false);
  expect(run('TEXTAREA')).toBe(false);
});
