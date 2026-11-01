import { eyeCells, type EyeStyle, type Iris } from './faceAtlas';
import type { PlushBuilder } from './kit';

// 표정에 맞는 눈·볼터치를 그린다 (앞에서 본 자리, 시제품 단위). 이름은 face-<칸> — 표정마다 얼굴 조각 서명이 달라진다
export function paintEyes(b: PlushBuilder, style: EyeStyle, iris: Iris, face: number, e: { x: number; y: number; w: number; h: number }, cheek: { x: number; y: number; w: number; h: number }): boolean {
  const c = eyeCells(style, iris, face);
  b.paint(c.left, [-e.x, e.y], [e.w, e.h], `face-${c.left}`, true);
  b.paint(c.right, [e.x, e.y], [e.w, e.h], `face-${c.right}`);
  for (const s of [-1, 1]) b.paint(c.blush, [s * cheek.x, cheek.y], [cheek.w * (c.blush === 'blushBig' ? 1.25 : 1), cheek.h * (c.blush === 'blushBig' ? 1.25 : 1)], `face-${c.blush}`);
  return c.omega;
}

// 입: ω(두 봉우리) 또는 기본 입(가운데 줄 + 양쪽 말림). 이름은 'face-mouth' (무더기에서도 남는다)
export function stitchMouth(b: PlushBuilder, omega: boolean, x: number, y: number, k: number, r: number): void {
  if (omega) {
    b.stitch([[-2.2 * k, y + 0.2 * k], [-1.1 * k, y - 0.9 * k], [0, y], [1.1 * k, y - 0.9 * k], [2.2 * k, y + 0.2 * k]].map(([px, py]) => [x + px, py] as [number, number]), r, 'face-mouth');
    return;
  }
  b.stitch([[x, y + 1.1 * k], [x, y]], r, 'face-mouth');
  for (const s of [-1, 1]) b.stitch([[x, y], [x + s * 1.1 * k, y - 0.7 * k], [x + s * 2.1 * k, y - 0.2 * k]], r, 'face-mouth');
}
