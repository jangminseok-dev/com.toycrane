// 당첨 카드(본인만, 설계 §5.4): 가운데 유리 카드, 2.2초 뒤 저절로·누르면 바로 닫힘. 희귀는 분홍 빛, 황금(매우 희귀)은 진한 금빛 (인형 채우기 설계 §4.6).
// 한 판에 여러 개면 모두 — 첫 인형은 크게, 나머지는 아래 한 줄씩(사용자 2026-11-02 '여러 개 뽑았는데 하나만 나온다'), 하나 더할 때마다 조금 더 오래
import { GOLD } from '../data/catalog';
import { backdropBlur } from './glass';

let card: HTMLDivElement | null = null, timer = 0;

export type Tier = '' | 'rare' | 'gold';
const MORE_MAX = 4; // 아래 줄에 이름을 이만큼까지, 넘으면 '외 N개'
export function winCardText(names: string[], tier: Tier): { head: string; title: string; more: string[] } {
  const count = names.length > 1 ? ` ${names.length}개!` : '', rest = names.slice(1);
  const more = rest.length > MORE_MAX ? [...rest.slice(0, MORE_MAX), `외 ${rest.length - MORE_MAX}개`] : rest;
  if (tier === 'gold') return { head: `★★ 매우 희귀!${count}`, title: `★★ ${names[0]}`, more };
  if (tier === 'rare') return { head: `★ 희귀!${count}`, title: `★ ${names[0]}`, more };
  return { head: `짠!${count}`, title: names[0], more };
}
// 여러 개 중 가장 높은 등급(희귀 효과 id들 — 황금 > 희귀 > 보통)
export function winTier(rares: string[]): Tier {
  return rares.includes(GOLD.id) ? 'gold' : rares.some((r) => r) ? 'rare' : '';
}
const LOOK = {
  '': { bg: 'linear-gradient(160deg, rgba(255,255,255,.2), rgba(255,255,255,.06))', border: 'rgba(255,255,255,.35)', glow: 'rgba(255,95,220,.25)', head: '#ff9fe8' },
  rare: { bg: 'linear-gradient(160deg, rgba(255,160,220,.4), rgba(255,110,190,.16))', border: 'rgba(255,170,225,.85)', glow: 'rgba(255,120,210,.45)', head: '#ffc4ec' },
  gold: { bg: 'linear-gradient(160deg, rgba(255,214,90,.6), rgba(214,140,20,.3))', border: 'rgba(255,214,107,.95)', glow: 'rgba(255,200,70,.7)', head: '#ffe28a' },
};

export function showWinCard(names: string[], setName: string, tier: Tier, bag: number): void {
  if (!card) {
    card = document.createElement('div');
    Object.assign(card.style, {
      position: 'fixed', zIndex: '25', left: '50%', top: '42%', transform: 'translate(-50%, -50%)', minWidth: '230px', padding: '22px 26px',
      borderRadius: '28px', textAlign: 'center', color: '#fff', font: '700 15px -apple-system, "Apple SD Gothic Neo", sans-serif',
      transition: 'opacity .25s, transform .25s', cursor: 'pointer',
    });
    backdropBlur(card, 'blur(22px) saturate(180%)');
    card.addEventListener('click', () => hide());
    document.body.appendChild(card);
  }
  Object.assign(card.style, {
    background: LOOK[tier].bg,
    border: `1px solid ${LOOK[tier].border}`,
    boxShadow: `inset 0 1px 1px rgba(255,255,255,.55), 0 20px 50px rgba(0,0,0,.4), 0 0 46px ${LOOK[tier].glow}`,
    display: 'block', opacity: '1', transform: 'translate(-50%, -50%) scale(1)',
  });
  card.innerHTML = '';
  const line = (text: string, style: Partial<CSSStyleDeclaration>) => {
    const el = document.createElement('div'); el.textContent = text; Object.assign(el.style, style); card!.appendChild(el);
  };
  const text = winCardText(names, tier);
  line(text.head, { font: '900 20px -apple-system, "Apple SD Gothic Neo", sans-serif', color: LOOK[tier].head });
  line(text.title, { font: '900 28px -apple-system, "Apple SD Gothic Neo", sans-serif', margin: '6px 0 4px' });
  for (const more of text.more) line(more, { font: '800 17px -apple-system, "Apple SD Gothic Neo", sans-serif', margin: '2px 0' });
  line(setName, { color: 'rgba(255,255,255,.75)', marginTop: text.more.length ? '6px' : '0' });
  line(`가방 ${bag}개째`, { marginTop: '10px', color: 'rgba(255,255,255,.85)' });
  clearTimeout(timer);
  timer = window.setTimeout(hide, Math.min(4000, 2200 + 600 * (names.length - 1)));
}

function hide() {
  if (!card) return;
  card.style.opacity = '0';
  card.style.transform = 'translate(-50%, -50%) scale(.96)';
  window.setTimeout(() => { if (card && card.style.opacity === '0') card.style.display = 'none'; }, 260);
}
