import * as THREE from 'three';
import { CEL } from './cel';

// 그린 얼굴 한 장 그림 (인형 리뉴얼 설계 §3·§7): 눈·볼터치·무늬를 한 캔버스의 칸에 모아 재질 하나(FACE_MAT)로 그린다 —
// 무더기에서 인형 겉모습이 여러 가지여도 그리기 호출이 늘지 않게. 칸 그림은 승인 시제품 v13의 dotEyeTex·eyeTex·blushTex를 옮긴 것
export type EyeStyle = 'dot' | 'anime';
export type Iris = 'violet' | 'blue' | 'green' | 'amber' | 'pink' | 'brown';
export type Cell = 'dotEye' | `anime-${Iris}` | 'closed' | 'animeClosed' | 'sleepy' | 'blush' | 'blushBig' | `mark-${string}`;

const IRIS: Record<Iris, [string, string, string]> = {
  violet: ['#2c1a5c', '#5b3fc4', '#a98cff'], blue: ['#163a6b', '#2f7fd8', '#9fd0ff'], green: ['#14452e', '#2f9e62', '#a6f0c4'],
  amber: ['#5a3208', '#c98216', '#ffd88a'], pink: ['#5c1638', '#d4508f', '#ffb3d6'], brown: ['#3a2412', '#7a4a26', '#d9a77a'],
};
const INK = '#1d1420';
type Draw = (g: CanvasRenderingContext2D, S: number) => void;

const dotEye: Draw = (g, S) => {
  g.beginPath(); g.ellipse(S / 2, S / 2, S * 0.42, S * 0.46, 0, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.ellipse(S * 0.4, S * 0.32, S * 0.15, S * 0.13, -0.4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(S * 0.62, S * 0.66, S * 0.07, 0, Math.PI * 2); g.fill();
};
const animeEye = (iris: Iris): Draw => (g, S) => {
  const [dark, mid, light] = IRIS[iris];
  const cx = S / 2, cy = S * 0.54, rx = S * 0.38, ry = S * 0.4;
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = '#25163a'; g.fill();
  const gr = g.createLinearGradient(0, cy - ry, 0, cy + ry); gr.addColorStop(0, dark); gr.addColorStop(0.5, mid); gr.addColorStop(1, light);
  g.beginPath(); g.ellipse(cx, cy, rx * 0.86, ry * 0.88, 0, 0, Math.PI * 2); g.fillStyle = gr; g.fill();
  g.beginPath(); g.ellipse(cx, cy + ry * 0.02, rx * 0.46, ry * 0.52, 0, 0, Math.PI * 2); g.fillStyle = '#170b2c'; g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.ellipse(cx - rx * 0.28, cy - ry * 0.34, rx * 0.32, ry * 0.25, -0.4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + rx * 0.34, cy + ry * 0.3, rx * 0.13, 0, Math.PI * 2); g.fill();
};
// 감은 눈(웃음): 굵은 ∩
const closed = (w: number): Draw => (g, S) => {
  g.strokeStyle = INK; g.lineCap = 'round'; g.lineWidth = S * w;
  g.beginPath(); g.moveTo(S * 0.18, S * 0.62); g.quadraticCurveTo(S * 0.5, S * 0.22, S * 0.82, S * 0.62); g.stroke();
};
// 졸린 눈: 살짝 내려간 가로 선
const sleepy: Draw = (g, S) => {
  g.strokeStyle = INK; g.lineCap = 'round'; g.lineWidth = S * 0.1;
  g.beginPath(); g.moveTo(S * 0.2, S * 0.5); g.quadraticCurveTo(S * 0.5, S * 0.6, S * 0.8, S * 0.5); g.stroke();
};
const blush = (alpha: number, reach: number): Draw => (g, S) => {
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, (S / 2) * reach);
  gr.addColorStop(0, `rgba(255,110,160,${alpha})`); gr.addColorStop(0.55, `rgba(255,130,175,${alpha * 0.6})`); gr.addColorStop(1, 'rgba(255,160,195,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
};
// 치즈 고양이 이마 줄무늬 셋
const tabby: Draw = (g, S) => {
  g.fillStyle = '#d4813f';
  for (const [x, h] of [[0.3, 0.62], [0.5, 0.8], [0.7, 0.62]]) { g.beginPath(); g.ellipse(S * x, S * (1 - h / 2), S * 0.07, (S * h) / 2, 0, 0, Math.PI * 2); g.fill(); }
};

// 판다 눈 둘레 무늬: 바깥 아래로 처진 둥근 물방울 (진한 회갈색 — 그 위의 눈이 보이게)
const patch: Draw = (g, S) => {
  g.fillStyle = '#4b4358';
  g.beginPath(); g.ellipse(S * 0.52, S * 0.55, S * 0.36, S * 0.44, -0.45, 0, Math.PI * 2); g.fill();
};

// 너구리 눈가 띠: 두 눈을 잇는 넓은 띠 (가운데가 좁다)
const mask: Draw = (g, S) => {
  g.fillStyle = '#4e4250';
  for (const x of [0.27, 0.73]) { g.beginPath(); g.ellipse(S * x, S * 0.52, S * 0.24, S * 0.2, x < 0.5 ? 0.25 : -0.25, 0, Math.PI * 2); g.fill(); }
  g.fillRect(S * 0.3, S * 0.44, S * 0.4, S * 0.12);
};

// 젖소 얼룩: 가장자리가 울퉁불퉁한 둥근 얼룩
const cowspot: Draw = (g, S) => {
  g.fillStyle = '#3b2a3a'; g.beginPath();
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2, r = S * (0.36 + 0.06 * Math.sin(a * 3) + 0.03 * Math.cos(a * 5)); const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r * 0.85; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
  g.fill();
};

// 칸 차례 (6×6 격자, 위 왼쪽부터). 새 무늬는 끝에 더한다 — 앞 칸 자리가 바뀌지 않게
const CELLS: [Cell, Draw][] = [
  ['dotEye', dotEye], ['closed', closed(0.1)], ['animeClosed', closed(0.12)], ['sleepy', sleepy], ['blush', blush(0.85, 1)], ['blushBig', blush(1, 1.15)],
  ...(Object.keys(IRIS) as Iris[]).map((i): [Cell, Draw] => [`anime-${i}`, animeEye(i)]),
  ['mark-tabby', tabby], ['mark-patch', patch], ['mark-mask', mask], ['mark-cowspot', cowspot],
];
const GRID = 6, SIZE = 1024, PAD = 2 / SIZE;
const index = new Map(CELLS.map(([c], i) => [c, i]));

export function cellUV(cell: Cell): [number, number, number, number] {
  const i = index.get(cell);
  if (i === undefined) throw new Error(`없는 얼굴 칸 ${cell}`);
  const col = i % GRID, row = Math.floor(i / GRID);
  return [col / GRID + PAD, 1 - (row + 1) / GRID + PAD, (col + 1) / GRID - PAD, 1 - row / GRID - PAD];
}

function atlas(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = SIZE;
  const g = c.getContext('2d')!, S = SIZE / GRID;
  CELLS.forEach(([, draw], i) => {
    g.save(); g.translate((i % GRID) * S, Math.floor(i / GRID) * S);
    g.beginPath(); g.rect(0, 0, S, S); g.clip();
    draw(g, S);
    g.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// 재질은 바로 만들고(같은 객체를 모두가 쓴다) 그림은 처음 붙일 때 그린다 — 모듈을 읽는 순간에는 캔버스가 없을 수 있다(시험)
export const FACE_MAT = new THREE.MeshToonMaterial({ gradientMap: CEL, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
export function ensureFaceAtlas(): void {
  if (FACE_MAT.map) return;
  FACE_MAT.map = atlas();
  FACE_MAT.needsUpdate = true;
}

// 표정(spec §4): 0 웃음(감은 눈 ∩∩) · 1 ω 입 · 2 윙크(오른눈만 감음) · 3 졸린 눈 · 4 볼 빨개짐
export function eyeCells(style: EyeStyle, iris: Iris, face: number): { left: Cell; right: Cell; blush: Cell; omega: boolean } {
  const open: Cell = style === 'dot' ? 'dotEye' : `anime-${iris}`, shut: Cell = style === 'dot' ? 'closed' : 'animeClosed';
  switch (face) {
    case 0: return { left: shut, right: shut, blush: 'blush', omega: false };
    case 1: return { left: open, right: open, blush: 'blush', omega: true };
    case 2: return { left: open, right: shut, blush: 'blush', omega: false };
    case 3: return { left: 'sleepy', right: 'sleepy', blush: 'blush', omega: false };
    default: return { left: open, right: open, blush: 'blushBig', omega: false };
  }
}
