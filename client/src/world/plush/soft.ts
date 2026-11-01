import { paintEyes, stitchMouth } from './face';
import type { PlushBuilder } from './kit';
import { mirror, sitBody } from './parts';
import type { Species } from './species';

// 말랑 동물 세트. 곰·고양이는 승인 시제품 v13(docs/reference/prototypes/spike-plush-v13.html)을 그대로 옮긴 것

const bear: Species = {
  id: 'bear', round: false, eyes: 'dot', iris: 'brown', slots: { accent: 0xfff4e2, pad: 0xfff4e2, inner: 0xfff4e2, nose: 0x4a2c34, thread: 0x3a2330 },
  make(b: PlushBuilder, face: number) {
    b.sphere(0.6, [0, 1.2, 0], [1.12, 0.94, 0.96], [0, 0, 0], { name: 'head' }); // 머리 (몸보다 크게)
    for (const s of [-1, 1] as const) b.sphere(0.18, [s * 0.5, 1.62, -0.06], [1, 1, 0.6], [0, 0, -s * 0.3], { hit: 'ear' }); // 귀
    sitBody(b); // 몸·앞발·허벅지·뒷발·크림 발바닥
    for (const s of [-1, 1]) b.sphere(0.11, [s * 0.5, 1.61, 0.02], [1, 1, 0.32], [0, 0, -s * 0.3], { slot: 'inner', outline: false, hit: 'none' }); // 귓속
    b.sphere(0.1, [0, 0.35, -0.38]); // 꼬리
    b.sphere(0.21, [0, 1.04, 0.47], [1.3, 0.9, 0.75], [0, 0, 0], { slot: 'accent' }); // 주둥이
    b.nub(0.055, [0, 1.11], [1.4, 0.9, 0.55], { slot: 'nose' }); // 코
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.21, y: 1.25, w: 0.095, h: 0.12 }, { x: 0.36, y: 1.06, w: 0.15, h: 0.09 });
    stitchMouth(b, omega, 0, 1.04, 0.032, 0.009);
  },
};

const cat: Species = {
  id: 'cat', round: false, eyes: 'anime', iris: 'violet', slots: { accent: 0xfffaf3, pad: 0xffb3cd, inner: 0xffb3cd, nose: 0xff7fa8, thread: 0x4a2a3a },
  make(b: PlushBuilder, face: number) {
    b.sphere(0.6, [0, 1.12, 0], [1.24, 0.86, 0.94], [0, 0, 0], { name: 'head' }); // 머리 (옆으로 넓은 찹쌀떡)
    for (const s of [-1, 1] as const) b.pointedEar(0.22, [s * 0.5, 1.5, -0.02], s, 0.5, -0.05); // 귀 (머리 위 양 모서리)
    b.pear([[0.02, 0], [0.05, 0.25], [0.14, 0.37], [0.28, 0.4], [0.44, 0.38], [0.6, 0.32], [0.72, 0.22], [0.8, 0.1], [0.82, 0]], 0.94, 0.02); // 몸
    for (const s of [-1, 1] as const) {
      // 앞발: 어깨에서 짧고 통통하게 내려와 관 끝 = 발 공 중심, 같은 굵기로 이음새 없이
      b.tube([mirror(s, [0.2, 0.78, 0.02]), mirror(s, [0.3, 0.67, 0.13]), mirror(s, [0.25, 0.545, 0.31])], 0.08, (t) => 1 + 0.25 * t);
      b.sphere(0.1, mirror(s, [0.25, 0.545, 0.31]));
      b.sphere(0.15, mirror(s, [0.21, 0.18, 0.2]), [1, 0.85, 1.3]); // 허벅지
      b.sphere(0.13, mirror(s, [0.22, 0.14, 0.37]), [1, 0.82, 1.15]); // 뒷발 (몸 색, 앞으로 둥글게)
      b.pointedEar(0.14, [s * 0.5, 1.49, 0.04], s, 0.3, -0.05, { slot: 'inner', outline: false, hit: 'none' }); // 귓속
      b.sphere(0.062, mirror(s, [0.22, 0.125, 0.505]), [1.05, 0.9, 0.3], [0, 0, 0], { slot: 'pad', outline: false, hit: 'none' }); // 발바닥 큰 볼록이
      for (const k of [-1, 0, 1]) b.sphere(0.022, [s * 0.22 + k * 0.042, 0.188 - Math.abs(k) * 0.012, 0.487], [1, 1, 0.35], [0, 0, 0], { slot: 'pad', outline: false, hit: 'none' }); // 발가락 볼록이
    }
    // 꼬리: 몸 안에서 시작해 뒤로 나와 옆으로 감아 앞으로, 바닥에 놓임 (시작점은 공으로 막는다)
    b.tube([[-0.02, 0.24, -0.12], [0.1, 0.2, -0.32], [0.34, 0.15, -0.33], [0.47, 0.12, -0.08], [0.4, 0.1, 0.18]], 0.08, (t) => 1 - 0.2 * t, { name: 'tail' });
    b.sphere(0.08, [-0.02, 0.24, -0.12]);
    b.sphere(0.07, [0.39, 0.1, 0.2], [1, 0.9, 1.05], [0, 0, 0], { slot: 'accent' }); // 꼬리 끝
    b.nub(0.03, [0, 0.99], [1.4, 0.85, 0.5], { slot: 'nose' }); // 코
    // 큰 눈은 얼굴 가운데보다 조금 아래, 넓게 (어려 보이는 비율)
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.24, y: 1.08, w: 0.2, h: 0.235 }, { x: 0.42, y: 0.97, w: 0.16, h: 0.09 });
    stitchMouth(b, omega, 0, 0.948, 0.027, 0.007);
    for (const s of [-1, 1]) for (const dy of [0.02, -0.02]) b.stitch([[s * 0.47, 1.0 + dy], [s * 0.6, 1.0 + dy * 1.8]], 0.006, 'whisker'); // 수염
    for (const s of [-1, 1]) for (const dx of [-0.026, 0.026]) b.stitch([[s * 0.25 + dx, 0.52], [s * 0.25 + dx, 0.49]], 0.006, 'toe'); // 앞발 발가락 줄
    b.paint('mark-tabby', [0, 1.37], [0.24, 0.16], 'mark-tabby'); // 이마 줄무늬 (리본은 유명 고양이 캐릭터를 닮아 쓰지 않는다)
  },
};

// 토끼: 긴 귀(말랑), 큰 애니 눈, 코 아래 볼록한 두 볼, 솜뭉치 꼬리, 긴 뒷발에 분홍 젤리
const bunny: Species = {
  id: 'bunny', round: false, eyes: 'anime', iris: 'pink', slots: { accent: 0xffffff, pad: 0xffb3cd, inner: 0xffb3cd, nose: 0xff8fb0, thread: 0x4a2a3a },
  make(b: PlushBuilder, face: number) {
    b.sphere(0.58, [0, 1.18, 0], [1.12, 0.95, 0.95], [0, 0, 0], { name: 'head' });
    for (const s of [-1, 1]) {
      b.sphere(0.15, [s * 0.2, 1.9, -0.06], [0.8, 2.7, 0.55], [-0.12, 0, -s * 0.14], { hit: 'ear' }); // 긴 귀
      b.sphere(0.1, [s * 0.205, 1.92, 0.0], [0.65, 2.9, 0.25], [-0.12, 0, -s * 0.14], { slot: 'inner', outline: false, hit: 'none' }); // 귓속
      b.sphere(0.11, [s * 0.1, 1.0, 0.5], [1.1, 0.85, 0.75], [0, 0, 0], { slot: 'accent' }); // 코 아래 두 볼
    }
    sitBody(b, { pads: 'beans', footLong: 1.35, toes: true });
    b.sphere(0.12, [0, 0.32, -0.4], [1, 1, 1], [0, 0, 0], { slot: 'accent' }); // 솜뭉치 꼬리
    b.nub(0.035, [0, 1.07], [1.3, 0.9, 0.5], { slot: 'nose' });
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.22, y: 1.2, w: 0.17, h: 0.2 }, { x: 0.36, y: 1.02, w: 0.15, h: 0.09 });
    stitchMouth(b, omega, 0, 1.01, 0.022, 0.006);
  },
};

// 강아지: 처진 큰 귀(갈색), 넓은 흰 주둥이, 큰 검은 코, 위로 말린 꼬리
const dog: Species = {
  id: 'dog', round: false, eyes: 'dot', iris: 'brown', slots: { accent: 0xffffff, inner: 0xc98a5a, pad: 0xfff4e2, nose: 0x3a2a30, thread: 0x3a2330 },
  make(b: PlushBuilder, face: number) {
    b.sphere(0.6, [0, 1.2, 0], [1.1, 0.95, 0.97], [0, 0, 0], { name: 'head' });
    for (const s of [-1, 1]) b.sphere(0.24, [s * 0.6, 1.16, 0.14], [0.55, 1.4, 0.38], [0.2, s * 0.35, s * 0.3], { slot: 'inner', hit: 'ear' }); // 처진 귀 (앞으로 조금 나와 보이게)
    b.sphere(0.24, [0, 1.02, 0.46], [1.25, 0.85, 0.8], [0, 0, 0], { slot: 'accent' }); // 주둥이
    sitBody(b, { pads: 'cream', toes: true });
    b.tube([[0, 0.3, -0.34], [0, 0.42, -0.5], [0.02, 0.58, -0.5], [0.04, 0.66, -0.42]], 0.07, (t) => 1 - 0.3 * t, { name: 'tail' }); // 위로 말린 꼬리
    b.nub(0.07, [0, 1.1], [1.4, 0.95, 0.6], { slot: 'nose' });
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.22, y: 1.28, w: 0.1, h: 0.125 }, { x: 0.39, y: 1.08, w: 0.15, h: 0.09 });
    stitchMouth(b, omega, 0, 0.98, 0.034, 0.009);
  },
};

// 판다: 흰 몸, 진한 귀·팔·다리, 눈 둘레 처진 무늬(그 위에 눈), 흰 주둥이
const PANDA_DARK = 0x3d3546;
const panda: Species = {
  id: 'panda', round: false, eyes: 'dot', iris: 'brown', slots: { accent: 0xffffff, pad: 0x5a5066, nose: 0x2a2230, thread: 0x2a2230 },
  make(b: PlushBuilder, face: number) {
    b.sphere(0.6, [0, 1.2, 0], [1.12, 0.94, 0.96], [0, 0, 0], { name: 'head' });
    for (const s of [-1, 1] as const) b.sphere(0.17, [s * 0.47, 1.65, -0.08], [1, 1, 0.6], [0, 0, -s * 0.3], { slot: PANDA_DARK, hit: 'ear' }); // 귀
    b.sphere(0.2, [0, 1.04, 0.47], [1.25, 0.88, 0.75], [0, 0, 0], { slot: 'accent' }); // 주둥이
    sitBody(b, { armSlot: PANDA_DARK, legSlot: PANDA_DARK, pads: 'cream' });
    b.sphere(0.09, [0, 0.35, -0.38]); // 꼬리
    b.nub(0.05, [0, 1.11], [1.4, 0.9, 0.55], { slot: 'nose' });
    for (const s of [-1, 1]) b.paint('mark-patch', [s * 0.21, 1.24], [0.23, 0.28], 'mark-patch', s < 0); // 눈 둘레 무늬 (눈보다 먼저 — 눈이 위에)
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.21, y: 1.26, w: 0.09, h: 0.115 }, { x: 0.38, y: 1.05, w: 0.15, h: 0.09 });
    stitchMouth(b, omega, 0, 1.04, 0.032, 0.009);
  },
};

// 햄찌: 옆으로 통통한 머리, 볼주머니(흰 볼록이 둘), 작은 동그란 귀, 큰 애니 눈, 짧은 몸, 분홍 젤리
const hamster: Species = {
  id: 'hamster', round: false, eyes: 'anime', iris: 'brown', slots: { pad: 0xffb3cd, inner: 0xffb3cd, nose: 0xff8fb0, thread: 0x4a2a3a }, // 볼주머니는 몸 색을 밝게(accent 기본)
  make(b: PlushBuilder, face: number) {
    b.sphere(0.62, [0, 1.12, 0], [1.18, 0.94, 1.0], [0, 0, 0], { name: 'head' });
    for (const s of [-1, 1]) {
      b.sphere(0.13, [s * 0.4, 1.64, -0.05], [1, 1, 0.55], [0, 0, -s * 0.35], { hit: 'ear' }); // 동그란 귀
      b.sphere(0.085, [s * 0.4, 1.64, 0.01], [1, 1, 0.3], [0, 0, -s * 0.35], { slot: 'inner', outline: false, hit: 'none' });
      b.sphere(0.23, [s * 0.32, 0.97, 0.37], [1, 0.85, 0.8], [0, 0, 0], { slot: 'accent', outline: false }); // 볼주머니 (얼굴에 녹아 볼록, 스티커처럼 보이지 않게 외곽선 없음)
    }
    sitBody(b, { width: 1.08, height: 0.9, pads: 'beans', toes: true });
    b.sphere(0.06, [0, 0.28, -0.4]); // 꼬리
    b.nub(0.03, [0, 1.06], [1.3, 0.9, 0.5], { slot: 'nose' });
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.22, y: 1.17, w: 0.16, h: 0.19 }, { x: 0.36, y: 0.99, w: 0.15, h: 0.09 });
    stitchMouth(b, omega, 0, 1.01, 0.024, 0.006);
  },
};

export const SOFT: Species[] = [bunny, bear, cat, dog, panda, hamster];
