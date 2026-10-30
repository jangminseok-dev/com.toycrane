// 화면 위 정보 알약들(리퀴드 글라스): 왼쪽 위 코인·가방, 위쪽 가운데 진행 안내, 잠깐 뜨는 알림
import { backdropBlur } from './glass';

const FONT = '700 15px -apple-system, "Apple SD Gothic Neo", sans-serif';

function pill(style: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', zIndex: '20', padding: '8px 14px', borderRadius: '999px', color: '#fff', font: FONT, pointerEvents: 'none',
    background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.3)',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,.5), 0 8px 24px rgba(0,0,0,.3)', whiteSpace: 'nowrap', ...style,
  });
  backdropBlur(el, 'blur(16px) saturate(180%)');
  document.body.appendChild(el);
  return el;
}

let coinsEl: HTMLDivElement | null = null, bagEl: HTMLDivElement | null = null;
export function setHud(coins: number, bag: number): void {
  coinsEl ??= pill({ top: 'calc(env(safe-area-inset-top) + 14px)', left: 'calc(env(safe-area-inset-left) + 14px)' });
  bagEl ??= pill({ top: 'calc(env(safe-area-inset-top) + 14px)', left: 'calc(env(safe-area-inset-left) + 96px)' });
  coinsEl.textContent = `🪙 ${coins}`;
  bagEl.textContent = `🎒 ${bag}`;
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
  toastEl ??= pill({ top: '34%', left: '50%', transform: 'translateX(-50%)', font: '800 18px -apple-system, "Apple SD Gothic Neo", sans-serif', transition: 'opacity .3s' });
  toastEl.textContent = text;
  toastEl.style.opacity = '1';
  toastEl.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toastEl!.style.opacity = '0'; }, 1800);
}
