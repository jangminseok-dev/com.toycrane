// 오른쪽 아래 행동 버튼(리퀴드 글라스, 분홍 유리): 지금 할 수 있는 일 하나 ("한 판 하기", "교환소 가기", "코인 받기"…).
// 버튼 안에는 할 일만, 코인 값은 오른쪽 작은 배지(🪙 1), 상태는 버튼 위 작은 글 — 가운데 점으로 잇지 않는다 (교환소 개편 설계 §4.7).
// extra가 있으면 그 위에 작은 버튼 하나 더 ("다섯 판 하기 🪙 5", "조르기"). 매 프레임 불러도 바뀐 것만 고친다
import { backdropBlur } from './glass';

export type ActionExtra = { label: string; badge?: number | null; onPress: () => void };
export type ActionOpts = { status?: string | null; badge?: number | null; extra?: ActionExtra | null; dim?: boolean };

export function buttonParts(label: string, badge: number | null | undefined): { text: string; badge: string | null } {
  return { text: label, badge: badge != null ? `🪙 ${badge}` : null };
}

const FONT = '-apple-system, "Apple SD Gothic Neo", sans-serif';
let button: HTMLButtonElement | null = null, extraButton: HTMLButtonElement | null = null, statusEl: HTMLDivElement | null = null;
let handler: (() => void) | undefined, extraHandler: (() => void) | undefined;

// 글자와 배지를 그린다 (같으면 그대로)
function paint(el: HTMLButtonElement, label: string, badge: number | null | undefined): void {
  const parts = buttonParts(label, badge), key = `${parts.text}|${parts.badge ?? ''}`;
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  el.textContent = parts.text;
  if (parts.badge) {
    const chip = document.createElement('span');
    chip.textContent = parts.badge;
    Object.assign(chip.style, {
      marginLeft: '10px', padding: '3px 8px', borderRadius: '999px', font: `800 13px ${FONT}`,
      background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.75)', verticalAlign: '1px',
    });
    el.appendChild(chip);
  }
}

function make(style: Partial<CSSStyleDeclaration>, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  Object.assign(el.style, {
    position: 'fixed', zIndex: '15', right: 'calc(env(safe-area-inset-right) + 20px)', cursor: 'pointer', touchAction: 'manipulation',
    color: '#2a0f1f', whiteSpace: 'nowrap', ...style,
  });
  backdropBlur(el, 'blur(12px) saturate(180%)');
  el.addEventListener('click', onClick);
  document.body.appendChild(el);
  return el;
}

export function setAction(label: string | null, onPress?: () => void, opts: ActionOpts = {}): void {
  handler = onPress;
  button ??= make({
    bottom: 'calc(env(safe-area-inset-bottom) + 34px)', minWidth: '132px', padding: '15px 20px', borderRadius: '22px', font: `800 17px ${FONT}`,
    background: 'linear-gradient(180deg, rgba(255,150,205,.92), rgba(255,110,175,.82))', border: '1px solid rgba(255,255,255,.5)',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,.7), 0 10px 26px rgba(255,95,180,.35)',
  }, () => handler?.());
  if (label) paint(button, label, opts.badge);
  button.style.display = label ? 'block' : 'none';
  button.style.opacity = opts.dim ? '.55' : '1';
  const extra = label ? opts.extra ?? null : null;
  setExtra(extra);
  setStatus(label ? opts.status ?? null : null, !!extra);
}

function setExtra(extra: ActionExtra | null): void {
  extraHandler = extra?.onPress;
  extraButton ??= make({
    bottom: 'calc(env(safe-area-inset-bottom) + 98px)', minWidth: '132px', padding: '10px 18px', borderRadius: '18px', font: `800 15px ${FONT}`,
    background: 'linear-gradient(180deg, rgba(255,226,138,.92), rgba(255,190,90,.84))', border: '1px solid rgba(255,255,255,.55)',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,.7), 0 8px 22px rgba(255,170,60,.32)',
  }, () => extraHandler?.());
  if (extra) paint(extraButton, extra.label, extra.badge);
  extraButton.style.display = extra ? 'block' : 'none';
}

// 버튼 위 작은 상태 글 ("코인이 없어요", "코인이 넉넉해요"…)
function setStatus(text: string | null, aboveExtra: boolean): void {
  if (!statusEl) {
    statusEl = document.createElement('div');
    Object.assign(statusEl.style, {
      position: 'fixed', zIndex: '15', right: 'calc(env(safe-area-inset-right) + 24px)', padding: '5px 12px', borderRadius: '999px',
      font: `700 13px ${FONT}`, color: '#2a0f1f', background: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.85)',
      boxShadow: '0 6px 16px rgba(60,20,80,.15)', pointerEvents: 'none', whiteSpace: 'nowrap',
    });
    backdropBlur(statusEl, 'blur(12px) saturate(180%)');
    document.body.appendChild(statusEl);
  }
  if (statusEl.textContent !== (text ?? '')) statusEl.textContent = text ?? '';
  statusEl.style.bottom = `calc(env(safe-area-inset-bottom) + ${aboveExtra ? 150 : 98}px)`;
  statusEl.style.display = text ? 'block' : 'none';
}
