// 구경하는 사람 얼굴(사용자 2026-11-03 그림 B): 한 판 하는 동안 다른 사람 캐릭터는 숨기고(game/remotePlayers), 내 기계 가까이 선 사람은
// 그 캐릭터 얼굴이 화면 오른쪽 아래 구석에서 반쯤 고개를 내민다. 위에 이름표, 먼저 온 3명까지(나머지는 '+N'). 다가오면 쑥 올라오고 떠나면 쏙 내려간다 — 그 밖엔 가만히.
// 화면을 누르는 데 걸리지 않게 손가락은 통과
import { avatarFaceSoon } from '../world/thumbs';
import { CARTOON_FONT, cartoonPill } from './cartoon';

const MAX = 3;
export function peekSlots(ids: string[]): { shown: string[]; more: number } {
  return { shown: ids.slice(0, MAX), more: Math.max(0, ids.length - MAX) };
}

export type Watcher = { id: string; nick: string; color: number };
const TILTS = [-7, 4, -3]; // 얼굴마다 살짝 다른 기울기(사람마다 정해져 자리를 옮겨도 그대로)
const tiltOf = (id: string) => TILTS[[...id].reduce((h, c) => h + c.charCodeAt(0), 0) % TILTS.length];

export class PeekFaces {
  private row = document.createElement('div');
  private more = document.createElement('div');
  private faces = new Map<string, HTMLDivElement>();
  private key = '';

  // size: 얼굴 한 변(px) — PC 92, 휴대폰 68
  constructor(private size: number) {
    Object.assign(this.row.style, {
      position: 'fixed', zIndex: '14', right: 'calc(env(safe-area-inset-right) + 10px)', bottom: '0', display: 'flex', flexDirection: 'row-reverse',
      alignItems: 'flex-end', gap: `${Math.round(size * 0.08)}px`, pointerEvents: 'none',
    });
    Object.assign(this.more.style, { order: '99', marginBottom: `${Math.round(size * 0.3)}px`, padding: '2px 9px', font: `400 ${size < 80 ? 12 : 14}px ${CARTOON_FONT}`, ...cartoonPill('pink'), display: 'none' });
    this.row.appendChild(this.more);
    document.body.appendChild(this.row);
  }

  set(list: Watcher[]): void {
    const { shown, more } = peekSlots(list.map((w) => w.id));
    const key = `${shown.join('|')}+${more}`;
    if (key === this.key) return;
    this.key = key;
    for (const [id, el] of this.faces) {
      if (shown.includes(id)) continue;
      this.faces.delete(id);
      el.style.transform = this.down();
      setTimeout(() => el.remove(), 400);
    }
    for (const w of list) {
      if (!shown.includes(w.id) || this.faces.has(w.id)) continue;
      const el = this.face(w);
      this.faces.set(w.id, el);
      this.row.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => { if (this.faces.get(w.id) === el) el.style.transform = this.up(); }));
    }
    shown.forEach((id, i) => { this.faces.get(id)!.style.order = String(i); });
    this.more.textContent = `+${more}`;
    this.more.style.display = more > 0 ? 'block' : 'none';
  }

  // 고개를 내민 자리: 이름표와 얼굴(웃는 입까지)만 화면 안에, 턱 아래는 화면 밖
  private up(): string { return `translateY(${Math.round(this.size * 0.16)}px)`; }
  private down(): string { return `translateY(${this.size + 40}px)`; }

  private face(w: Watcher): HTMLDivElement {
    const el = document.createElement('div');
    Object.assign(el.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', width: `${this.size}px`,
      transform: this.down(), transition: 'transform .35s cubic-bezier(.3,1.5,.5,1)',
    });
    const name = document.createElement('div');
    name.textContent = w.nick;
    Object.assign(name.style, {
      position: 'relative', zIndex: '1', maxWidth: `${this.size + 24}px`, overflow: 'hidden', textOverflow: 'ellipsis', padding: '1px 8px', marginBottom: `-${Math.round(this.size * 0.1)}px`,
      font: `400 ${this.size < 80 ? 11 : 13}px ${CARTOON_FONT}`, ...cartoonPill('white'),
    });
    el.appendChild(name);
    const put = (pic: HTMLCanvasElement | null | undefined) => {
      if (!pic) return;
      const img = document.createElement('canvas');
      img.width = pic.width; img.height = pic.height;
      img.getContext('2d')!.drawImage(pic, 0, 0);
      Object.assign(img.style, { width: `${this.size}px`, height: `${this.size}px`, transform: `rotate(${tiltOf(w.id)}deg)` });
      el.appendChild(img);
    };
    put(avatarFaceSoon(w.color, () => put(avatarFaceSoon(w.color, () => {}))));
    return el;
  }
}
