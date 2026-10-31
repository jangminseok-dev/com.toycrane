// 기계 한 판 화면(리퀴드 글라스): 위쪽 가운데 남은 시간과 조작 안내. 집게는 기계에 그려진 레버와 하강 버튼으로 움직인다(설계 2026-10-31 §3.10, 3차).
// 판 사이에는 오른쪽 아래에 "🪙1 한 번 더"(스페이스)와 그 옆 "그만하기"(Esc)
import { backdropBlur } from './glass';

let timerEl: HTMLDivElement | null = null, hintEl: HTMLSpanElement | null = null, timeEl: HTMLSpanElement | null = null;
let playing = false;

const HINT = '레버를 끌어 움직이고 · 하강 버튼으로 잡아요';

function build() {
  const pill = (top: string, font: string) => {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed', zIndex: '20', top, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap',
      padding: '8px 18px', borderRadius: '999px', color: '#2a0f1f', font,
      background: 'rgba(255,255,255,.62)', border: '1px solid rgba(255,255,255,.8)', pointerEvents: 'none',
      boxShadow: 'inset 0 1px 1px rgba(255,255,255,.8), 0 8px 24px rgba(60,20,80,.18)',
    });
    backdropBlur(el, 'blur(16px) saturate(180%)');
    document.body.appendChild(el);
    return el;
  };
  // 남은 시간과 안내를 한 알약에 — 두 줄로 쌓으면 뒷판 모니터(위에서 본 화면)를 가린다
  timerEl = pill('calc(env(safe-area-inset-top) + 60px)', '800 16px -apple-system, "Apple SD Gothic Neo", sans-serif');
  hintEl = document.createElement('span');
  Object.assign(hintEl.style, { font: '700 13px -apple-system, "Apple SD Gothic Neo", sans-serif', marginLeft: '8px', opacity: '.85' });
  timeEl = document.createElement('span');
  timerEl.append(timeEl, hintEl);
}

export function showPlayControls(): void {
  if (!timerEl) build();
  playing = true;
  timerEl!.style.display = 'block';
}

export function hidePlayControls(): void {
  playing = false;
  if (timerEl) timerEl.style.display = 'none';
}

export function setTimer(seconds: number): void {
  if (!timerEl || !hintEl || !timeEl) return;
  timeEl.textContent = `${Math.max(0, Math.ceil(seconds))}초`;
  if (hintEl.textContent !== HINT) hintEl.textContent = HINT;
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
    if (e.code === 'Space' && onAgain && !playing && !e.repeat) { e.preventDefault(); onAgain(); }
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
