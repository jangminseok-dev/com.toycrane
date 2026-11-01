import * as THREE from 'three';
import { paintEyes, stitchMouth } from './face';
import type { PlushBuilder, V3 } from './kit';
import { mirror, sitBody } from './parts';
import type { Species } from './species';

// 꿈동산 친구들 세트 (인형 리뉴얼 설계 §8: 생김새 세부는 빌더 — v13 곰·고양이와 같은 결)
const Z = new THREE.Vector3(0, 0, 1);
const along = (dir: V3): V3 => { const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(Z, new THREE.Vector3(...dir).normalize())); return [e.x, e.y, e.z]; };
const GOLD_HORN = 0xffd36b;

// 병아리(동글이형): 둥근 몸, 머리 위 깃털 셋, 작은 주황 부리, 작은 날개, 주황 발
const chick: Species = {
  id: 'chick', round: true, eyes: 'dot', iris: 'brown', slots: { pad: 0xff9f43, nose: 0xff9f43, thread: 0x3a2330 },
  make(b: PlushBuilder, face: number) {
    const mid = 0.66, h = 1.5, w = 0.68, prof: [number, number][] = [];
    for (let i = 0; i <= 8; i++) { const a = (-Math.PI / 2) * (1 - i / 8); prof.push([mid + Math.sin(a) * mid, Math.pow(Math.cos(a), 0.7) * w]); }
    for (let i = 1; i <= 10; i++) { const a = (Math.PI / 2) * (i / 10); prof.push([mid + Math.sin(a) * (h - mid), Math.cos(a) * w]); }
    prof[0][1] = 0; prof[prof.length - 1][1] = 0;
    b.pear(prof, 0.94, 0, { name: 'head' });
    for (const dx of [-0.07, 0, 0.07]) b.sphere(0.05, [dx, 1.56, -0.02], [0.8, 1.9, 0.8], [0, 0, -dx * 4]); // 머리 깃털
    for (const s of [-1, 1]) {
      b.sphere(0.2, mirror(s, [0.64, 0.66, 0.02]), [0.42, 0.9, 0.8], [0, 0, s * 0.45]); // 날개
      b.limb(0.09, mirror(s, [0.2, 0.05, 0.42]), [1.15, 0.5, 1.3], [0, 0, 0], { slot: 'pad' }); // 발
    }
    b.nub(0.07, [0, 0.82], [1, 0.75, 1.05], { slot: 'nose' }); // 부리
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.24, y: 0.98, w: 0.1, h: 0.125 }, { x: 0.41, y: 0.8, w: 0.15, h: 0.09 });
    if (omega) stitchMouth(b, true, 0, 0.7, 0.02, 0.006);
  },
};

// 꿀꿀이: 큰 납작한 코(콧구멍 둘), 앞으로 접힌 세모 귀, 말린 꼬리
const pig: Species = {
  id: 'pig', round: false, eyes: 'dot', iris: 'brown', slots: { accent: 0xff9fbf, inner: 0xff9fbf, pad: 0xff9fbf, nose: 0x8a3a5a, thread: 0x4a2a3a },
  make(b: PlushBuilder, face: number) {
    b.sphere(0.6, [0, 1.18, 0], [1.14, 0.94, 0.96], [0, 0, 0], { name: 'head' });
    for (const s of [-1, 1] as const) b.pointedEar(0.17, [s * 0.4, 1.6, 0.08], s, 0.45, 0.6); // 앞으로 접힌 귀
    b.sphere(0.17, [0, 1.04, 0.55], [1.25, 0.95, 0.55], [0, 0, 0], { slot: 'accent' }); // 큰 코
    for (const s of [-1, 1]) b.nub(0.03, [s * 0.07, 1.04], [0.8, 1.2, 0.5], { slot: 'nose' }); // 콧구멍
    sitBody(b, { pads: 'cream', toes: false });
    b.tube([[0, 0.32, -0.36], [0.06, 0.38, -0.48], [-0.02, 0.46, -0.5], [0.0, 0.48, -0.42]], 0.035, () => 1, { hit: 'none', outline: true }); // 말린 꼬리
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.23, y: 1.27, w: 0.09, h: 0.115 }, { x: 0.39, y: 1.06, w: 0.15, h: 0.09 });
    stitchMouth(b, omega, 0, 0.9, 0.03, 0.008);
  },
};

// 양: 머리·몸을 덮은 뭉게 양털(몸 색 공 여러 개), 크림 얼굴, 옆으로 처진 귀
const sheep: Species = {
  id: 'sheep', round: false, eyes: 'dot', iris: 'brown', slots: { accent: 0xf2dcc4, inner: 0xf2dcc4, pad: 0xc9a98c, nose: 0x5a3a3a, thread: 0x3a2330 },
  make(b: PlushBuilder, face: number) {
    b.sphere(0.56, [0, 1.15, 0.05], [1.05, 0.95, 0.95], [0, 0, 0], { name: 'head', slot: 'accent' }); // 크림 얼굴(머리)
    // 머리 위·뒤 양털 뭉치
    for (const [x, y, z, r] of [[-0.32, 1.58, -0.02, 0.22], [0, 1.66, 0.02, 0.24], [0.32, 1.58, -0.02, 0.22], [-0.5, 1.3, -0.12, 0.2], [0.5, 1.3, -0.12, 0.2], [-0.18, 1.45, -0.32, 0.24], [0.18, 1.45, -0.32, 0.24]] as [number, number, number, number][]) b.sphere(r, [x, y, z]);
    for (const s of [-1, 1]) b.sphere(0.12, [s * 0.58, 1.12, 0.1], [1.4, 0.6, 0.55], [0, 0, s * 0.35], { slot: 'inner', hit: 'ear' }); // 처진 귀
    sitBody(b, { width: 1.12, pads: 'cream', armSlot: 'accent', legSlot: 'accent' });
    // 몸통 양털 뭉치
    for (const [x, y, z] of [[-0.3, 0.42, -0.18], [0.3, 0.42, -0.18], [0, 0.6, -0.3], [0, 0.3, -0.32]] as V3[]) b.sphere(0.2, [x, y, z], [1, 1, 1], [0, 0, 0], { hit: 'none' }); // 등 양털 (앞은 매끈하게)
    b.nub(0.04, [0, 1.06], [1.3, 0.9, 0.5], { slot: 'nose' });
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.2, y: 1.2, w: 0.09, h: 0.115 }, { x: 0.34, y: 1.04, w: 0.14, h: 0.08 });
    stitchMouth(b, omega, 0, 1.0, 0.026, 0.007);
  },
};

// 젖소: 얼룩(그림), 분홍 주둥이, 작은 뿔, 옆으로 나온 귀
const cow: Species = {
  id: 'cow', round: false, eyes: 'dot', iris: 'brown', slots: { accent: 0xffb3c7, inner: 0xffb3c7, pad: 0x6a5060, nose: 0x8a3a5a, thread: 0x3a2330 },
  make(b: PlushBuilder, face: number) {
    b.sphere(0.6, [0, 1.18, 0], [1.12, 0.94, 0.96], [0, 0, 0], { name: 'head' });
    b.sphere(0.22, [0, 1.0, 0.47], [1.35, 0.85, 0.75], [0, 0, 0], { slot: 'accent' }); // 분홍 주둥이
    for (const s of [-1, 1]) b.nub(0.025, [s * 0.09, 1.0], [0.8, 1.2, 0.5], { slot: 'nose' }); // 콧구멍
    for (const s of [-1, 1] as const) {
      b.sphere(0.13, [s * 0.66, 1.3, 0.0], [1.5, 0.6, 0.5], [0, 0, s * 0.2], { hit: 'ear' }); // 귀
      b.sphere(0.06, [s * 0.3, 1.72, 0.0], [0.9, 1.6, 0.9], [0, 0, -s * 0.35], { slot: 0xfff3dc }); // 작은 뿔
    }
    sitBody(b, { pads: 'cream' });
    b.tube([[0, 0.34, -0.36], [0.05, 0.3, -0.55], [0.08, 0.2, -0.62]], 0.03, () => 1, { hit: 'none' }); // 꼬리
    b.paint('mark-cowspot', [0.3, 1.5], [0.26, 0.22], 'mark-cowspot'); // 이마 얼룩
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.22, y: 1.27, w: 0.09, h: 0.115 }, { x: 0.4, y: 1.08, w: 0.15, h: 0.09 });
    stitchMouth(b, omega, 0, 0.93, 0.03, 0.008);
  },
};

// 공룡: 둥근 머리, 등 따라 노란 가시, 바닥에 놓인 굵은 꼬리
const dino: Species = {
  id: 'dino', round: false, eyes: 'dot', iris: 'brown', slots: { accent: 0xfff6d8, pad: 0xfff6d8, nose: 0x3a2a30, thread: 0x2e2430 },
  make(b: PlushBuilder, face: number) {
    b.sphere(0.6, [0, 1.18, 0.02], [1.08, 0.94, 1.0], [0, 0, 0], { name: 'head' });
    b.sphere(0.24, [0, 0.98, 0.45], [1.25, 0.82, 0.8], [0, 0, 0], { slot: 'accent' }); // 연한 주둥이
    sitBody(b, { pads: 'cream', toes: true });
    b.tube([[0, 0.34, -0.2], [0, 0.22, -0.55], [0.15, 0.13, -0.85], [0.35, 0.1, -0.98]], 0.2, (t) => 1 - 0.6 * t, { name: 'tail', balls: 5 }); // 굵은 꼬리 (가늘어지는 꼬리라 공 다섯)
    // 등 가시: 머리 꼭대기에서 꼬리까지 (부딪힘은 머리 위 셋만)
    const spikes: [V3, number, boolean][] = [[[0, 1.74, 0.02], 0.1, true], [[0, 1.64, -0.32], 0.09, false], [[0, 1.38, -0.55], 0.08, false], [[0, 0.82, -0.38], 0.075, false], [[0, 0.52, -0.5], 0.07, false], [[0.05, 0.38, -0.78], 0.06, false]];
    // 꼭대기 가시만 단단하게(집게가 머리 위에서 닿는 곳), 나머지는 몸·꼬리 공 안에서 겉모습만
    // 꼬리 끝 가시는 꼬리 위에 떠 있었다 — 꼬리 쪽으로 붙인다
    for (const [at, r, solid] of spikes) {
      const look: [V3, V3, V3] = [solid ? [0.75, 1.15, 0.9] : [0.55, 1.5, 0.9], along([0, at[1] - 0.6, at[2] - 0.2]), [0, 0, 0]];
      if (at[2] < -0.7) b.limb(r, at, look[0], look[1], { slot: 0xffb84d, hit: 'none' }, [0.12, 0.15, -0.8]);
      else b.sphere(r, at, look[0], look[1], { slot: 0xffb84d, hit: solid ? 'solid' : 'none' });
    }
    b.nub(0.035, [0, 1.06], [1.2, 0.8, 0.5], { slot: 'nose' });
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.22, y: 1.25, w: 0.095, h: 0.12 }, { x: 0.39, y: 1.05, w: 0.15, h: 0.09 });
    stitchMouth(b, omega, 0, 0.96, 0.032, 0.008);
  },
};

// 유니콘: 금 뿔, 무지개 갈기(분홍·하늘·노랑), 큰 애니 눈, 무지개 꼬리
const MANES = [0xff9fcf, 0x9fd8ff, 0xffe08a];
const unicorn: Species = {
  id: 'unicorn', round: false, eyes: 'anime', iris: 'pink', slots: { accent: 0xffffff, inner: 0xffc6dd, pad: 0xe8c4d8, nose: 0xff9fc0, thread: 0x4a2a3a },
  make(b: PlushBuilder, face: number) {
    b.sphere(0.6, [0, 1.16, 0], [1.1, 0.95, 0.96], [0, 0, 0], { name: 'head' });
    b.tube([[0, 1.66, 0.22], [0, 1.86, 0.3], [0, 2.02, 0.36]], 0.08, (t) => 1 - 0.85 * t, { slot: GOLD_HORN }); // 금 뿔
    for (const s of [-1, 1] as const) {
      b.pointedEar(0.15, [s * 0.38, 1.62, -0.06], s, 0.45, -0.1);
      b.pointedEar(0.09, [s * 0.38, 1.61, -0.02], s, 0.3, -0.1, { slot: 'inner', outline: false, hit: 'none' });
    }
    // 앞머리: 뿔 아래 이마에 세 색 뭉치 (앞에서 보이게)
    [[-0.17, 1.6, 0.26], [0, 1.64, 0.3], [0.17, 1.6, 0.26]].forEach((at, i) => b.sphere(0.11, at as V3, [1, 0.85, 0.8], [0, 0, 0], { slot: MANES[i], hit: 'none' }));
    // 갈기: 머리 뒤를 따라 한쪽으로 흘러내리는 세 색 뭉치
    [[0.1, 1.66, -0.22], [0.3, 1.5, -0.4], [0.44, 1.26, -0.42], [0.5, 1.0, -0.32]].forEach((at, i) => b.sphere(0.17 - i * 0.015, at as V3, [1, 1, 1], [0, 0, 0], { slot: MANES[i % 3], hit: i === 0 ? 'solid' : 'none' }));
    sitBody(b, { pads: 'cream' });
    // 무지개 꼬리: 세 색 공을 바닥 쪽으로
    // 털뭉치는 앞 뭉치에 붙어 이어진다(구슬처럼 떨어져 보이지 않게)
    const tufts: V3[] = [[0.05, 0.36, -0.42], [0.18, 0.26, -0.58], [0.32, 0.17, -0.66]];
    tufts.forEach((at, i) => b.limb(0.12 - i * 0.015, at, [1, 1, 1], [0, 0, 0], { slot: MANES[i], name: i === 0 ? 'tail' : undefined }, i ? b.lastLimb : undefined));
    b.nub(0.03, [0, 1.04], [1.3, 0.9, 0.5], { slot: 'nose' });
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.23, y: 1.15, w: 0.17, h: 0.2 }, { x: 0.39, y: 0.99, w: 0.15, h: 0.09 });
    stitchMouth(b, omega, 0, 0.98, 0.024, 0.007);
  },
};

export const DREAM: Species[] = [chick, pig, sheep, cow, dino, unicorn];
