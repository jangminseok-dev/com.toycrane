// 당첨 카드(본인만, 설계 §5.4): 가운데 유리 카드, 2.2초 뒤 저절로·누르면 바로 닫힘. 희귀는 분홍 빛, 황금(매우 희귀)은 진한 금빛 (인형 채우기 설계 §4.6)
import { backdropBlur } from './glass';

let card: HTMLDivElement | null = null, timer = 0;

export type Tier = '' | 'rare' | 'gold';
export function winCardText(name: string, tier: Tier): { head: string; title: string } {
  if (tier === 'gold') return { head: '★★ 매우 희귀!', title: `★★ ${name}` };
  if (tier === 'rare') return { head: '★ 희귀!', title: `★ ${name}` };
  return { head: '짠!', title: name };
}
const LOOK = {
  '': { bg: 'linear-gradient(160deg, rgba(255,255,255,.2), rgba(255,255,255,.06))', border: 'rgba(255,255,255,.35)', glow: 'rgba(255,95,220,.25)', head: '#ff9fe8' },
  rare: { bg: 'linear-gradient(160deg, rgba(255,160,220,.4), rgba(255,110,190,.16))', border: 'rgba(255,170,225,.85)', glow: 'rgba(255,120,210,.45)', head: '#ffc4ec' },
  gold: { bg: 'linear-gradient(160deg, rgba(255,214,90,.6), rgba(214,140,20,.3))', border: 'rgba(255,214,107,.95)', glow: 'rgba(255,200,70,.7)', head: '#ffe28a' },
};

export function showWinCard(name: string, setName: string, tier: Tier, bag: number): void {
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
  const text = winCardText(name, tier);
  line(text.head, { font: '900 20px -apple-system, "Apple SD Gothic Neo", sans-serif', color: LOOK[tier].head });
  line(text.title, { font: '900 28px -apple-system, "Apple SD Gothic Neo", sans-serif', margin: '6px 0 4px' });
  line(setName, { color: 'rgba(255,255,255,.75)' });
  line(`가방 ${bag}개째`, { marginTop: '10px', color: 'rgba(255,255,255,.85)' });
  clearTimeout(timer);
  timer = window.setTimeout(hide, 2200);
}

function hide() {
  if (!card) return;
  card.style.opacity = '0';
  card.style.transform = 'translate(-50%, -50%) scale(.96)';
  window.setTimeout(() => { if (card && card.style.opacity === '0') card.style.display = 'none'; }, 260);
}
