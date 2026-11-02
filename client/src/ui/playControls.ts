// 기계 한 판 화면(리퀴드 글라스): 남은 시간은 기계 조작대 위 표시판(world/machineTimer, 사용자 2026-11-02), 위쪽 가운데에는 여러 판을
// 이어 할 때만 작은 '2/5판', 판이 시작할 때 3초만 그 아래 조작 안내.
// 집게는 기계에 그려진 레버와 하강 버튼으로 움직인다(설계 2026-10-31 §3.10, 3차). 문구는 copy.ts(가운데 점 없이).
// 판 사이에는 오른쪽 아래에 "한 판 더 🪙1"(스페이스), 그 위 "다섯 판 더 🪙5", 그 위 "그만하기"(Esc) — 걷기 버튼과 같은 알약. 여러 판을 이어 하는 중에는 "그만하기"만
import { CARTOON_FONT, cartoonPill } from './cartoon';
import { UI } from '../world/copy';
import { paintButton, pillButton, placeButton } from './actionButton';

let runEl: HTMLDivElement | null = null, hintEl: HTMLDivElement | null = null;
let hintTimer = 0;
let playing = false;


function build() {
  const pill = (top: string, font: string, fill: 'white' | 'pink') => { // 카툰 알약(ui/cartoon) — 기계 위 밝은 틀 위에서도 남색 테두리로 읽힌다(사용자 2026-11-02 사진 259·260)
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed', zIndex: '20', top, left: '50%', transform: 'translateX(-50%)', padding: '7px 18px', font, pointerEvents: 'none', ...cartoonPill(fill),
    });
    document.body.appendChild(el);
    return el;
  };
  // 여러 판 진행만 작은 알약에 — 안내는 판이 시작할 때 3초만 그 아래에 (계속 두면 뒷판 모니터를 가린다)
  runEl = pill('calc(env(safe-area-inset-top) + 60px)', `400 15px ${CARTOON_FONT}`, 'pink');
  runEl.style.display = 'none';
  hintEl = pill('calc(env(safe-area-inset-top) + 106px)', `400 15px ${CARTOON_FONT}`, 'white');
  hintEl.textContent = UI.hint;
  hintEl.style.transition = 'opacity .4s';
}

export function showPlayControls(): void {
  if (!runEl) build();
  playing = true;
}

export function hidePlayControls(): void {
  playing = false;
  if (runEl) runEl.style.display = 'none';
  if (hintEl) hintEl.style.display = 'none';
}

// 판이 시작할 때 조작 안내를 3초만 (피규어 기계는 버튼 안내)
export function showHint(text: string = UI.hint): void {
  if (!hintEl) build();
  clearTimeout(hintTimer);
  hintEl!.textContent = text;
  hintEl!.style.display = 'block'; hintEl!.style.opacity = '1';
  hintTimer = window.setTimeout(() => { hintEl!.style.opacity = '0'; hintTimer = window.setTimeout(() => { hintEl!.style.display = 'none'; }, 400); }, 3000);
}

// run: 여러 판을 이어 하는 중이면 작은 "2/5판"(아니면 숨김)
export function setRunBadge(run: string | null): void {
  if (!runEl || !playing) return;
  if (runEl.textContent !== (run ?? '')) runEl.textContent = run ?? '';
  runEl.style.display = run ? 'block' : 'none';
}

let againBtn: HTMLButtonElement | null = null, moreBtn: HTMLButtonElement | null = null, standBtn: HTMLButtonElement | null = null;
let onAgain: (() => void) | null = null, onMore: (() => void) | null = null, onStand: (() => void) | null = null;

// 판 사이 버튼도 걷기 버튼과 같은 알약(actionButton) — 아래부터 '한 판 더', '다섯 판 더', '그만하기'(사용자 2026-11-02 사진 236 '깔끔하게')
function buildSeat() {
  againBtn = pillButton('pink', () => onAgain?.());
  moreBtn = pillButton('gold', () => onMore?.());
  standBtn = pillButton('glass', () => onStand?.());
  paintButton(standBtn, UI.stand, null);
  addEventListener('keydown', (e) => {
    if (e.code === 'Space' && onAgain && !playing && !e.repeat) { e.preventDefault(); onAgain(); }
    if (e.code === 'Escape' && onStand) onStand();
  });
}

// again이 null이면 코인이 없어 한 번 더 할 수 없다(버튼은 흐리게 '교환소 가기'). more: 여러 판 이어 하기 (코인이 두 개 이상일 때)
export function showSeatControls(again: (() => void) | null, more: { plays: number; onPress: () => void } | null, stand: () => void, noCoins: () => void): void {
  if (!againBtn) buildSeat();
  onAgain = again ?? noCoins; onMore = more?.onPress ?? null; onStand = stand;
  paintButton(againBtn!, again ? UI.again : UI.goCounter, again ? 1 : null);
  againBtn!.style.opacity = again ? '1' : '.55';
  if (more) paintButton(moreBtn!, UI.againRun(more.plays), more.plays);
  placeButton(againBtn!, 0);
  placeButton(moreBtn!, more ? 1 : null);
  placeButton(standBtn!, more ? 2 : 1);
}

// 여러 판을 이어 하는 중 판 사이: 다음 판이 저절로 시작되기 전까지 "그만하기"만
export function showRunPause(stand: () => void): void {
  if (!againBtn) buildSeat();
  onAgain = null; onMore = null; onStand = stand;
  placeButton(againBtn!, null);
  placeButton(moreBtn!, null);
  placeButton(standBtn!, 0);
}

export function hideSeatControls(): void {
  onAgain = null; onMore = null; onStand = null;
  if (againBtn) placeButton(againBtn, null);
  if (moreBtn) placeButton(moreBtn, null);
  if (standBtn) placeButton(standBtn, null);
}
