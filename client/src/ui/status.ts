// 화면 위쪽 가운데 작은 상태 표시 ("다시 연결 중…" 등). null이면 숨김
let pill: HTMLDivElement | null = null;

export function setStatus(text: string | null): void {
  if (!pill) {
    pill = document.createElement('div');
    Object.assign(pill.style, {
      position: 'fixed', top: '14px', left: '50%', transform: 'translateX(-50%)', zIndex: '20',
      padding: '8px 16px', borderRadius: '999px', background: 'rgba(28,21,38,.85)', color: '#ffd6f3',
      font: '700 14px -apple-system, "Apple SD Gothic Neo", sans-serif', border: '1px solid rgba(255,95,220,.5)',
      pointerEvents: 'none',
    });
    document.body.appendChild(pill);
  }
  pill.textContent = text ?? '';
  pill.style.display = text ? 'block' : 'none';
}
