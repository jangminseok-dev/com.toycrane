// 입장 화면들: 닉네임 정하기, 만석, 안내. 매장 위에 덮는 유리 카드 하나를 바꿔 끼운다(아이폰 리퀴드 글라스 느낌).
import { backdropBlur } from './glass';

const FONT = '-apple-system, "Apple SD Gothic Neo", sans-serif';
let layer: HTMLDivElement | null = null;

function card(): HTMLDivElement {
  if (!layer) {
    layer = document.createElement('div');
    Object.assign(layer.style, {
      position: 'fixed', inset: '0', zIndex: '30', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(20,14,30,.35)', padding: '16px', fontFamily: FONT,
    });
    backdropBlur(layer, 'blur(6px)');
    document.body.appendChild(layer);
  }
  layer.style.display = 'flex';
  layer.innerHTML = '';
  const box = document.createElement('div');
  Object.assign(box.style, {
    width: 'min(360px, 100%)', borderRadius: '28px', padding: '26px 22px 22px', color: '#f6ecff', textAlign: 'center',
    background: 'linear-gradient(160deg, rgba(255,255,255,.16), rgba(255,255,255,.05))',
    border: '1px solid rgba(255,255,255,.28)',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,.45), 0 20px 50px rgba(0,0,0,.45), 0 0 40px rgba(255,95,220,.12)',
  });
  backdropBlur(box, 'blur(24px) saturate(180%)');
  layer.appendChild(box);
  return box;
}

function heading(text: string): HTMLHeadingElement {
  const h = document.createElement('h1');
  h.textContent = text;
  Object.assign(h.style, { margin: '0 0 6px', fontSize: '24px', fontWeight: '900', color: '#ff9fe8' });
  return h;
}

function paragraph(text: string, color = '#cdbde6'): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  Object.assign(p.style, { margin: '6px 0 0', fontSize: '14px', lineHeight: '1.5', color });
  return p;
}

function button(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  Object.assign(b.style, {
    marginTop: '16px', width: '100%', padding: '13px', borderRadius: '16px', cursor: 'pointer',
    background: 'linear-gradient(180deg, rgba(255,150,205,.95), rgba(255,110,175,.85))', border: '1px solid rgba(255,255,255,.45)',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,.7), 0 6px 18px rgba(255,95,180,.35)',
    color: '#2a0f1f', fontSize: '16px', fontWeight: '800', fontFamily: FONT,
  });
  return b;
}

export function hideEntry(): void {
  if (layer) layer.style.display = 'none';
}

// 닉네임 입력. error가 있으면 빨간 안내를 함께 보여 준다
export function askNickname(error?: string): Promise<string> {
  const box = card();
  box.append(heading('toycrane'), paragraph('같이 노는 인형뽑기방이에요. 닉네임만 정하면 바로 들어가요.'));
  const form = document.createElement('form');
  const input = document.createElement('input');
  Object.assign(input, { maxLength: 20, placeholder: '닉네임 (1~10자)', autocomplete: 'off' });
  Object.assign(input.style, {
    marginTop: '16px', width: '100%', boxSizing: 'border-box', padding: '13px 14px', borderRadius: '16px', fontSize: '16px',
    border: '1px solid rgba(255,255,255,.22)', background: 'rgba(255,255,255,.08)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,.25)',
    color: '#fff', fontFamily: FONT, outline: 'none',
  });
  form.append(input);
  if (error) form.append(paragraph(error, '#ff8fa8'));
  const go = button('들어가기');
  form.append(go);
  box.append(form);
  setTimeout(() => input.focus(), 0);
  return new Promise((resolve) => {
    form.addEventListener('submit', (e) => { e.preventDefault(); resolve(input.value); });
  });
}

export function showWelcomeBack(nickname: string): void {
  const box = card();
  box.append(heading(`${nickname} 님 어서 오세요`), paragraph('매장에 들어가는 중…'));
}

// 만석: "다시 시도"를 누르면 끝난다
export function showFull(): Promise<void> {
  const box = card();
  box.append(heading('만석이에요'), paragraph('지금 매장이 모두 찼어요. 잠시 후 다시 시도해 주세요.'));
  const retry = button('다시 시도');
  box.append(retry);
  return new Promise((resolve) => retry.addEventListener('click', () => resolve(), { once: true }));
}

export function showMessage(title: string, text: string): void {
  const box = card();
  box.append(heading(title), paragraph(text));
}
