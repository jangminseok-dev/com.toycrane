// 화면 위 정보 알약들(카툰풍, ui/cartoon): 왼쪽 위 코인·가방·소리를 한 줄에 같은 높이·같은 간격으로, 위쪽 가운데 진행 안내, 잠깐 뜨는 알림
import { CARTOON_FONT, cartoonPill } from './cartoon';

const BAR_H = 36;
function pill(style: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const el = document.createElement('div');
  Object.assign(el.style, { position: 'fixed', zIndex: '20', padding: '7px 14px', font: `400 15px ${CARTOON_FONT}`, pointerEvents: 'none', ...cartoonPill('white'), ...style });
  document.body.appendChild(el);
  return el;
}
// 왼쪽 위 한 줄(코인·가방·소리): 알약은 모두 같은 높이, 사이 8px
let bar: HTMLDivElement | null = null;
function barPill(minWidth: number, style: Partial<CSSStyleDeclaration> = {}): HTMLDivElement {
  if (!bar) {
    bar = document.createElement('div');
    Object.assign(bar.style, { position: 'fixed', zIndex: '20', top: 'calc(env(safe-area-inset-top) + 12px)', left: 'calc(env(safe-area-inset-left) + 12px)', display: 'flex', gap: '8px', alignItems: 'center' });
    document.body.appendChild(bar);
  }
  const el = document.createElement('div');
  Object.assign(el.style, {
    height: `${BAR_H}px`, minWidth: `${minWidth}px`, padding: '0 12px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
    font: `400 15px ${CARTOON_FONT}`, ...cartoonPill('white'), ...style,
  });
  bar.appendChild(el);
  return el;
}

let coinsEl: HTMLDivElement | null = null, bagEl: HTMLDivElement | null = null, bagTap: (() => void) | null = null;
// 가방 칸을 누르면 가방 보기(설계 2026-11-02 §5)
export function onBagTap(fn: () => void): void { bagTap = fn; }
export function setHud(coins: number, bag: number): void {
  coinsEl ??= barPill(74);
  if (!bagEl) {
    bagEl = barPill(74, { cursor: 'pointer' });
    bagEl.className = 'hud-bag';
    bagEl.addEventListener('click', () => bagTap?.());
  }
  coinsEl.textContent = `🪙 ${coins}`;
  bagEl.textContent = `🎒 ${bag}`;
}

// 소리 켜기·끄기(설계 2026-11-02 §7): 가방 칸 바로 옆 🔊/🔇 — 같은 높이의 동그란 알약
let soundEl: HTMLDivElement | null = null;
export function soundButton(muted: boolean, labels: { on: string; off: string }, onToggle: (muted: boolean) => void): void {
  soundEl ??= barPill(BAR_H, { padding: '0', cursor: 'pointer' });
  soundEl.className = 'hud-sound';
  const paint = () => { soundEl!.textContent = muted ? '🔇' : '🔊'; soundEl!.setAttribute('aria-label', muted ? labels.on : labels.off); };
  soundEl.onclick = () => { muted = !muted; paint(); onToggle(muted); };
  paint();
}

// 계속 보이는 진행 안내 ("줄 서는 중 · 3번째" 등). null이면 숨김
let infoEl: HTMLDivElement | null = null;
export function setInfo(text: string | null): void {
  infoEl ??= pill({ top: 'calc(env(safe-area-inset-top) + 60px)', left: '50%', transform: 'translateX(-50%)' });
  if (infoEl.textContent !== (text ?? '')) infoEl.textContent = text ?? '';
  infoEl.style.display = text ? 'block' : 'none';
}

// 잠깐 떴다 사라지는 알림 ("🪙 +5" 등)
let toastEl: HTMLDivElement | null = null, toastTimer = 0;
export function toast(text: string): void {
  toastEl ??= pill({ top: '34%', left: '50%', transform: 'translateX(-50%)', font: `400 19px ${CARTOON_FONT}`, padding: '9px 18px', transition: 'opacity .3s' });
  toastEl.textContent = text;
  toastEl.style.opacity = '1';
  toastEl.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toastEl!.style.opacity = '0'; }, 1800);
}
