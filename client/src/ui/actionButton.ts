// 오른쪽 아래 행동 버튼(리퀴드 글라스, 분홍 유리): 지금 할 수 있는 일 하나 ("한 판 하기", "교환소 가기", "코인 받기"…).
// 버튼 안에는 할 일만, 코인 값은 오른쪽 작은 배지(🪙 1), 상태는 버튼 위 작은 글 — 가운데 점으로 잇지 않는다 (교환소 개편 설계 §4.7).
// extra가 있으면 그 위에 버튼 하나 더 ("다섯 판 하기 🪙 5", "조르기"). 매 프레임 불러도 바뀐 것만 고친다.
// 오른쪽 아래 버튼(판 사이 '한 판 더'·'다섯 판 더'·'그만하기'도)은 모두 같은 크기의 알약으로 아래부터 쌓는다(사용자 2026-11-02 사진 231·232·236)
import { CARTOON_FONT, INK, cartoonPill, type Fill } from './cartoon';

export type ActionExtra = { label: string; badge?: number | null; onPress: () => void };
export type ActionOpts = { status?: string | null; badge?: number | null; extra?: ActionExtra | null; dim?: boolean };

export function buttonParts(label: string, badge: number | null | undefined): { text: string; badge: string | null } {
  return { text: label, badge: badge != null ? `🪙 ${badge}` : null };
}

// 휴대폰: 화면 짧은 변이 600px 미만(지도 크기와 같은 기준)
export const isMobile = (): boolean => Math.min(globalThis.innerWidth ?? 1280, globalThis.innerHeight ?? 800) < 600;
// 버튼 한 개의 크기(px) — 모든 오른쪽 아래 버튼이 같다
export function buttonBox(mobile = isMobile()): { width: number; height: number; font: number; badge: number } {
  return mobile ? { width: 132, height: 42, font: 14, badge: 11 } : { width: 150, height: 46, font: 15, badge: 12 };
}
const GAP = 10, BASE = 26;
// 아래에서 slot번째 버튼의 바닥 높이(px, 안전 영역 위)
export const stackBottom = (slot: number, mobile = isMobile()): number => BASE + slot * (buttonBox(mobile).height + GAP);

// 카툰풍(ui/cartoon): 분홍(주 행동)·금빛(여러 판)·흰색(그만하기 — 유리 알약은 흰 글자가 안 보였다, 사용자 2026-11-02 사진 261)
export type ButtonLook = 'pink' | 'gold' | 'glass';
const LOOK_FILL: Record<ButtonLook, Fill> = { pink: 'pink', gold: 'gold', glass: 'white' };

// 오른쪽 아래 알약 버튼 하나(보이기 전엔 숨김) — 자리는 placeButton으로
export function pillButton(look: ButtonLook, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button'), b = buttonBox();
  Object.assign(el.style, {
    position: 'fixed', zIndex: '15', right: 'calc(env(safe-area-inset-right) + 20px)', cursor: 'pointer', touchAction: 'manipulation',
    width: `${b.width}px`, height: `${b.height}px`, padding: '0 10px', font: `400 ${b.font + 1}px ${CARTOON_FONT}`, boxSizing: 'border-box',
    display: 'none', alignItems: 'center', justifyContent: 'center', ...cartoonPill(LOOK_FILL[look]),
  });
  el.addEventListener('click', onClick);
  document.body.appendChild(el);
  return el;
}

// slot: 아래에서 몇 번째 자리, null이면 숨김
export function placeButton(el: HTMLButtonElement, slot: number | null): void {
  el.style.display = slot === null ? 'none' : 'flex';
  if (slot !== null) el.style.bottom = `calc(env(safe-area-inset-bottom) + ${stackBottom(slot)}px)`;
}

// 글자와 배지를 그린다 (같으면 그대로)
export function paintButton(el: HTMLButtonElement, label: string, badge: number | null | undefined): void {
  const parts = buttonParts(label, badge), key = `${parts.text}|${parts.badge ?? ''}`;
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  el.textContent = parts.text;
  if (parts.badge) {
    const chip = document.createElement('span');
    chip.textContent = parts.badge;
    Object.assign(chip.style, {
      marginLeft: '8px', padding: '1px 7px', borderRadius: '999px', font: `400 ${buttonBox().badge + 1}px ${CARTOON_FONT}`,
      background: '#fff', border: `2px solid ${INK}`, color: INK,
    });
    el.appendChild(chip);
  }
}

let button: HTMLButtonElement | null = null, extraButton: HTMLButtonElement | null = null, statusEl: HTMLDivElement | null = null;
let handler: (() => void) | undefined, extraHandler: (() => void) | undefined;

export function setAction(label: string | null, onPress?: () => void, opts: ActionOpts = {}): void {
  handler = onPress;
  button ??= pillButton('pink', () => handler?.());
  if (label) paintButton(button, label, opts.badge);
  placeButton(button, label ? 0 : null);
  button.style.opacity = opts.dim ? '.55' : '1';
  const extra = label ? opts.extra ?? null : null;
  setExtra(extra);
  setStatus(label ? opts.status ?? null : null, !!extra);
}

function setExtra(extra: ActionExtra | null): void {
  extraHandler = extra?.onPress;
  extraButton ??= pillButton('gold', () => extraHandler?.());
  if (extra) paintButton(extraButton, extra.label, extra.badge);
  placeButton(extraButton, extra ? 1 : null);
}


// 버튼 위 작은 상태 글 ("코인이 없어요", "코인이 넉넉해요"…)
function setStatus(text: string | null, aboveExtra: boolean): void {
  if (!statusEl) {
    statusEl = document.createElement('div');
    Object.assign(statusEl.style, {
      position: 'fixed', zIndex: '15', right: 'calc(env(safe-area-inset-right) + 24px)', padding: '4px 12px',
      font: `400 14px ${CARTOON_FONT}`, pointerEvents: 'none', ...cartoonPill('white'), boxShadow: `0 2px 0 ${INK}`,
    });
    document.body.appendChild(statusEl);
  }
  if (statusEl.textContent !== (text ?? '')) statusEl.textContent = text ?? '';
  statusEl.style.bottom = `calc(env(safe-area-inset-bottom) + ${stackBottom(aboveExtra ? 2 : 1)}px)`;
  statusEl.style.display = text ? 'block' : 'none';
}
