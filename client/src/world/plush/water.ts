import * as THREE from 'three';
import { paintEyes, stitchMouth } from './face';
import type { PlushBuilder, V3 } from './kit';
import { mirror } from './parts';
import type { Species } from './species';

// 물가 친구들 세트: 모두 동글이형(머리·몸이 한 덩어리) — 몸 위쪽 공을 'head'로 둬서 겨냥 고리·머리 기준이 쓴다 (계획 Task 6)
const Z = new THREE.Vector3(0, 0, 1);
const along = (dir: V3): V3 => { const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(Z, new THREE.Vector3(...dir).normalize())); return [e.x, e.y, e.z]; };
// 통통한 물방울 몸 한 덩어리(머리·몸 사이 금 없이). 위쪽 공이 'head'
// 윗부분은 둥근 반타원(뾰족하지 않게), 아랫부분은 바닥에 넓게 앉는 모양
function blob(b: PlushBuilder, w = 0.66, h = 1.62): void {
  const mid = 0.42 * h, prof: [number, number][] = [];
  // 아래: 바닥에 넓게 앉은 반타원(옆으로 더 퍼짐), 위: 둥근 반타원 — 각도로 고르게 잡아 꼭대기가 뾰족해지지 않게
  for (let i = 0; i <= 8; i++) { const a = (-Math.PI / 2) * (1 - i / 8); prof.push([mid + Math.sin(a) * mid, Math.pow(Math.cos(a), 0.7) * w]); }
  for (let i = 1; i <= 10; i++) { const a = (Math.PI / 2) * (i / 10); prof.push([mid + Math.sin(a) * (h - mid), Math.cos(a) * w]); }
  prof[0][1] = 0; prof[prof.length - 1][1] = 0;
  b.pear(prof, 0.94, 0, { name: 'head' });
}
// 겉면에 붙은 무늬 판(배·얼굴): 앞에서 본 자리의 겉면에 반쯤 박힌 납작한 공
const patch = (b: PlushBuilder, r: number, at: [number, number], scale: V3, slot: 'accent' | 'pad' = 'accent') => b.nub(r, at, scale, { slot });

// 펭귄: 남색 몸, 흰 얼굴·배(하트 모양 얼굴은 두 공), 주황 부리·발, 날개
const penguin: Species = {
  id: 'penguin', round: true, eyes: 'dot', iris: 'brown', slots: { accent: 0xffffff, pad: 0xff9f43, nose: 0xff9f43, thread: 0x2e2430 },
  make(b: PlushBuilder, face: number) {
    blob(b);
    for (const s of [-1, 1]) patch(b, 0.26, [s * 0.16, 1.02], [1, 1.1, 0.3]); // 흰 얼굴 (하트 모양 두 판)
    patch(b, 0.38, [0, 0.5], [1, 1.12, 0.3]); // 흰 배
    for (const s of [-1, 1]) {
      b.sphere(0.22, mirror(s, [0.62, 0.62, 0.02]), [0.42, 1.2, 0.8], [0, 0, s * 0.38]); // 날개
      b.sphere(0.1, mirror(s, [0.2, 0.05, 0.42]), [1.15, 0.55, 1.3], [0, 0, 0], { slot: 'pad' }); // 발
    }
    b.nub(0.075, [0, 0.93], [1.15, 0.75, 1.1], { slot: 'nose' }); // 부리
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.22, y: 1.05, w: 0.1, h: 0.125 }, { x: 0.38, y: 0.88, w: 0.14, h: 0.08 });
    stitchMouth(b, omega, 0, 0.84, 0.02, 0.006);
  },
};

// 개구리: 머리 위 두 눈 봉오리(그 위에 눈), 넓게 웃는 입, 볼터치, 앞으로 뻗은 발
const frog: Species = {
  id: 'frog', round: true, eyes: 'dot', iris: 'brown', slots: { accent: 0xfffbea, pad: 0xfffbea, nose: 0x3a2a30, thread: 0x2e2430 },
  make(b: PlushBuilder, face: number) {
    blob(b, 0.72, 1.42); // 납작하고 넓은 몸
    patch(b, 0.36, [0, 0.42], [1.1, 0.9, 0.3]); // 배
    for (const s of [-1, 1]) {
      b.sphere(0.2, [s * 0.32, 1.32, 0.12]); // 눈 봉오리
      b.sphere(0.13, mirror(s, [0.42, 0.06, 0.38]), [1.2, 0.5, 1.35], [0, s * 0.3, 0]); // 발
      b.sphere(0.13, mirror(s, [0.58, 0.5, 0.2]), [0.5, 0.9, 0.9], [0, 0, s * 0.3]); // 앞발
    }
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.32, y: 1.36, w: 0.11, h: 0.135 }, { x: 0.42, y: 0.92, w: 0.15, h: 0.09 });
    if (omega) stitchMouth(b, true, 0, 0.88, 0.03, 0.008);
    else b.stitch([[-0.22, 0.95], [-0.11, 0.86], [0, 0.84], [0.11, 0.86], [0.22, 0.95]], 0.009, 'face-mouth'); // 넓게 웃는 입
  },
};

// 오리: 흰(팔레트) 몸, 납작한 주황 부리, 머리 위 깃털 한 가닥, 날개, 주황 발
const duck: Species = {
  id: 'duck', round: true, eyes: 'dot', iris: 'brown', slots: { accent: 0xffffff, pad: 0xff9f43, nose: 0xff9f43, thread: 0x2e2430 },
  make(b: PlushBuilder, face: number) {
    blob(b, 0.64, 1.6);
    for (const s of [-1, 1]) {
      b.sphere(0.22, mirror(s, [0.6, 0.6, -0.02]), [0.42, 1.0, 0.9], [0, 0, s * 0.4]); // 날개
      b.sphere(0.1, mirror(s, [0.2, 0.05, 0.42]), [1.15, 0.5, 1.3], [0, 0, 0], { slot: 'pad' }); // 발
    }
    b.tube([[0, 1.48, -0.05], [0.04, 1.62, -0.02], [0.1, 1.68, 0.06]], 0.045, (t) => 1 - 0.4 * t); // 머리 깃털
    b.nub(0.14, [0, 0.9], [1.3, 0.42, 0.9], { slot: 'nose' }); // 납작한 부리
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.23, y: 1.08, w: 0.1, h: 0.125 }, { x: 0.4, y: 0.92, w: 0.14, h: 0.08 });
    if (omega) stitchMouth(b, true, 0, 0.8, 0.02, 0.006);
  },
};

// 물범: 눕듯 앉은 통통한 몸, 흰 볼(콧수염 자리) 두 개 + 작은 코, 앞 지느러미, 뒤 꼬리지느러미
const seal: Species = {
  id: 'seal', round: true, eyes: 'dot', iris: 'brown', slots: { accent: 0xffffff, pad: 0xc8cdd8, nose: 0x3a2a30, thread: 0x2e2430 },
  make(b: PlushBuilder, face: number) {
    blob(b, 0.68, 1.55);
    for (const s of [-1, 1]) {
      b.sphere(0.12, [s * 0.1, 0.84, 0.55], [1.1, 0.85, 0.8], [0, 0, 0], { slot: 'accent' }); // 흰 볼
      b.sphere(0.2, mirror(s, [0.55, 0.32, 0.25]), [0.45, 0.6, 1.05], [0, s * 0.5, s * 0.6]); // 앞 지느러미
      b.sphere(0.15, mirror(s, [0.18, 0.12, -0.62]), [0.8, 0.45, 1.2], [0, s * 0.6, 0], { slot: 'pad' }); // 꼬리지느러미
    }
    b.nub(0.05, [0, 0.93], [1.4, 0.9, 0.6], { slot: 'nose' });
    for (const s of [-1, 1]) for (const dy of [0.02, -0.02]) b.stitch([[s * 0.2, 0.85 + dy], [s * 0.32, 0.86 + dy * 1.8]], 0.006, 'whisker');
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.24, y: 1.06, w: 0.11, h: 0.135 }, { x: 0.42, y: 0.92, w: 0.14, h: 0.08 });
    if (omega) stitchMouth(b, true, 0, 0.76, 0.02, 0.006);
  },
};

// 문어: 둥근 머리(몸), 아래로 늘어진 여섯 다리(바닥에 닿아 끝이 말림), 동그랗게 오므린 입
const octopus: Species = {
  id: 'octopus', round: true, eyes: 'dot', iris: 'brown', slots: { accent: 0xfff0f5, nose: 0x3a2a30, thread: 0x2e2430 },
  make(b: PlushBuilder, face: number) {
    b.sphere(0.66, [0, 0.95, 0], [1.05, 1.0, 1.0], [0, 0, 0], { name: 'head' });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6, dx = Math.sin(a), dz = Math.cos(a);
      b.tube([[dx * 0.25, 0.55, dz * 0.25], [dx * 0.42, 0.3, dz * 0.42], [dx * 0.55, 0.13, dz * 0.55], [dx * 0.68, 0.12, dz * 0.68]], 0.13, (t) => 1 - 0.25 * t, { balls: 3 }); // 굽은 다리 아랫면까지 감싸게 넷(뿌리 공은 머리 공 안이라 빠진다) // 끝까지 통통하게(가는 끝은 공이 못 감싼다)
    }
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.25, y: 1.0, w: 0.11, h: 0.14 }, { x: 0.43, y: 0.84, w: 0.15, h: 0.09 });
    if (omega) stitchMouth(b, true, 0, 0.8, 0.022, 0.007);
    else b.nub(0.06, [0, 0.8], [1, 0.8, 0.6], { slot: 'nose', outline: true }); // 오므린 입
  },
};

// 고래: 앞뒤로 긴 통통한 몸, 연한 배, 옆 지느러미, 위로 올린 꼬리, 머리 위 물줄기
const whale: Species = {
  id: 'whale', round: true, eyes: 'dot', iris: 'brown', slots: { accent: 0xdff0ff, pad: 0xbfe6ff, nose: 0x3a2a30, thread: 0x2e2430 },
  make(b: PlushBuilder, face: number) {
    blob(b, 0.68, 1.5);
    patch(b, 0.4, [0, 0.42], [1.05, 0.9, 0.3]); // 연한 배
    for (const s of [-1, 1]) b.sphere(0.2, mirror(s, [0.62, 0.42, 0.18]), [0.4, 0.55, 1.1], [0, s * 0.6, s * 0.4]); // 옆 지느러미
    b.tube([[0, 0.45, -0.45], [0, 0.65, -0.72], [0, 0.95, -0.8]], 0.12, (t) => 1 - 0.3 * t, { name: 'tail' }); // 꼬리대
    for (const s of [-1, 1]) b.sphere(0.16, mirror(s, [0.16, 1.02, -0.8]), [1.2, 0.4, 0.8], along([s * 0.8, 0.5, 0])); // 꼬리지느러미
    for (const [x, y] of [[0, 1.65], [-0.09, 1.76], [0.09, 1.76]] as [number, number][]) b.sphere(0.06, [x, y, 0.05], [1, 1.2, 1], [0, 0, 0], { slot: 'pad', hit: x === 0 ? 'solid' : 'none' }); // 물줄기
    const omega = paintEyes(b, this.eyes, this.iris, face, { x: 0.26, y: 0.98, w: 0.11, h: 0.135 }, { x: 0.43, y: 0.83, w: 0.15, h: 0.09 });
    stitchMouth(b, omega, 0, 0.8, 0.03, 0.008);
  },
};

export const WATER: Species[] = [penguin, frog, duck, seal, octopus, whale];
