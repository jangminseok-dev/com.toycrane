import * as THREE from 'three';
import { paintEyes, stitchMouth } from './face';
import type { PlushBuilder, V3 } from './kit';
import { mirror, sitBody } from './parts';
import type { Species } from './species';

// 숲속 친구들 세트 (인형 리뉴얼 설계 §8: 생김새 세부는 빌더 — v13 곰·고양이와 같은 결)
const Z = new THREE.Vector3(0, 0, 1);
// dir 쪽으로 길쭉한 공의 회전(시작 축 z)
const along = (dir: V3): V3 => { const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(Z, new THREE.Vector3(...dir).normalize())); return [e.x, e.y, e.z]; };

// 여우: 큰 뾰족 귀, 흰 볼 털, 큰 애니 눈, 몸을 감은 굵은 꼬리(흰 끝)
const fox: Species = {
  id: 'fox', round: false, eyes: 'anime', iris: 'amber', slots: { accent: 0xffffff, inner: 0xfff1e2, pad: 0xfff4e2, nose: 0x3a2a30, thread: 0x3a2330 },
  make(b: PlushBuilder, face: number) {
    b.sphere(0.6, [0, 1.16, 0], [1.12, 0.93, 0.96], [0, 0, 0], { name: 'head' });
    for (const s of [-1, 1] as const) {
      b.pointedEar(0.26, [s * 0.42, 1.56, -0.04], s, 0.45, -0.06); // 큰 귀
      b.pointedEar(0.17, [s * 0.42, 1.54, 0.03], s, 0.28, -0.06, { slot: 'inner', outline: false, hit: 'none' });
      b.sphere(0.19, [s * 0.2, 0.99, 0.43], [1.25, 0.8, 0.75], [0, 0, s * 0.25], { slot: 'accent', outline: false, hit: 'none' }); // 흰 볼 털 (얼굴 장식 — 머리 공이 감싼다)
    }
    sitBody(b, { pads: 'cream', toes: true });
    b.tube([[0, 0.34, -0.12], [0.14, 0.27, -0.42], [0.46, 0.2, -0.38], [0.6, 0.17, -0.07], [0.5, 0.15, 0.2]], 0.13, (t) => 0.8 + 0.4 * Math.sin(Math.PI * t), { name: 'tail' }); // 굵은 꼬리 (몸 안에서 시작)
    b.sphere(0.12, [0.48, 0.15, 0.24], [1, 0.9, 1.1], [0, 0, 0], { slot: 'accent', hit: 'none' }); // 꼬리 끝 (꼬리 끝 공이 감싼다)
    b.nub(0.04, [0, 1.06], [1.3, 0.9, 0.5], { slot: 'nose' });
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.24, y: 1.17, w: 0.17, h: 0.2 }, { x: 0.4, y: 1.02, w: 0.14, h: 0.08 });
    stitchMouth(b, omega, 0, 1.0, 0.025, 0.007);
  },
};

// 너구리: 눈가 띠(그 위에 눈), 진한 둥근 귀, 흰 주둥이, 고리 무늬 꼬리
const RACCOON_DARK = 0x5a4a58;
const raccoon: Species = {
  id: 'raccoon', round: false, eyes: 'dot', iris: 'brown', slots: { accent: 0xffffff, inner: RACCOON_DARK, pad: 0xfff4e2, nose: 0x2e2430, thread: 0x2e2430 },
  make(b: PlushBuilder, face: number) {
    b.sphere(0.6, [0, 1.2, 0], [1.14, 0.93, 0.96], [0, 0, 0], { name: 'head' });
    for (const s of [-1, 1] as const) {
      b.sphere(0.17, [s * 0.48, 1.62, -0.06], [1, 1, 0.6], [0, 0, -s * 0.3], { hit: 'ear' });
      b.sphere(0.1, [s * 0.48, 1.61, 0.01], [1, 1, 0.32], [0, 0, -s * 0.3], { slot: 'inner', outline: false, hit: 'none' });
    }
    b.sphere(0.2, [0, 1.03, 0.47], [1.3, 0.88, 0.75], [0, 0, 0], { slot: 'accent' }); // 주둥이
    sitBody(b, { pads: 'cream', toes: true });
    // 고리 무늬 꼬리: 몸 색 마디(부딪힘)와 진한 마디(겉모습만)를 번갈아
    const ring: V3[] = [[0.05, 0.3, -0.36], [0.2, 0.34, -0.5], [0.36, 0.4, -0.56], [0.52, 0.47, -0.55], [0.66, 0.54, -0.5]];
    ring.forEach((at, i) => b.sphere(0.135 - i * 0.012, at, [1, 1, 1], [0, 0, 0], i % 2 ? { slot: RACCOON_DARK, hit: 'none' } : { name: 'tail' }));
    b.nub(0.05, [0, 1.11], [1.4, 0.9, 0.55], { slot: 'nose' });
    b.paint('mark-mask', [0, 1.25], [0.62, 0.24], 'mark-mask'); // 눈가 띠 (눈보다 먼저)
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.21, y: 1.26, w: 0.09, h: 0.115 }, { x: 0.39, y: 1.06, w: 0.14, h: 0.08 });
    stitchMouth(b, omega, 0, 1.03, 0.032, 0.009);
  },
};

// 다람쥐: 작은 뾰족 귀, 등을 타고 머리 위까지 올라간 큰 S자 꼬리, 크림 주둥이
const squirrel: Species = {
  id: 'squirrel', round: false, eyes: 'dot', iris: 'brown', slots: { accent: 0xfff1e2, inner: 0xffc7d4, pad: 0xfff4e2, nose: 0x5a3a3a, thread: 0x3a2330 },
  make(b: PlushBuilder, face: number) {
    b.sphere(0.58, [0, 1.18, 0], [1.1, 0.95, 0.96], [0, 0, 0], { name: 'head' });
    for (const s of [-1, 1] as const) {
      b.pointedEar(0.16, [s * 0.36, 1.62, -0.06], s, 0.5, -0.1);
      b.pointedEar(0.1, [s * 0.36, 1.61, -0.01], s, 0.3, -0.1, { slot: 'inner', outline: false, hit: 'none' });
    }
    b.sphere(0.18, [0, 1.02, 0.45], [1.3, 0.85, 0.75], [0, 0, 0], { slot: 'accent', hit: 'none' }); // 주둥이 (작아서 머리 공이 감싼다)
    sitBody(b, { pads: 'cream', toes: true });
    b.tube([[0.05, 0.38, -0.2], [0.12, 0.5, -0.6], [0.25, 0.85, -0.72], [0.38, 1.22, -0.6], [0.48, 1.45, -0.4], [0.52, 1.55, -0.2]], 0.19, (t) => 0.75 + 0.35 * Math.sin(Math.PI * t), { name: 'tail' }); // S자 꼬리
    b.nub(0.04, [0, 1.07], [1.3, 0.9, 0.5], { slot: 'nose' });
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.2, y: 1.25, w: 0.09, h: 0.115 }, { x: 0.36, y: 1.06, w: 0.14, h: 0.08 });
    stitchMouth(b, omega, 0, 1.01, 0.028, 0.008);
  },
};

// 부엉이(동글이형): 머리·몸이 한 덩어리, 큰 흰 눈 테두리 위에 눈, 귀깃, 작은 부리, 날개, 주황 발
const owl: Species = {
  id: 'owl', round: true, eyes: 'dot', iris: 'amber', slots: { accent: 0xfff6ea, inner: 0xd9c2a0, pad: 0xff9f43, nose: 0xff9f43, thread: 0x3a2330 },
  make(b: PlushBuilder, face: number) {
    b.sphere(0.62, [0, 1.0, 0], [1.05, 0.9, 0.95], [0, 0, 0], { name: 'head' }); // 위쪽 몸(머리)
    b.pear([[0.02, 0], [0.06, 0.4], [0.25, 0.6], [0.5, 0.64], [0.75, 0.58], [0.95, 0.4], [1.05, 0]], 0.92, 0); // 아래 몸
    b.sphere(0.36, [0, 0.48, 0.46], [1, 1.1, 0.45], [0, 0, 0], { slot: 'inner', outline: false, hit: 'none' }); // 배
    for (const s of [-1, 1] as const) {
      b.sphere(0.19, [s * 0.21, 1.03, 0.53], [1, 1, 0.35], [0, 0, 0], { slot: 'accent', hit: 'none' }); // 눈 테두리
      b.pointedEar(0.12, [s * 0.38, 1.5, -0.02], s, 0.45, 0); // 귀깃
      b.sphere(0.22, mirror(s, [0.6, 0.6, 0.02]), [0.45, 1.25, 0.8], [0, 0, s * 0.35], {}); // 날개
      b.sphere(0.09, mirror(s, [0.2, 0.05, 0.4]), [1.1, 0.6, 1.2], [0, 0, 0], { slot: 'pad' }); // 발
    }
    b.nub(0.07, [0, 0.9], [0.9, 1.2, 0.8], { slot: 'nose' }); // 부리
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.22, y: 1.03, w: 0.12, h: 0.15 }, { x: 0.42, y: 0.86, w: 0.14, h: 0.08 });
    stitchMouth(b, omega, 0, 0.8, 0.02, 0.006);
  },
};

// 아기사슴: 옆으로 뻗은 잎사귀 귀, 큰 애니 눈, 등과 머리의 흰 점, 작은 꼬리
const deer: Species = {
  id: 'deer', round: false, eyes: 'anime', iris: 'brown', slots: { accent: 0xfff6ea, inner: 0xffc7d4, pad: 0x7a5a4a, nose: 0x3a2a30, thread: 0x3a2330 },
  make(b: PlushBuilder, face: number) {
    b.sphere(0.58, [0, 1.18, 0], [1.1, 0.95, 0.96], [0, 0, 0], { name: 'head' });
    for (const s of [-1, 1] as const) {
      b.sphere(0.17, [s * 0.6, 1.5, -0.04], [1.7, 0.75, 0.42], [0, 0, s * 0.45], { hit: 'ear' }); // 잎사귀 귀
      b.sphere(0.11, [s * 0.6, 1.5, 0.0], [1.6, 0.65, 0.25], [0, 0, s * 0.45], { slot: 'inner', outline: false, hit: 'none' });
    }
    b.sphere(0.17, [0, 1.0, 0.45], [1.25, 0.85, 0.8], [0, 0, 0], { slot: 'accent' }); // 주둥이
    sitBody(b, { pads: 'cream' });
    b.sphere(0.08, [0, 0.36, -0.4], [1, 1.3, 0.8], [0.4, 0, 0], { slot: 'accent' }); // 꼬리
    // 흰 점: 머리 위 양옆과 등
    for (const at of [[-0.3, 1.58, 0.15], [0.3, 1.58, 0.15], [-0.18, 0.7, -0.33], [0.2, 0.55, -0.36], [0, 0.85, -0.3]] as V3[]) b.sphere(0.045, at, [1, 1, 0.5], along([at[0], at[1] - 0.8, at[2]]), { slot: 'accent', outline: false, hit: 'none' });
    b.nub(0.045, [0, 1.06], [1.3, 0.9, 0.5], { slot: 'nose' });
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.22, y: 1.19, w: 0.16, h: 0.19 }, { x: 0.38, y: 1.03, w: 0.14, h: 0.08 });
    stitchMouth(b, omega, 0, 0.97, 0.024, 0.007);
  },
};

// 고슴도치: 크림 얼굴·몸 앞, 머리 뒤와 등을 덮은 가시 모자(진한 갈색 + 바깥으로 뻗은 가시)
const SPIKE = 0x8a6a5a;
const hedgehog: Species = {
  id: 'hedgehog', round: false, eyes: 'dot', iris: 'brown', slots: { accent: 0xfff6ea, inner: 0xffc7d4, pad: 0xffc7d4, nose: 0x3a2a30, thread: 0x3a2330 },
  make(b: PlushBuilder, face: number) {
    b.sphere(0.58, [0, 1.15, 0.04], [1.1, 0.95, 0.96], [0, 0, 0], { name: 'head' });
    b.sphere(0.6, [0, 1.2, -0.1], [1.12, 0.98, 0.95], [0, 0, 0], { slot: SPIKE }); // 머리 가시 모자
    b.sphere(0.44, [0, 0.55, -0.12], [1.05, 1.1, 0.95], [0, 0, 0], { slot: SPIKE }); // 등 가시 모자
    for (const s of [-1, 1] as const) b.sphere(0.12, [s * 0.4, 1.58, 0.1], [1, 1, 0.6], [0, 0, -s * 0.3], { hit: 'ear' }); // 작은 귀
    sitBody(b, { pads: 'beans', toes: true });
    // 바깥으로 뻗은 가시: 머리 뒤 반구와 등에 고르게
    // 뒤쪽 반구에만: 방향 (sinθ·cosφ, sinφ, −cosθ·cosφ), θ는 뒤(0)에서 양옆 70°까지, φ는 높이
    for (const [cy, cz, r, yr] of [[1.2, -0.1, 0.64, 0.95], [0.55, -0.12, 0.48, 1.1]] as [number, number, number, number][])
      for (let i = 0; i < 7; i++) for (const el of [-0.25, 0.25, 0.7]) {
        const th = ((i / 6) * 2 - 1) * 1.22 + (el > 0.5 ? 0.17 : 0);
        const d: V3 = [Math.sin(th) * Math.cos(el), Math.sin(el) * yr, -Math.cos(th) * Math.cos(el)];
        b.sphere(0.075, [d[0] * r, cy + d[1] * r, cz + d[2] * r], [0.55, 0.55, 1.7], along(d), { slot: SPIKE, outline: false, hit: 'none' });
      }
    b.nub(0.05, [0, 1.06], [1.3, 0.9, 0.55], { slot: 'nose' });
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.2, y: 1.2, w: 0.09, h: 0.115 }, { x: 0.36, y: 1.02, w: 0.14, h: 0.08 });
    stitchMouth(b, omega, 0, 1.0, 0.028, 0.008);
  },
};

export const FOREST: Species[] = [fox, raccoon, squirrel, owl, deer, hedgehog];
