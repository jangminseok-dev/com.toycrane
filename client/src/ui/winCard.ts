// 당첨 카드(본인만, 설계 §5.4): 가운데 유리 카드, 2.2초 뒤 저절로·누르면 바로 닫힘. 희귀는 금색
import { backdropBlur } from './glass';

let card: HTMLDivElement | null = null, timer = 0;

export function showWinCard(name: string, setName: string, rare: boolean, bag: number): void {
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
    background: rare ? 'linear-gradient(160deg, rgba(255,226,138,.42), rgba(255,180,60,.16))' : 'linear-gradient(160deg, rgba(255,255,255,.2), rgba(255,255,255,.06))',
    border: `1px solid ${rare ? 'rgba(255,214,107,.85)' : 'rgba(255,255,255,.35)'}`,
    boxShadow: `inset 0 1px 1px rgba(255,255,255,.55), 0 20px 50px rgba(0,0,0,.4), 0 0 46px ${rare ? 'rgba(255,211,107,.45)' : 'rgba(255,95,220,.25)'}`,
    display: 'block', opacity: '1', transform: 'translate(-50%, -50%) scale(1)',
  });
  card.innerHTML = '';
  const line = (text: string, style: Partial<CSSStyleDeclaration>) => {
    const el = document.createElement('div'); el.textContent = text; Object.assign(el.style, style); card!.appendChild(el);
  };
  line(rare ? '★ 희귀!' : '짠!', { font: '900 20px -apple-system, "Apple SD Gothic Neo", sans-serif', color: rare ? '#ffe28a' : '#ff9fe8' });
  line(name, { font: '900 28px -apple-system, "Apple SD Gothic Neo", sans-serif', margin: '6px 0 4px' });
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
