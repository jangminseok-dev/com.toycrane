// 가방 보기 창(설계 2026-11-02 §5): 왼쪽 위 가방 칸을 누르면 뜨는 유리 시트 '내 가방'. 구역별(인형·피규어·고리·미는 뽑기)로 묶어
// 칸마다 작은 그림·이름·×개수·희귀 표시. 바깥(어두운 바탕)이나 '닫기'를 누르면 닫힌다. 리퀴드 글라스
import { GOLD, dollName } from '../data/catalog';
import type { BagEntry } from '../net/api';
import { thumbnailSoon } from '../world/thumbs';
import { UI } from '../world/copy';
import { backdropBlur } from './glass';
import { installNoSelect } from './noSelect';

type Zone = keyof typeof UI.bagZones;
const ORDER: Zone[] = ['doll', 'figure', 'ring', 'pusher'];
const zoneOf = (zone: string): Zone => (zone === 'figure' || zone === 'ring' || zone === 'pusher' ? zone : 'doll'); // 큰·작은 기계 인형은 '인형'
export type BagCell = { doll: string; color: number; rare: string; name: string; count: number; mark: string; firstAt: number };
export type BagGroup = { zone: Zone; title: string; cells: BagCell[] };

// 구역마다 같은 캐릭터·색·희귀는 한 칸(개수 합, 처음 뽑은 때는 가장 이른 때), 처음 뽑은 때가 늦은 칸이 위로. 빈 구역은 뺀다
export function bagGroups(items: BagEntry[]): BagGroup[] {
  const cells = new Map<Zone, Map<string, BagCell>>();
  for (const it of items) {
    const z = zoneOf(it.zone), key = `${it.doll}|${it.color}|${it.rare}`, group = cells.get(z) ?? new Map<string, BagCell>();
    cells.set(z, group);
    const c = group.get(key);
    if (c) { c.count += it.count; c.firstAt = Math.min(c.firstAt, it.first_at); continue; }
    group.set(key, { doll: it.doll, color: it.color, rare: it.rare, name: dollName(it.doll, it.color, it.rare), count: it.count, mark: it.rare === GOLD.id ? '★★' : it.rare ? '★' : '', firstAt: it.first_at });
  }
  return ORDER.filter((z) => cells.has(z)).map((z) => ({ zone: z, title: UI.bagZones[z], cells: [...cells.get(z)!.values()].sort((a, b) => b.firstAt - a.firstAt) }));
}

const FONT = '-apple-system, "Apple SD Gothic Neo", sans-serif';
let shade: HTMLDivElement | null = null;

export function closeBagSheet(): void {
  shade?.remove();
  shade = null;
}

// 작은 그림(아직 안 찍혔으면 색 동그라미였다가 찍히면 바꿔 끼움)
function picture(c: BagCell): HTMLElement {
  const img = (pic: HTMLCanvasElement) => { const el = document.createElement('img'); el.src = pic.toDataURL(); Object.assign(el.style, { width: '64px', height: '64px' }); return el; };
  const dot = document.createElement('div');
  Object.assign(dot.style, { width: '48px', height: '48px', margin: '8px auto', borderRadius: '50%', background: c.mark === '★★' ? '#e3a400' : c.mark ? '#b46cff' : '#ff8fbf' });
  const pic = thumbnailSoon(c.doll, c.color, c.rare, () => { const p = thumbnailSoon(c.doll, c.color, c.rare, () => {}); if (p && dot.isConnected) dot.replaceWith(img(p)); });
  return pic ? img(pic) : dot;
}

export function openBagSheet(groups: BagGroup[]): void {
  closeBagSheet();
  shade = document.createElement('div');
  Object.assign(shade.style, { position: 'fixed', inset: '0', zIndex: '30', background: 'rgba(20,10,30,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' });
  shade.addEventListener('click', (e) => { if (e.target === shade) closeBagSheet(); });
  installNoSelect(shade);
  const card = document.createElement('div');
  Object.assign(card.style, {
    width: 'min(92vw, 520px)', maxHeight: '78vh', display: 'flex', flexDirection: 'column', padding: '18px 18px 14px', borderRadius: '26px', color: '#2a0f1f', font: `700 15px ${FONT}`,
    background: 'rgba(255,255,255,.72)', border: '1px solid rgba(255,255,255,.85)', boxShadow: '0 20px 50px rgba(40,10,60,.35)', boxSizing: 'border-box',
  });
  backdropBlur(card, 'blur(20px) saturate(180%)');
  const title = document.createElement('div'); title.textContent = `🎒 ${UI.bagTitle}`;
  Object.assign(title.style, { font: `900 20px ${FONT}`, textAlign: 'center', marginBottom: '10px' });
  const list = document.createElement('div'); list.className = 'bag-list';
  Object.assign(list.style, { overflowY: 'auto', flex: '1 1 auto' });
  if (!groups.length) {
    const empty = document.createElement('div'); empty.textContent = UI.bagEmpty;
    Object.assign(empty.style, { textAlign: 'center', padding: '28px 0', color: '#6b4a5e' });
    list.append(empty);
  }
  for (const g of groups) {
    const head = document.createElement('div'); head.textContent = `${g.title} ${g.cells.reduce((n, c) => n + c.count, 0)}`;
    Object.assign(head.style, { font: `800 15px ${FONT}`, margin: '10px 4px 6px' });
    const grid = document.createElement('div');
    Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '8px' });
    for (const c of g.cells) {
      const cell = document.createElement('div'); cell.className = 'bag-cell';
      Object.assign(cell.style, { position: 'relative', padding: '6px 4px 8px', borderRadius: '16px', textAlign: 'center', background: 'rgba(255,255,255,.65)', border: `2px solid ${c.mark === '★★' ? '#e3a400' : c.mark ? '#b46cff' : 'rgba(255,255,255,.9)'}` });
      const name = document.createElement('div'); name.textContent = c.name;
      Object.assign(name.style, { font: `700 12px ${FONT}`, lineHeight: '1.25', wordBreak: 'keep-all' });
      const count = document.createElement('div'); count.textContent = `×${c.count}`;
      Object.assign(count.style, { font: `800 13px ${FONT}`, color: '#8a2a5c' });
      cell.append(picture(c), name, count);
      if (c.mark) {
        const mark = document.createElement('div'); mark.textContent = c.mark;
        Object.assign(mark.style, { position: 'absolute', top: '4px', right: '8px', color: c.mark === '★★' ? '#e3a400' : '#b46cff', font: `900 14px ${FONT}` });
        cell.append(mark);
      }
      grid.append(cell);
    }
    list.append(head, grid);
  }
  const close = document.createElement('button'); close.textContent = UI.cancel;
  Object.assign(close.style, {
    margin: '12px auto 0', padding: '10px 28px', borderRadius: '999px', cursor: 'pointer', touchAction: 'manipulation', font: `800 15px ${FONT}`,
    color: '#2a0f1f', border: '1px solid rgba(255,255,255,.7)', background: 'linear-gradient(180deg, rgba(255,150,205,.95), rgba(255,110,175,.85))',
  });
  close.addEventListener('click', closeBagSheet);
  card.append(title, list, close);
  shade.appendChild(card);
  document.body.appendChild(shade);
}
