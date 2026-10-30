// 화면 위쪽 가운데 작은 유리 알약 상태 표시 ("다시 연결 중…" 등). null이면 숨김
import { backdropBlur } from './glass';

let pill: HTMLDivElement | null = null;

export function setStatus(text: string | null): void {
  if (!pill) {
    pill = document.createElement('div');
    Object.assign(pill.style, {
      position: 'fixed', top: '14px', left: '50%', transform: 'translateX(-50%)', zIndex: '20',
      padding: '8px 16px', borderRadius: '999px', color: '#fff',
      font: '700 14px -apple-system, "Apple SD Gothic Neo", sans-serif',
      background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.3)',
      boxShadow: 'inset 0 1px 1px rgba(255,255,255,.5), 0 8px 24px rgba(0,0,0,.3)',
      pointerEvents: 'none',
    });
    backdropBlur(pill, 'blur(16px) saturate(180%)');
    document.body.appendChild(pill);
  }
  pill.textContent = text ?? '';
  pill.style.display = text ? 'block' : 'none';
}
