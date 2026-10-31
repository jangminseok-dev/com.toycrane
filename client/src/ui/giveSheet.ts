// 코인 주기 창 (교환소 개편 설계 §4.4): 조르는 사람에게 줄 개수를 고른다 — 1개부터 줄 수 있는 최대까지, 기본 1개,
// −/+/'최대'와 '주기'. 바깥(어두운 바탕)을 누르면 닫힌다. 리퀴드 글라스
import { UI } from '../world/copy';
import { backdropBlur } from './glass';

export function clampGive(n: number, max: number): number {
  return Math.min(max, Math.max(1, Math.round(n)));
}

const FONT = '-apple-system, "Apple SD Gothic Neo", sans-serif';
let shade: HTMLDivElement | null = null;

export function closeGiveSheet(): void {
  shade?.remove();
  shade = null;
}

export function openGiveSheet(opts: { nick: string; max: number; onGive(n: number): void; onCancel?(): void }): void {
  closeGiveSheet();
  let n = 1;
  shade = document.createElement('div');
  Object.assign(shade.style, { position: 'fixed', inset: '0', zIndex: '30', background: 'rgba(20,10,30,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' });
  shade.addEventListener('click', (e) => { if (e.target === shade) { closeGiveSheet(); opts.onCancel?.(); } });
  const card = document.createElement('div');
  Object.assign(card.style, {
    minWidth: '260px', padding: '20px 22px', borderRadius: '26px', textAlign: 'center', color: '#2a0f1f', font: `700 15px ${FONT}`,
    background: 'rgba(255,255,255,.72)', border: '1px solid rgba(255,255,255,.85)', boxShadow: '0 20px 50px rgba(40,10,60,.35)',
  });
  backdropBlur(card, 'blur(20px) saturate(180%)');
  const title = document.createElement('div'); title.textContent = UI.giveTitle(opts.nick);
  const count = document.createElement('div');
  Object.assign(count.style, { font: `900 34px ${FONT}`, margin: '12px 0' });
  const paint = () => { count.textContent = `🪙 ${UI.giveCount(n)}`; };
  const button = (text: string, onClick: () => void, strong = false) => {
    const b = document.createElement('button'); b.textContent = text;
    Object.assign(b.style, {
      margin: '0 4px', padding: strong ? '12px 26px' : '9px 14px', borderRadius: '999px', cursor: 'pointer', touchAction: 'manipulation',
      font: `800 ${strong ? 17 : 15}px ${FONT}`, color: '#2a0f1f', border: '1px solid rgba(255,255,255,.7)',
      background: strong ? 'linear-gradient(180deg, rgba(255,150,205,.95), rgba(255,110,175,.85))' : 'rgba(255,255,255,.6)',
    });
    b.addEventListener('click', onClick);
    return b;
  };
  const row = document.createElement('div');
  row.append(
    button('−', () => { n = clampGive(n - 1, opts.max); paint(); }),
    button('+', () => { n = clampGive(n + 1, opts.max); paint(); }),
    button(UI.giveMax, () => { n = opts.max; paint(); }),
  );
  const go = document.createElement('div'); go.style.marginTop = '14px';
  go.append(button(UI.give, () => { closeGiveSheet(); opts.onGive(n); }, true));
  card.append(title, count, row, go);
  shade.appendChild(card);
  document.body.appendChild(shade);
  paint();
}
