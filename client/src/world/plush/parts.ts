import type { PlushBuilder, Slot, V3 } from './kit';

// 서 있는(앉은) 형이 함께 쓰는 몸: v13 곰의 배 모양 몸통 + 앞발 + 허벅지 + 뒷발 + 발바닥 (인형 리뉴얼 설계 §3 손발 규칙)
export const mirror = (s: number, [x, y, z]: V3): V3 => [s * x, y, z];
const TORSO: [number, number][] = [[0.02, 0], [0.05, 0.27], [0.14, 0.4], [0.28, 0.43], [0.44, 0.41], [0.6, 0.36], [0.74, 0.27], [0.84, 0.15], [0.88, 0]];

export type BodyOpts = {
  width?: number; // 몸통 굵기 배율
  height?: number; // 몸통 높이 배율
  armSlot?: Slot; legSlot?: Slot; // 팔·다리 색 (판다처럼 다른 색일 때)
  pads?: 'cream' | 'beans' | 'none'; // 뒷발바닥: 크림 발바닥 / 분홍 젤리(큰 볼록이 + 발가락 셋) / 없음
  footLong?: number; // 뒷발 앞뒤 길이 배율 (토끼처럼 긴 발)
  toes?: boolean; // 앞발 발가락 줄
};

export function sitBody(b: PlushBuilder, o: BodyOpts = {}): void {
  const w = o.width ?? 1, h = o.height ?? 1, long = o.footLong ?? 1;
  b.pear(TORSO.map(([y, r]) => [y * h, r * w]), 0.94, 0.02);
  for (const s of [-1, 1]) {
    const arm = { slot: o.armSlot };
    // 앞발: 관 끝 = 발 공 중심, 끝 굵기 ≈ 발 반지름 (이음새 없이)
    b.tube([mirror(s, [0.2 * w, 0.8 * h, 0.02]), mirror(s, [0.38 * w, 0.68 * h, 0.1]), mirror(s, [0.42 * w, 0.52 * h, 0.22]), mirror(s, [0.36 * w, 0.4 * h, 0.3])], 0.11, (t) => 0.95 + 0.3 * t, arm);
    b.sphere(0.14, mirror(s, [0.36 * w, 0.39 * h, 0.31]), [1, 0.92, 1], [0, 0, 0], arm);
    const leg = { slot: o.legSlot };
    b.sphere(0.17, mirror(s, [0.23 * w, 0.2, 0.2]), [1, 0.85, 1.3], [0, 0, 0], leg); // 허벅지
    b.sphere(0.16, mirror(s, [0.25 * w, 0.16, 0.38 + (long - 1) * 0.08]), [1.05, 0.95, 1.1 * long], [0, 0, 0], leg); // 뒷발
    // 발바닥은 뒷발 앞면에 붙인다(겉면 위치를 재서) — 발 모양이 달라도 반쯤 박힌 채 보이게
    const fx = s * 0.25 * w;
    if (o.pads === 'cream' || o.pads === undefined) b.nub(0.1, [fx, 0.16], [1.05, 1, 0.42], { slot: 'pad', outline: true });
    if (o.pads === 'beans') {
      b.nub(0.07, [fx, 0.14], [1.05, 0.9, 0.3], { slot: 'pad' });
      for (const k of [-1, 0, 1]) b.nub(0.024, [fx + k * 0.046, 0.215 - Math.abs(k) * 0.014], [1, 1, 0.35], { slot: 'pad' });
    }
    if (o.toes) for (const dx of [-0.03, 0.03]) b.stitch([[s * 0.36 * w + dx, 0.37 * h], [s * 0.36 * w + dx, 0.33 * h]], 0.006, 'toe');
  }
}
