// 매장 지도(설계 2026-11-02 §6): 왼쪽 아래 정사각(PC 160px, 휴대폰 112px — 휴대폰은 조이스틱 위), 위가 북쪽이고 돌지 않는다.
// 홀 테두리, 구역 색 덩어리(인형 분홍·피규어 보라·고리 민트·미는 뽑기 노랑)에 이름을 바로 적는다(사용자 친구 피드백 2026-11-02 사진 257 —
// 지도 위에 '지금 구역' 알약을 띄우던 것은 뺌), 교환소 4곳(코인 색 점), 가운데 진열탑, 나(흰 점 + 보는 방향 삼각형),
// 다른 사람(작은 점). 기계 앞 화면에서는 숨긴다. 바탕은 한 번 그려 두고, 점은 0.1초마다 다시 그린다
import layout from '../../../shared/store_layout.json';
import { backdropBlur } from './glass';

const H = layout.hall.room_half, MARGIN = 1.5, REDRAW = 0.1; // 기계 한 줄(깊이 약 1.1m)도 지도에서 보이게 넉넉히
export const ZONE_COLORS = { doll: '#ff8fbf', figure: '#b46cff', ring: '#2ec4a6', pusher: '#ffc83d' } as const;
type Zone = keyof typeof ZONE_COLORS;
type Spot = { x: number; z: number };

// 월드 (x, z) → 지도 픽셀 [가로, 세로] (북쪽 −z가 위)
export function mapPoint(x: number, z: number, size: number): [number, number] {
  return [((x + H) / (2 * H)) * size, ((z + H) / (2 * H)) * size];
}

export const mapSize = (w: number, h: number): number => (Math.min(w, h) < 600 ? 112 : 160);
// 지도 바닥 높이(px): 휴대폰(112px 지도)은 왼쪽 아래 조이스틱(쉬는 자리 바닥에서 148px까지) 위
const mapBottom = (size: number): number => (size < 160 ? 160 : 14);

// 덩어리 위 이름: 좁고 긴 인형·피규어는 두 줄, 북쪽 띠(고리·미는 뽑기)는 한 줄 — 흰 테두리 글자라 덩어리 밖으로 조금 나가도 읽힌다
const ZONE_LABELS: Record<Zone, string[]> = { doll: ['인형', '뽑기'], figure: ['피규어', '뽑기'], ring: ['고리 걸기'], pusher: ['미는 뽑기'] };

// 구역마다 기계 자리를 감싼 네모(기계 몸통만큼 넉넉히)
export function zoneRects(): { zone: Zone; x0: number; z0: number; x1: number; z1: number }[] {
  const lists: [Zone, Spot[]][] = [['doll', layout.machines], ['figure', layout.figures], ['ring', layout.rings], ['pusher', layout.pushers]];
  return lists.map(([zone, spots]) => ({
    zone,
    x0: Math.min(...spots.map((s) => s.x)) - MARGIN, z0: Math.min(...spots.map((s) => s.z)) - MARGIN,
    x1: Math.max(...spots.map((s) => s.x)) + MARGIN, z1: Math.max(...spots.map((s) => s.z)) + MARGIN,
  }));
}

export type MapState = { me: { x: number; z: number; heading: number } | null; others: Spot[]; atMachine: boolean };
export type Minimap = { el: HTMLCanvasElement; frame(state: MapState, now: number): void };

export function buildMinimap(parent: { appendChild(el: HTMLElement): void }, size: number): Minimap {
  const ratio = Math.min(2, globalThis.devicePixelRatio ?? 1), el = document.createElement('canvas');
  el.width = el.height = Math.round(size * ratio);
  Object.assign(el.style, {
    position: 'fixed', zIndex: '20', left: 'calc(env(safe-area-inset-left) + 14px)', bottom: `calc(env(safe-area-inset-bottom) + ${mapBottom(size)}px)`,
    width: `${size}px`, height: `${size}px`, borderRadius: '18px', pointerEvents: 'none', display: 'none',
    background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.4)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,.5), 0 8px 24px rgba(0,0,0,.25)',
  });
  backdropBlur(el, 'blur(14px) saturate(170%)');
  el.className = 'minimap';
  parent.appendChild(el);
  const g = el.getContext('2d')!, P = (x: number, z: number) => mapPoint(x, z, size);
  const fontPx = size < 160 ? 8 : 10;
  let last = -Infinity;

  function background() {
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(80,60,110,.55)'; g.fillStyle = 'rgba(255,255,255,.45)';
    const [hx0, hz0] = P(-layout.hall.map_half, -layout.hall.map_half), [hx1, hz1] = P(layout.hall.map_half, layout.hall.map_half);
    g.beginPath(); g.roundRect(hx0, hz0, hx1 - hx0, hz1 - hz0, 6); g.fill(); g.stroke();
    const rects = zoneRects();
    for (const r of rects) {
      const [x0, z0] = P(r.x0, r.z0), [x1, z1] = P(r.x1, r.z1);
      g.fillStyle = ZONE_COLORS[r.zone]; g.globalAlpha = 0.85;
      g.beginPath(); g.roundRect(x0, z0, x1 - x0, z1 - z0, 3); g.fill();
      g.globalAlpha = 1;
    }
    g.font = `800 ${fontPx}px -apple-system, "Apple SD Gothic Neo", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.9)'; g.fillStyle = '#2c2470';
    for (const r of rects) { // 덩어리마다 이름(덩어리를 다 그린 뒤 — 북쪽 띠 둘이 겹쳐도 글자는 위에)
      const [x0, z0] = P(r.x0, r.z0), [x1, z1] = P(r.x1, r.z1), lines = ZONE_LABELS[r.zone], cx = (x0 + x1) / 2, cy = (z0 + z1) / 2;
      lines.forEach((t, i) => { const y = cy + (i - (lines.length - 1) / 2) * (fontPx + 2); g.strokeText(t, cx, y); g.fillText(t, cx, y); });
    }
    const [tx0, tz0] = P(-layout.hall.tower_half, -layout.hall.tower_half), [tx1, tz1] = P(layout.hall.tower_half, layout.hall.tower_half);
    g.fillStyle = '#7a6cff'; g.beginPath(); g.roundRect(tx0, tz0, tx1 - tx0, tz1 - tz0, 3); g.fill(); // 진열탑
    for (const c of layout.counters) {
      const [cx, cz] = P(c.x, c.z);
      g.fillStyle = '#f5c542'; g.strokeStyle = '#a87a00'; g.lineWidth = 1;
      g.beginPath(); g.arc(cx, cz, size * 0.025, 0, Math.PI * 2); g.fill(); g.stroke(); // 교환소
    }
  }

  function draw(s: MapState) {
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, size, size);
    background();
    g.fillStyle = 'rgba(60,40,90,.75)';
    for (const o of s.others) { const [x, y] = P(o.x, o.z); g.beginPath(); g.arc(x, y, size * 0.017, 0, Math.PI * 2); g.fill(); }
    if (!s.me) return;
    const [x, y] = P(s.me.x, s.me.z), dx = Math.sin(s.me.heading), dy = Math.cos(s.me.heading), r = size * 0.035;
    g.fillStyle = '#ffffff'; g.strokeStyle = '#2c2470'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x + dx * r * 2.1, y + dy * r * 2.1); g.lineTo(x - dy * r, y + dx * r); g.lineTo(x + dy * r, y - dx * r); g.closePath(); g.fill(); g.stroke(); // 보는 방향
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
  }

  return {
    el,
    frame(s, now) {
      const shown = !!s.me && !s.atMachine;
      el.style.display = shown ? 'block' : 'none';
      if (!shown || now - last < REDRAW) return;
      last = now;
      draw(s);
    },
  };
}
