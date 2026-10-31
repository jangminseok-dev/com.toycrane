// 기계 한 판 조작(리퀴드 글라스): 오른쪽 아래 큰 분홍 유리 "내리기" 버튼(PC는 스페이스도), 위쪽 가운데 남은 시간.
// 판 사이에는 같은 자리에 "🪙1 한 번 더"(스페이스)와 그 옆 "그만하기"(Esc)
import { backdropBlur } from './glass';

let dropBtn: HTMLButtonElement | null = null, timerEl: HTMLDivElement | null = null;
let onDrop: (() => void) | null = null;

function build() {
  dropBtn = document.createElement('button');
  dropBtn.textContent = '내리기';
  Object.assign(dropBtn.style, {
    position: 'fixed', zIndex: '15', right: 'calc(env(safe-area-inset-right) + 22px)', bottom: 'calc(env(safe-area-inset-bottom) + 30px)',
    width: '112px', height: '112px', borderRadius: '50%', cursor: 'pointer', touchAction: 'manipulation',
    font: '900 22px -apple-system, "Apple SD Gothic Neo", sans-serif', color: '#2a0f1f',
    background: 'radial-gradient(120% 120% at 50% 15%, rgba(255,190,225,.95), rgba(255,95,170,.88))', border: '1px solid rgba(255,255,255,.6)',
    boxShadow: 'inset 0 2px 2px rgba(255,255,255,.75), inset 0 -8px 16px rgba(160,20,90,.25), 0 12px 30px rgba(255,95,180,.45)',
  });
  backdropBlur(dropBtn, 'blur(12px) saturate(180%)');
  dropBtn.addEventListener('click', () => onDrop?.());
  timerEl = document.createElement('div');
  Object.assign(timerEl.style, {
    position: 'fixed', zIndex: '20', top: 'calc(env(safe-area-inset-top) + 60px)', left: '50%', transform: 'translateX(-50%)',
    padding: '8px 18px', borderRadius: '999px', color: '#fff', font: '800 18px -apple-system, "Apple SD Gothic Neo", sans-serif',
    background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.3)', pointerEvents: 'none',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,.5), 0 8px 24px rgba(0,0,0,.3)',
  });
  backdropBlur(timerEl, 'blur(16px) saturate(180%)');
  addEventListener('keydown', (e) => { if (e.code === 'Space' && onDrop && !e.repeat) { e.preventDefault(); onDrop(); } }); // 꾹 누른 스페이스가 한 번 더 → 바로 내리기로 이어지지 않게
  document.body.append(dropBtn, timerEl);
}

export function showPlayControls(drop: () => void): void {
  if (!dropBtn) build();
  onDrop = drop;
  dropBtn!.style.display = 'block';
  timerEl!.style.display = 'block';
}

export function hidePlayControls(): void {
  onDrop = null;
  if (dropBtn) dropBtn.style.display = 'none';
  if (timerEl) timerEl.style.display = 'none';
}

export function setTimer(seconds: number): void {
  if (timerEl) timerEl.textContent = `${Math.max(0, Math.ceil(seconds))}초`;
}

let againBtn: HTMLButtonElement | null = null, standBtn: HTMLButtonElement | null = null;
let onAgain: (() => void) | null = null, onStand: (() => void) | null = null;

function buildSeat() {
  againBtn = document.createElement('button');
  Object.assign(againBtn.style, {
    position: 'fixed', zIndex: '15', right: 'calc(env(safe-area-inset-right) + 22px)', bottom: 'calc(env(safe-area-inset-bottom) + 30px)',
    width: '112px', height: '112px', borderRadius: '50%', cursor: 'pointer', touchAction: 'manipulation', whiteSpace: 'pre-line',
    font: '900 17px -apple-system, "Apple SD Gothic Neo", sans-serif', color: '#2a0f1f', lineHeight: '1.25',
    background: 'radial-gradient(120% 120% at 50% 15%, rgba(255,190,225,.95), rgba(255,95,170,.88))', border: '1px solid rgba(255,255,255,.6)',
    boxShadow: 'inset 0 2px 2px rgba(255,255,255,.75), inset 0 -8px 16px rgba(160,20,90,.25), 0 12px 30px rgba(255,95,180,.45)',
  });
  backdropBlur(againBtn, 'blur(12px) saturate(180%)');
  againBtn.addEventListener('click', () => onAgain?.());
  standBtn = document.createElement('button');
  standBtn.textContent = '그만하기';
  Object.assign(standBtn.style, {
    position: 'fixed', zIndex: '15', right: 'calc(env(safe-area-inset-right) + 146px)', bottom: 'calc(env(safe-area-inset-bottom) + 64px)',
    padding: '12px 18px', borderRadius: '999px', cursor: 'pointer', touchAction: 'manipulation',
    font: '800 15px -apple-system, "Apple SD Gothic Neo", sans-serif', color: '#fff',
    background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.4)',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,.5), 0 8px 24px rgba(0,0,0,.3)',
  });
  backdropBlur(standBtn, 'blur(14px) saturate(180%)');
  standBtn.addEventListener('click', () => onStand?.());
  addEventListener('keydown', (e) => {
    if (e.code === 'Space' && onAgain && !onDrop && !e.repeat) { e.preventDefault(); onAgain(); }
    if (e.code === 'Escape' && onStand) onStand();
  });
  document.body.append(againBtn, standBtn);
}

// again이 null이면 코인이 없어 한 번 더 할 수 없다(버튼은 흐리게, 누르면 안내)
export function showSeatControls(again: (() => void) | null, stand: () => void, noCoins: () => void): void {
  if (!againBtn) buildSeat();
  onAgain = again ?? noCoins; onStand = stand;
  againBtn!.textContent = again ? '🪙1\n한 번 더' : '교환소로\n가기';
  againBtn!.style.opacity = again ? '1' : '.55';
  againBtn!.style.display = 'block';
  standBtn!.style.display = 'block';
}

export function hideSeatControls(): void {
  onAgain = null; onStand = null;
  if (againBtn) againBtn.style.display = 'none';
  if (standBtn) standBtn.style.display = 'none';
}
