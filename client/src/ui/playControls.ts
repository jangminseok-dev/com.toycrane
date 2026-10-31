// 기계 한 판 화면(리퀴드 글라스): 위쪽 가운데 남은 시간과 조작 안내. 집게는 기계에 그려진 레버와 하강 버튼으로 움직인다(설계 2026-10-31 §3.10, 3차).
// 판 사이에는 오른쪽 아래에 "🪙1 한 번 더"(스페이스), 그 위 "🪙5 다섯 판 더", 옆에 "그만하기"(Esc). 여러 판을 이어 하는 중에는 "그만하기"만
import { backdropBlur } from './glass';

let timerEl: HTMLDivElement | null = null, hintEl: HTMLSpanElement | null = null, timeEl: HTMLSpanElement | null = null;
let playing = false;

const HINT = '레버로 움직이고 · 잡기 버튼을 눌러요';

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

// run: 여러 판을 이어 하는 중이면 "2/5판"
export function setTimer(seconds: number, run: string | null = null): void {
  if (!timerEl || !hintEl || !timeEl) return;
  const text = `${Math.max(0, Math.ceil(seconds))}초${run ? ` · ${run}` : ''}`;
  if (timeEl.textContent !== text) timeEl.textContent = text;
  if (hintEl.textContent !== HINT) hintEl.textContent = HINT;
}

let againBtn: HTMLButtonElement | null = null, moreBtn: HTMLButtonElement | null = null, standBtn: HTMLButtonElement | null = null;
let onAgain: (() => void) | null = null, onMore: (() => void) | null = null, onStand: (() => void) | null = null;

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
  moreBtn = document.createElement('button');
  Object.assign(moreBtn.style, {
    position: 'fixed', zIndex: '15', right: 'calc(env(safe-area-inset-right) + 22px)', bottom: 'calc(env(safe-area-inset-bottom) + 154px)',
    width: '112px', padding: '10px 0', borderRadius: '999px', cursor: 'pointer', touchAction: 'manipulation',
    font: '900 14px -apple-system, "Apple SD Gothic Neo", sans-serif', color: '#2a0f1f',
    background: 'linear-gradient(180deg, rgba(255,226,138,.95), rgba(255,190,90,.88))', border: '1px solid rgba(255,255,255,.6)',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,.75), 0 8px 22px rgba(255,170,60,.35)',
  });
  backdropBlur(moreBtn, 'blur(12px) saturate(180%)');
  moreBtn.addEventListener('click', () => onMore?.());
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
  document.body.append(againBtn, moreBtn, standBtn);
}

// again이 null이면 코인이 없어 한 번 더 할 수 없다(버튼은 흐리게, 누르면 안내). more: 여러 판 이어 하기 (코인이 두 개 이상일 때)
export function showSeatControls(again: (() => void) | null, more: { plays: number; name: string; onPress: () => void } | null, stand: () => void, noCoins: () => void): void {
  if (!againBtn) buildSeat();
  onAgain = again ?? noCoins; onMore = more?.onPress ?? null; onStand = stand;
  againBtn!.textContent = again ? '🪙1\n한 번 더' : '교환소로\n가기';
  againBtn!.style.opacity = again ? '1' : '.55';
  againBtn!.style.display = 'block';
  moreBtn!.textContent = more ? `🪙${more.plays} ${more.name} 더` : '';
  moreBtn!.style.display = more ? 'block' : 'none';
  standBtn!.style.display = 'block';
}

// 여러 판을 이어 하는 중 판 사이: 다음 판이 저절로 시작되기 전까지 "그만하기"만
export function showRunPause(stand: () => void): void {
  if (!againBtn) buildSeat();
  onAgain = null; onMore = null; onStand = stand;
  againBtn!.style.display = 'none';
  moreBtn!.style.display = 'none';
  standBtn!.style.display = 'block';
}

export function hideSeatControls(): void {
  onAgain = null; onMore = null; onStand = null;
  if (againBtn) againBtn.style.display = 'none';
  if (moreBtn) moreBtn.style.display = 'none';
  if (standBtn) standBtn.style.display = 'none';
}
