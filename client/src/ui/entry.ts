// 입장 화면들: 닉네임 정하기, 만석, 안내. 매장 위에 덮는 카툰 카드 하나를 바꿔 끼운다(ui/cartoon — 남색 테두리·납작 그림자·간판 글꼴,
// 사용자 2026-11-02 사진 270 '처음 들어올 때 나오는 것들도 카툰풍으로').
import { CARTOON_FONT, FILL, INK, cartoonPill } from './cartoon';
import { backdropBlur } from './glass';

let layer: HTMLDivElement | null = null;

function card(): HTMLDivElement {
  if (!layer) {
    layer = document.createElement('div');
    Object.assign(layer.style, {
      position: 'fixed', inset: '0', zIndex: '30', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(44,36,112,.4)', padding: '16px', fontFamily: CARTOON_FONT,
    });
    backdropBlur(layer, 'blur(6px)');
    const css = document.createElement('style'); // 입력 칸의 흐린 안내 글자(인라인으로는 못 정한다)
    css.textContent = '.entry-input::placeholder { color: rgba(44,36,112,.45); }';
    layer.appendChild(css);
    document.body.appendChild(layer);
  }
  layer.style.display = 'flex';
  for (const el of [...layer.children]) if (el.tagName !== 'STYLE') el.remove();
  const box = document.createElement('div');
  Object.assign(box.style, {
    width: 'min(360px, 100%)', borderRadius: '26px', padding: '26px 24px 24px', color: INK, textAlign: 'center',
    background: FILL.white, border: `3px solid ${INK}`, boxShadow: `0 8px 0 ${INK}, 0 20px 50px rgba(44,36,112,.25)`,
  });
  layer.appendChild(box);
  return box;
}

function heading(text: string): HTMLHeadingElement {
  const h = document.createElement('h1');
  h.textContent = text;
  Object.assign(h.style, { margin: '0 0 6px', fontSize: '28px', fontWeight: '400', color: '#ff4fa3', fontFamily: CARTOON_FONT });
  return h;
}

function paragraph(text: string, color = 'rgba(44,36,112,.8)'): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  Object.assign(p.style, { margin: '6px 0 0', fontSize: '15px', lineHeight: '1.5', color, fontFamily: CARTOON_FONT });
  return p;
}

function button(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  Object.assign(b.style, {
    marginTop: '16px', width: '100%', padding: '12px', cursor: 'pointer', fontSize: '19px', ...cartoonPill('pink'), boxShadow: `0 4px 0 ${INK}`,
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
  input.className = 'entry-input';
  Object.assign(input.style, {
    marginTop: '16px', width: '100%', boxSizing: 'border-box', padding: '12px 18px', fontSize: '18px', textAlign: 'center', outline: 'none',
    ...cartoonPill('white'), boxShadow: 'none',
  });
  form.append(input);
  if (error) form.append(paragraph(error, '#e23b6d'));
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
