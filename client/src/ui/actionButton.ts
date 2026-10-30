// 오른쪽 아래 행동 버튼 하나(리퀴드 글라스, 분홍 유리): "줄 서기", "🪙1 넣고 하기" 등 지금 할 수 있는 일
import { backdropBlur } from './glass';

let button: HTMLButtonElement | null = null;
let handler: (() => void) | undefined;

export function setAction(label: string | null, onPress?: () => void): void {
  handler = onPress;
  if (!button) {
    button = document.createElement('button');
    Object.assign(button.style, {
      position: 'fixed', zIndex: '15', right: 'calc(env(safe-area-inset-right) + 20px)', bottom: 'calc(env(safe-area-inset-bottom) + 34px)',
      minWidth: '132px', padding: '15px 20px', borderRadius: '22px', cursor: 'pointer', touchAction: 'manipulation',
      font: '800 17px -apple-system, "Apple SD Gothic Neo", sans-serif', color: '#2a0f1f',
      background: 'linear-gradient(180deg, rgba(255,150,205,.92), rgba(255,110,175,.82))', border: '1px solid rgba(255,255,255,.5)',
      boxShadow: 'inset 0 1px 1px rgba(255,255,255,.7), 0 10px 26px rgba(255,95,180,.35)',
    });
    backdropBlur(button, 'blur(12px) saturate(180%)');
    button.addEventListener('click', () => handler?.());
    document.body.appendChild(button);
  }
  if (button.textContent !== (label ?? '')) button.textContent = label ?? '';
  button.style.display = label ? 'block' : 'none';
}
