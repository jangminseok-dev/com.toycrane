// 당첨 카드(본인만, 설계 §5.4): 가운데 카툰 카드(ui/cartoon — 남색 테두리·납작 그림자·간판 글꼴, 사용자 2026-11-02 사진 263 '이팩트도 카툰'),
// 2.2초 뒤 저절로·누르면 바로 닫힘. 보통은 흰색, 희귀는 분홍, 황금(매우 희귀)은 금빛 (인형 채우기 설계 §4.6).
// 한 판에 여러 개면 모두 — 첫 인형은 크게, 나머지는 아래 한 줄씩(사용자 2026-11-02 '여러 개 뽑았는데 하나만 나온다'), 하나 더할 때마다 조금 더 오래
import { GOLD } from '../data/catalog';
import { CARTOON_FONT, FILL, INK } from './cartoon';

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
// 등급별 채움색과 첫 줄 색(보통 '짠!'은 분홍 글자, 희귀·황금은 남색 글자에 흰 채움 띠 없이)
const LOOK = {
  '': { bg: FILL.white, head: '#ff4fa3', glow: 'rgba(255,120,200,.35)' },
  rare: { bg: FILL.pink, head: INK, glow: 'rgba(255,100,190,.55)' },
  gold: { bg: FILL.gold, head: INK, glow: 'rgba(255,190,60,.7)' },
};

export function showWinCard(names: string[], setName: string, tier: Tier, bag: number): void {
  if (!card) {
    card = document.createElement('div');
    Object.assign(card.style, {
      position: 'fixed', zIndex: '25', left: '50%', top: '42%', transform: 'translate(-50%, -50%)', minWidth: '230px', padding: '20px 28px',
      borderRadius: '26px', textAlign: 'center', color: INK, font: `400 16px ${CARTOON_FONT}`, border: `3px solid ${INK}`,
      transition: 'opacity .25s, transform .25s', cursor: 'pointer',
    });
    card.addEventListener('click', () => hide());
    document.body.appendChild(card);
  }
  Object.assign(card.style, {
    background: LOOK[tier].bg,
    boxShadow: `0 6px 0 ${INK}, 0 0 46px ${LOOK[tier].glow}`,
    display: 'block', opacity: '1', transform: 'translate(-50%, -50%) scale(1)',
  });
  card.innerHTML = '';
  const line = (text: string, style: Partial<CSSStyleDeclaration>) => {
    const el = document.createElement('div'); el.textContent = text; Object.assign(el.style, style); card!.appendChild(el);
  };
  const text = winCardText(names, tier);
  line(text.head, { font: `400 21px ${CARTOON_FONT}`, color: LOOK[tier].head });
  line(text.title, { font: `400 30px ${CARTOON_FONT}`, margin: '4px 0 2px' });
  for (const more of text.more) line(more, { font: `400 18px ${CARTOON_FONT}`, margin: '2px 0' });
  line(setName, { opacity: '.75', marginTop: text.more.length ? '6px' : '0' });
  line(`가방 ${bag}개째`, { marginTop: '10px', opacity: '.85' });
  clearTimeout(timer);
  timer = window.setTimeout(hide, Math.min(4000, 2200 + 600 * (names.length - 1)));
}

function hide() {
  if (!card) return;
  card.style.opacity = '0';
  card.style.transform = 'translate(-50%, -50%) scale(.96)';
  window.setTimeout(() => { if (card && card.style.opacity === '0') card.style.display = 'none'; }, 260);
}
