import * as THREE from 'three';
import { DOLLS, GOLD } from '../data/catalog';
import type { Body, DollLook } from '../net/protocol';
import { effectMaterial, goldMaterial, goldToon, sparkMaterial, squirrelMat, squirrelTail } from './dollTextures';
import { CAP_LO, SPH, SPH_LO, cap, outlineMat, part, toon } from './toon';

// 인형 24종 (전부 오리지널). 시제품 docs/reference/prototypes/spike-arcade-big-v3.html makeDoll(338~535행)을 옮김.
// 이름·세트·색 이름은 shared/catalog.json, 여기엔 생김새만 둔다. 같은 캐릭터도 인형마다 색·표정·희귀가 다르다(DollLook,
// 설계 2026-10-31 인형 채우기 §4.4). 체형(폭)은 놓는 쪽이 x·z 크기에 BODY_W를 곱한다
// round = 몸통 하나짜리 동글이형, feet = 발 색(없으면 발 없음), wings = 날개·지느러미
type Look = { color: number; round?: boolean; feet?: 'orange' | 'body'; wings?: boolean };
const LOOKS: Record<string, Look> = {
  bunny: { color: 0xfff4f8 }, bear: { color: 0xe8b07a }, cat: { color: 0xffc58f }, dog: { color: 0xfff1dc },
  panda: { color: 0xffffff }, hamster: { color: 0xf3d2a2 },
  fox: { color: 0xff9a52 }, raccoon: { color: 0xb3a59a }, squirrel: { color: 0xc98a52 },
  owl: { color: 0x9a7a5a, round: true, feet: 'orange', wings: true }, deer: { color: 0xd9a46a }, hedgehog: { color: 0xf5dcc0 },
  penguin: { color: 0x4a5a8a, round: true, feet: 'orange', wings: true }, frog: { color: 0x9be36f, round: true, feet: 'body', wings: true },
  duck: { color: 0xffffff, round: true, feet: 'orange', wings: true }, seal: { color: 0xdfe3ea, round: true, wings: true },
  octopus: { color: 0xff8fb1, round: true }, whale: { color: 0x6fa8dc, round: true, wings: true },
  chick: { color: 0xffe066, round: true, feet: 'orange', wings: true }, pig: { color: 0xffc4d6 }, sheep: { color: 0xffffff },
  cow: { color: 0xffffff }, dino: { color: 0x8fdc8a }, unicorn: { color: 0xfdf4ff },
};

export const PLAIN: DollLook = { color: 0, body: 'n', face: 0, rare: '' };
// 체형 폭 (키는 같음) — 서버 domain/crane.py BODY_W와 같은 값
export const BODY_W: Record<Body, number> = { n: 1, c: 1.15, s: 0.88 };

// 동글이형(몸통 하나)인지 — 겨냥 고리가 인형 머리 높이를 가늠할 때 쓴다
export function isRoundDoll(id: string): boolean {
  return !!LOOKS[id]?.round;
}

// 인형 머리(동글이형은 몸통 위쪽)를 구로 본 크기 — 인형 모양 좌표(크기 1) 기준 중심 높이·반지름.
// 겨냥 고리(game/aim.ts)와 머리 기준 자세(world/dollPose.ts)가 쓴다 (설계 2026-10-31 §4.2·§4.8)
export const HEAD = { standing: { c: 0.74, r: 0.35 }, round: { c: 0.5, r: 0.48 } } as const;
export function headOf(id: string): { c: number; r: number } {
  return isRoundDoll(id) ? HEAD.round : HEAD.standing;
}

const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
const INK = toon(0x2b1d3f), BLUSH = toon(0xff9ec4), ORANGE = toon(0xff9f43), CREAM = toon(0xfff0dc), PURE = toon(0xffffff);
const UP = new THREE.Vector3(0, 1, 0);
const DG = {
  bunnyEar: cap(0.075, 0.36), bunnyInner: cap(0.04, 0.26), beak: new THREE.ConeGeometry(0.08, 0.16, 10),
  catEar: new THREE.ConeGeometry(0.11, 0.22, 10), foxEar: new THREE.ConeGeometry(0.12, 0.27, 10), smallEar: new THREE.ConeGeometry(0.07, 0.12, 8),
  spike: new THREE.ConeGeometry(0.06, 0.15, 8), dinoTail: new THREE.ConeGeometry(0.12, 0.36, 10), tail: cap(0.05, 0.32),
  snout: new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16), horn: new THREE.ConeGeometry(0.055, 0.28, 10), tentacle: cap(0.07, 0.22),
  crownBand: new THREE.CylinderGeometry(0.15, 0.16, 0.08, 20), crownTip: new THREE.ConeGeometry(0.035, 0.09, 8),
  spark: new THREE.OctahedronGeometry(0.035),
  // 표정: 웃는 눈·감은 눈(∩), ω 입(∪ 둘)
  happyEye: new THREE.TorusGeometry(0.042, 0.014, 5, 10, Math.PI), mouth: new THREE.TorusGeometry(0.024, 0.009, 4, 8, Math.PI),
};
const BLUSH_HOT = toon(0xff7aa8);
const TAG = new THREE.BoxGeometry(0.06, 0.09, 0.01); // 옆구리 품질 택
const HEAD_DROP = 0.06; // 천 인형 비율: 머리를 예전(0.8)보다 0.06 낮게(0.74) — 머리에 붙은 부품도 같이 내린다
const lighter = (c: number) => toon(new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.55).getHex());
const CROWN_GOLD = 1.4; // 황금 인형의 큰 왕관

type V3 = [number, number, number];

// lite = 기계 속 무더기용: 면 수를 낮추고 볼터치·눈 반짝이·팔다리 같은 잔부품은 뺀다(표정은 남긴다 — 무더기에서도 보이게).
// 목록에 없는 id는 null (배포로 목록이 바뀐 뒤 저장된 배치에 남은 인형). 희귀 반짝이는 userData.spin으로 돌릴 것을 알려 준다.
// look.rare: '' 일반(몸 색 = 색 6가지 중 look.color) · 효과 id(그 무늬, 작은 왕관) · 'gold'(온몸이 진짜 금, 큰 왕관)
export function makeDoll(id: string, look: DollLook = PLAIN, lite = false): THREE.Group | null {
  const info = DOLLS[id];
  if (!info) return null;
  const shape = id, sd = LOOKS[shape], S = lite ? SPH_LO : SPH;
  if (!sd) return null;
  const gold = look.rare === GOLD.id, effect = look.rare !== '' && !gold;
  const color = new THREE.Color(info.palette[look.color]?.color ?? info.palette[0].color).getHex();
  const body = gold ? goldMaterial() : effect ? effectMaterial(look.rare) : shape === 'squirrel' ? squirrelMat('#' + new THREE.Color(color).getHexString()) : toon(color);
  const accent = effect ? CREAM : lighter(color); // 배·얼굴판 (황금은 아래에서 온몸을 금으로)
  const g = new THREE.Group();
  g.userData.spin = [];
  const OL = lite ? 0 : 1.06; // 잔부품 외곽선
  const p = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, scl: V3 = [1, 1, 1], rot: V3 = [0, 0, 0], ol = 1.06) => {
    const m = part(geo, mat, pos, scl, rot, ol); g.add(m); return m;
  };
  const pointed = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, dir: THREE.Vector3, scl: V3, ol = OL) => {
    const m = p(geo, mat, pos, scl, [0, 0, 0], ol); m.quaternion.setFromUnitVectors(UP, dir.normalize()); return m;
  };
  // 표정 5가지 (look.face): 0 웃음(웃는 눈 ∩∩) · 1 ω 입 · 2 윙크(오른눈 감음) · 3 졸린 눈(가는 눈) · 4 볼 빨개짐(큰 볼터치).
  // 얼굴 부품 이름은 face-로 시작한다. 입 자리(mouthAt)는 코·부리 아래 — 모양마다 정해 두고, 없으면 눈 아래
  let mouthAt: V3 | null = null;
  const facePart = (name: string, geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, scl: V3, rot: V3 = [0, 0, 0]) => {
    const m = p(geo, mat, pos, scl, rot, 0); m.name = name; return m;
  };
  const eyes = (y: number, z: number, dx: number, bx: number, bz: number) => {
    const f = look.face;
    for (const s of [-1, 1]) {
      const closed = f === 0 || (f === 2 && s === 1);
      if (closed) facePart('face-happy', DG.happyEye, INK, [s * dx, y - 0.015, z + 0.01], [1, 1, 1]);
      else if (f === 3) facePart('face-sleepy', S, INK, [s * dx, y - 0.012, z], [0.05, 0.013, 0.025], [0, 0, s * 0.12]);
      else {
        facePart('face-eye', S, INK, [s * dx, y, z], [0.045, 0.055, 0.03]);
        if (!lite) facePart('face-shine', S, white, [s * dx + 0.013, y + 0.022, z + 0.022], [0.014, 0.014, 0.01]);
      }
      if (f === 4) facePart('face-cheek-big', S, BLUSH_HOT, [s * bx, y - 0.075, bz + 0.005], [0.075, 0.045, 0.025]);
      else if (!lite) facePart('face-cheek', S, BLUSH, [s * bx, y - 0.07, bz], [0.05, 0.03, 0.02]);
    }
    if (f === 1) {
      const [mx, my, mz] = mouthAt ?? [0, y - 0.13, z + 0.03];
      for (const s of [-1, 1]) facePart('face-mouth', DG.mouth, INK, [mx + s * 0.023, my, mz], [1, 1, 1], [0, 0, Math.PI]);
    }
  };
  const nose = (y: number, z: number, mat: THREE.Material = INK) => {
    mouthAt = [0, y - 0.055, z + 0.012];
    return p(S, mat, [0, y, z], [0.05, 0.035, 0.035], [0, 0, 0], 0);
  };

  if (sd.round) {
    // 동글이형: 몸통 하나 (문어는 머리를 띄우고 다리 6개)
    if (shape === 'octopus') {
      p(S, body, [0, 0.62, 0], [0.42, 0.45, 0.4]).name = 'body';
      mouthAt = [0, 0.55, 0.405];
      const n = lite ? 4 : 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.PI / 6, dx = Math.sin(a), dz = Math.cos(a);
        pointed(lite ? CAP_LO : DG.tentacle, body, [dx * 0.26, 0.14, dz * 0.26], new THREE.Vector3(dx, -0.35, dz), [1, 1, 1], 1.06);
      }
      eyes(0.66, 0.37, 0.15, 0.25, 0.33);
    } else {
      p(S, body, [0, 0.5, 0], [0.45, 0.52, 0.43]).name = 'body';
      if (!lite && ['chick', 'duck', 'seal', 'frog'].includes(shape)) p(S, accent, [0, 0.42, 0.3], [0.26, 0.28, 0.16], [0, 0, 0], 0);
      if (!lite) p(TAG, PURE, [0.36, 0.22, -0.18], [1, 1, 1], [0, 0.9, 0], 0);
      if (!lite) for (const s of [-1, 1]) {
        if (sd.wings) p(S, body, [s * 0.43, 0.45, 0.02], [0.1, 0.18, 0.12], [0, 0, -s * 0.5]);
        if (sd.feet) p(S, sd.feet === 'orange' ? ORANGE : body, [s * 0.16, 0.04, 0.14], [0.11, 0.06, 0.14]);
      }
      if (shape === 'chick') {
        p(DG.beak, ORANGE, [0, 0.6, 0.46], [1, 1, 1], [Math.PI / 2, 0, 0], OL);
        mouthAt = [0, 0.5, 0.465];
        if (!lite) for (const dx of [-0.06, 0, 0.06]) p(S, body, [dx, 1.04, -0.02], [0.035, 0.1, 0.035], [0, 0, dx * 5]);
        eyes(0.74, 0.35, 0.15, 0.25, 0.32);
      } else if (shape === 'penguin') {
        p(S, PURE, [0, 0.45, 0.14], [0.34, 0.4, 0.32], [0, 0, 0], 0);
        p(DG.beak, ORANGE, [0, 0.62, 0.46], [1, 0.8, 1], [Math.PI / 2, 0, 0], OL);
        mouthAt = [0, 0.52, 0.468];
        eyes(0.76, 0.37, 0.14, 0.25, 0.33);
      } else if (shape === 'frog') {
        for (const s of [-1, 1]) p(S, body, [s * 0.2, 0.95, 0.12], [0.15, 0.13, 0.15]);
        mouthAt = [0, 0.56, 0.43];
        eyes(0.98, 0.26, 0.2, 0.3, 0.3);
        if (look.face !== 1) p(S, BLUSH, [0, 0.58, 0.42], [0.2, 0.03, 0.03], [0, 0, 0], 0);
      } else if (shape === 'owl') {
        p(S, toon(0xd9c2a0), [0, 0.42, 0.18], [0.3, 0.32, 0.28], [0, 0, 0], 0);
        mouthAt = [0, 0.5, 0.462];
        for (const s of [-1, 1]) {
          p(S, PURE, [s * 0.17, 0.72, 0.33], [0.15, 0.15, 0.07], [0, 0, 0], OL);
          p(DG.smallEar, body, [s * 0.24, 1.0, 0], [1, 1, 0.7], [0, 0, -s * 0.35]);
        }
        p(DG.beak, ORANGE, [0, 0.6, 0.41], [0.6, 0.6, 0.6], [Math.PI, 0, 0], 0);
        eyes(0.72, 0.4, 0.17, 0.3, 0.33);
      } else if (shape === 'duck') {
        p(S, ORANGE, [0, 0.6, 0.44], [0.17, 0.05, 0.12], [0, 0, 0], OL);
        mouthAt = [0, 0.51, 0.462];
        if (!lite) p(S, body, [0, 1.04, -0.02], [0.04, 0.09, 0.04]);
        eyes(0.76, 0.36, 0.15, 0.25, 0.32);
      } else if (shape === 'seal') {
        for (const s of [-1, 1]) p(S, PURE, [s * 0.065, 0.6, 0.39], [0.08, 0.065, 0.06], [0, 0, 0], 0);
        nose(0.66, 0.44);
        eyes(0.76, 0.36, 0.17, 0.27, 0.32);
      } else if (shape === 'whale') {
        p(S, toon(0xcfe8ff), [0, 0.4, 0.16], [0.34, 0.3, 0.3], [0, 0, 0], 0);
        mouthAt = [0, 0.58, 0.435];
        for (const s of [-1, 1]) p(S, body, [s * 0.13, 0.95, -0.36], [0.14, 0.05, 0.09], [0, 0, s * 0.4]);
        if (!lite) for (const [x, y] of [[0, 1.1], [-0.07, 1.19], [0.07, 1.19]]) p(S, toon(0x9fe0ff), [x, y, 0.05], [0.04, 0.05, 0.04], [0, 0, 0], 0);
        eyes(0.7, 0.38, 0.17, 0.27, 0.34);
      }
    }
  } else {
    // 서 있는 형: 몸통 + 머리 + 팔다리
    const limb = shape === 'panda' && !gold ? INK : body;
    p(S, body, [0, 0.3, 0], [0.3, 0.29, 0.27]).name = 'body';
    p(S, body, [0, 0.8, 0], [0.36, 0.33, 0.34]); // 머리(아래에서 HEAD_DROP만큼 내려 0.74)
    if (!lite) {
      p(S, accent, [0, 0.28, 0.17], [0.2, 0.21, 0.1], [0, 0, 0], 0);
      p(TAG, PURE, [0.28, 0.16, -0.06], [1, 1, 1], [0, 0.9, 0], 0);
    }
    // 손가락에 닿으면 휘는 귀: 이름 'ear' + 닿는 공(내린 뒤 자리)·바깥 위 방향
    const ear = (m: THREE.Mesh, s: number, c: V3, r: number) => {
      m.name = 'ear';
      m.userData.ear = { c: new THREE.Vector3(c[0], c[1] - HEAD_DROP, c[2]), r, out: new THREE.Vector3(s, 0.5, 0).normalize() };
    };
    if (!lite) for (const s of [-1, 1]) {
      p(S, limb, shape === 'squirrel' ? [s * 0.14, 0.44, 0.25] : [s * 0.31, 0.36, 0.06], [0.1, 0.1, 0.1]);
      p(S, limb, [s * 0.15, 0.06, 0.12], [0.12, 0.08, 0.14]);
    }
    const muzzle = (mat: THREE.Material) => { p(S, mat, [0, 0.72, 0.27], [0.15, 0.11, 0.09]); nose(0.76, 0.35); };
    let eyeZ = 0.305, eyeY = 0.83;
    for (const s of [-1, 1]) {
      if (shape === 'bunny') {
        const e = p(lite ? CAP_LO : DG.bunnyEar, body, [s * 0.14, 1.27, -0.02], [1, 1, 1], [0, 0, -s * 0.18]);
        if (!lite) e.add(part(DG.bunnyInner, toon(0xffb3cf), [0, 0, 0.06], [1, 1, 0.5], [0, 0, 0], 0));
        ear(e, s, [s * 0.16, 1.26, -0.02], 0.13);
      } else if (shape === 'bear' || shape === 'panda') ear(p(S, shape === 'panda' ? INK : body, [s * 0.27, 1.07, -0.02], [0.12, 0.12, 0.08]), s, [s * 0.27, 1.07, -0.02], 0.12);
      else if (shape === 'raccoon') ear(p(S, toon(0x5a4a58), [s * 0.27, 1.05, -0.02], [0.11, 0.11, 0.07]), s, [s * 0.27, 1.05, -0.02], 0.11);
      else if (shape === 'cat') ear(p(DG.catEar, body, [s * 0.22, 1.1, 0], [1, 1, 0.6], [0, 0, -s * 0.35]), s, [s * 0.22, 1.1, 0], 0.1);
      else if (shape === 'fox') ear(p(DG.foxEar, body, [s * 0.21, 1.13, 0], [1, 1, 0.55], [0, 0, -s * 0.3]), s, [s * 0.21, 1.13, 0], 0.11);
      else if (shape === 'squirrel') ear(p(DG.foxEar, effect ? body : toon(color), [s * 0.19, 1.13, -0.02], [0.72, 0.85, 0.5], [0, 0, -s * 0.25]), s, [s * 0.19, 1.13, -0.02], 0.09);
      else if (shape === 'dog') p(S, toon(0xc98a5a), [s * 0.37, 0.8, 0], [0.1, 0.2, 0.13], [0, 0, s * 0.25]);
      else if (shape === 'pig') p(DG.smallEar, body, [s * 0.24, 1.08, 0.05], [1, 1, 0.6], [0.5, 0, -s * 0.4]);
      else if (shape === 'deer') p(S, body, [s * 0.34, 0.98, -0.02], [0.15, 0.07, 0.06], [0, 0, s * 0.4]);
      else if (shape === 'sheep' || shape === 'cow') p(S, shape === 'sheep' ? toon(0xf2dcc4) : body, [s * 0.37, 0.88, 0], [0.12, 0.06, 0.06], [0, 0, s * 0.3]);
      else if (shape === 'unicorn') p(DG.smallEar, body, [s * 0.2, 1.09, -0.04], [1, 1, 0.6], [0, 0, -s * 0.3]);
      else if (shape === 'hamster') {
        p(S, toon(0xffb3cf), [s * 0.25, 1.06, 0], [0.08, 0.08, 0.05]);
        p(S, PURE, [s * 0.22, 0.71, 0.18], [0.14, 0.12, 0.12], [0, 0, 0], OL);
      }
    }
    if (shape === 'bear') muzzle(CREAM);
    else if (shape === 'dog' || shape === 'raccoon') muzzle(PURE);
    else if (shape === 'deer') muzzle(CREAM);
    else if (shape === 'panda') {
      for (const s of [-1, 1]) p(S, INK, [s * 0.13, 0.82, 0.285], [0.09, 0.11, 0.05], [0, 0, s * 0.4], 0);
      nose(0.74, 0.33);
    } else if (shape === 'pig') {
      p(DG.snout, BLUSH, [0, 0.74, 0.33], [1, 1, 1], [Math.PI / 2, 0, 0], OL);
      mouthAt = [0, 0.655, 0.33];
      if (!lite) for (const s of [-1, 1]) p(S, INK, [s * 0.04, 0.74, 0.365], [0.02, 0.03, 0.01], [0, 0, 0], 0);
    } else if (shape === 'fox') {
      p(S, PURE, [0, 0.72, 0.24], [0.26, 0.13, 0.12], [0, 0, 0], 0);
      p(S, INK, [0, 0.75, 0.355], [0.04, 0.03, 0.03], [0, 0, 0], 0);
      mouthAt = [0, 0.7, 0.36];
      p(S, body, [0, 0.32, -0.36], [0.14, 0.14, 0.28]);
      if (!lite) p(S, PURE, [0, 0.32, -0.6], [0.08, 0.08, 0.08]);
    } else if (shape === 'cat' || shape === 'hamster') {
      p(S, BLUSH, [0, 0.75, 0.34], [0.035, 0.025, 0.02], [0, 0, 0], 0);
      mouthAt = [0, 0.7, 0.345];
      if (shape === 'cat' && !lite) p(DG.tail, body, [0.16, 0.3, -0.32], [1, 1, 1], [0.7, 0, -0.6]);
    } else if (shape === 'raccoon') {
      // 눈 둘레 검은 띠 + 줄무늬 꼬리
      p(S, toon(0x5a4a58), [0, 0.83, 0.27], [0.3, 0.085, 0.07], [0, 0, 0], 0);
      eyeZ = 0.33;
      p(S, toon(0x5a4a58), [0, 0.3, -0.36], [0.12, 0.12, 0.26]);
      if (!lite) p(S, body, [0, 0.3, -0.47], [0.125, 0.125, 0.06], [0, 0, 0], 0);
    } else if (shape === 'squirrel') {
      // 머리 위로 말려 올라가는 S자 꼬리 + 앞발로 안은 도토리
      nose(0.76, 0.34, BLUSH);
      const tails = squirrelTail();
      const tail = new THREE.Mesh(lite ? tails.lo : tails.hi, effect ? body : toon(new THREE.Color(color).lerp(new THREE.Color(0x3a2010), 0.12).getHex()));
      tail.name = 'tail'; // 말랑한 꼬리 — 집게가 닿는 공에서 뺀다
      tail.castShadow = true; g.add(tail);
      if (!lite) {
        g.add(new THREE.Mesh(tails.hiLine, outlineMat));
        p(S, toon(0xb5763c), [0, 0.42, 0.33], [0.075, 0.09, 0.075]);
        p(S, toon(0x7a5230), [0, 0.5, 0.33], [0.085, 0.045, 0.085]);
      }
    } else if (shape === 'deer') {
      if (!lite) for (const s of [-1, 1]) {
        p(S, PURE, [s * 0.16, 1.0, 0.22], [0.035, 0.035, 0.02], [0, 0, 0], 0);
        p(S, PURE, [s * 0.2, 0.42, 0.22], [0.045, 0.045, 0.02], [0, 0, 0], 0);
      }
    } else if (shape === 'hedgehog') {
      // 머리 뒤쪽·몸통 등에 가시
      const spikeMat = toon(0x8a6a5a);
      const head: V3[] = [[0, 1, -0.3], [0.5, 0.8, -0.4], [-0.5, 0.8, -0.4], [0, 0.6, -0.8], [0.65, 0.4, -0.65], [-0.65, 0.4, -0.65], [0, 0.1, -1], [0.75, 0, -0.6], [-0.75, 0, -0.6]];
      for (const [x, y, z] of lite ? head.slice(0, 5) : head) {
        const dir = new THREE.Vector3(x, y, z).normalize();
        pointed(DG.spike, spikeMat, [dir.x * 0.38, 0.8 + dir.y * 0.34, dir.z * 0.34], dir, [1.3, 1.6, 1.3]);
      }
      if (!lite) for (const [x, y, z] of [[0, 0.3, -1], [0.6, 0.2, -0.8], [-0.6, 0.2, -0.8]]) {
        const dir = new THREE.Vector3(x, y, z).normalize();
        pointed(DG.spike, spikeMat, [dir.x * 0.33, 0.32 + dir.y * 0.3, dir.z * 0.3], dir, [1.3, 1.6, 1.3]);
      }
      nose(0.76, 0.35);
    } else if (shape === 'sheep') {
      // 크림색 얼굴판 + 머리 위 뭉게 털
      p(S, toon(0xf2dcc4), [0, 0.78, 0.17], [0.27, 0.25, 0.2], [0, 0, 0], 0);
      eyeZ = 0.355; eyeY = 0.81;
      for (const [x, z] of lite ? [[-0.1, 0], [0.1, 0]] : [[-0.16, 0.02], [0, 0.08], [0.16, 0.02], [-0.08, -0.12], [0.08, -0.12]]) p(S, body, [x, 1.08, z], [0.12, 0.11, 0.12]);
    } else if (shape === 'cow') {
      const spot = toon(0x3b2a3a);
      for (const [x, y, z, sx, sy] of [[0.15, 0.4, 0.2, 0.1, 0.08], [-0.2, 0.28, 0.14, 0.09, 0.07], [0.2, 0.96, 0.16, 0.1, 0.07], [-0.12, 0.3, -0.24, 0.1, 0.08]]) p(S, spot, [x, y, z], [sx, sy, 0.06], [0, 0, 0], 0);
      p(S, toon(0xffb3c7), [0, 0.7, 0.26], [0.22, 0.12, 0.1]);
      mouthAt = [0, 0.64, 0.35];
      if (!lite) for (const s of [-1, 1]) p(S, INK, [s * 0.07, 0.71, 0.355], [0.02, 0.03, 0.01], [0, 0, 0], 0);
      for (const s of [-1, 1]) p(DG.smallEar, CREAM, [s * 0.17, 1.12, 0], [0.7, 0.9, 0.7], [0, 0, -s * 0.5]);
    } else if (shape === 'dino') {
      const spikeMat = toon(0xffb84d);
      for (const [y, z, rx] of [[1.15, -0.05, -0.3], [1.0, -0.24, -0.9], [0.62, -0.3, -1.3]]) p(DG.spike, spikeMat, [0, y, z], [1, 1, 0.6], [rx, 0, 0]);
      p(DG.dinoTail, body, [0, 0.2, -0.4], [1, 1, 1], [-1.9, 0, 0]);
    } else if (shape === 'unicorn') {
      // 금색 뿔 + 파스텔 갈기·꼬리
      p(DG.horn, goldToon(), [0, 1.17, 0.12], [1, 1, 1], [0.35, 0, 0]);
      const manes = [toon(0xff9fcf), toon(0x9fd8ff), toon(0xffe08a)];
      for (const [i, [y, z]] of [[1.06, -0.12], [0.92, -0.28], [0.72, -0.33]].entries()) p(S, manes[i], [0, y, z], [0.12, 0.12, 0.12]);
      p(S, manes[0], [0, 0.3, -0.36], [0.1, 0.1, 0.22]);
    }
    eyes(eyeY, eyeZ, 0.13, 0.22, 0.255);
    // 머리에 붙은 부품(0.55 위)을 새 머리 높이로 내린다 — 꼬리처럼 원점에 붙은 것은 그대로
    for (const o of g.children) if (o.position.y >= 0.55) o.position.y -= HEAD_DROP;
  }
  if (gold) {
    // 진짜 금으로 만든 인형: 눈·코(먹색)·볼터치 말고는 온몸이 매끈한 금
    const metal = goldMaterial();
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material !== outlineMat && m.material !== INK && m.material !== white && !o.name.startsWith('face-')) m.material = metal;
    });
  }
  if (look.rare) {
    // 희귀: 작은 왕관 + 효과 색 반짝이 / 황금: 큰 왕관 + 금빛 반짝이 더 많이
    const crown = new THREE.Group();
    crown.name = 'crown';
    crown.position.set(0, sd.round ? 1.04 : 1.12 - HEAD_DROP, 0.04); crown.rotation.x = -0.12;
    const crownMat = gold ? goldMaterial() : goldToon();
    crown.add(part(DG.crownBand, crownMat));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      crown.add(part(DG.crownTip, crownMat, [Math.sin(a) * 0.13, 0.08, Math.cos(a) * 0.13]));
    }
    crown.add(part(S, toon(0xff5fa2), [0, 0.02, 0.155], [0.03, 0.03, 0.02], [0, 0, 0], 0));
    crown.scale.setScalar(gold ? CROWN_GOLD : 1);
    g.add(crown);
    if (!lite) {
      const aura = new THREE.Group(); aura.position.y = 0.7; aura.name = 'aura';
      const n = gold ? 11 : 7, radius = gold ? 0.7 : 0.62, mat = sparkMaterial(look.rare);
      for (let i = 0; i < n; i++) {
        const s = new THREE.Mesh(DG.spark, mat);
        const a = (i / n) * Math.PI * 2;
        s.position.set(Math.cos(a) * radius, Math.sin(a * 2) * 0.25, Math.sin(a) * radius);
        if (gold) s.scale.setScalar(1.4);
        aura.add(s);
      }
      g.add(aura);
      g.userData.spin.push({ obj: aura, speed: gold ? 2.2 : 1.6 });
    }
  }
  return g;
}

// ---- 집게가 닿는 공 (인형 모양 좌표, 크기 1) ----
// 단단한 공(solid): 몸통·머리·주둥이(서 있는 형) 또는 몸통(동글이형) + 머리 위로 솟은 부품(뿔·가시·물줄기 등)을 모델에서 모은 공 + 희귀 왕관.
// 말랑한 귀(ears)는 집게에 닿으면 휘므로(world/softEars.ts) 따로 둔다. 꼬리·반짝이·외곽선은 뺀다
export type Hit = { c: THREE.Vector3; r: number; part?: 'crown' };
// 체형만큼 옆으로 넓거나 좁게(공의 x·z·반지름 × BODY_W), 희귀·황금은 왕관 공을 더한다
const hitsCache = new Map<string, { solid: Hit[]; ears: Hit[] }>();
export function dollHits(id: string, body: Body = 'n', rare = ''): { solid: Hit[]; ears: Hit[] } {
  const key = `${id}|${body}|${rare}`, known = hitsCache.get(key);
  if (known) return known;
  const shape = id, round = isRoundDoll(id);
  const hit = (x: number, y: number, z: number, r: number): Hit => ({ c: new THREE.Vector3(x, y, z), r });
  // 동글이형 몸통 타원체(0.45, 0.52, 0.43)는 가운데 공 + 조금 위 공 두 개로 감싼다 — 옆은 몸통 폭, 꼭대기는 몸통 꼭대기(1.02)에 맞게
  const solid: Hit[] = round
    ? (shape === 'octopus' ? [hit(0, 0.62, 0, 0.42), hit(0, 0.66, 0, 0.41)] : [hit(0, 0.5, 0, 0.45), hit(0, 0.6, 0, 0.42)])
    : [hit(0, 0.3, 0, 0.29), hit(0, HEAD.standing.c, 0, 0.34), hit(0, 0.66, 0.29, 0.1)];
  const top = Math.max(...solid.map((h) => h.c.y + h.r));
  const ears: Hit[] = [];
  const doll = makeDoll(id);
  if (doll) {
    doll.updateMatrixWorld(true);
    const box = new THREE.Box3(), size = new THREE.Vector3(), mid = new THREE.Vector3();
    // 외곽선(자식, 1.06배)을 빼고 메시 자체 도형으로만 잰다 — 외곽선까지 재면 몸통이 '솟은 부품'으로 잡혀 큰 공이 생긴다
    const walk = (o: THREE.Object3D) => {
      if (o.name === 'ear') { ears.push({ c: o.userData.ear.c.clone(), r: o.userData.ear.r }); return; }
      if (o.name === 'tail' || o.name === 'crown' || o.name === 'aura') return;
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material !== outlineMat) {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        box.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld);
        // 머리 위로 솟은 부품(뿔·가시·깃털·물줄기): 부품 폭만 한 공을 부품 꼭대기에 닿게 놓는다
        if (box.max.y > top + 0.02) {
          box.getCenter(mid); box.getSize(size);
          const r = Math.max(size.x, size.z) / 2;
          solid.push(hit(mid.x, Math.max(mid.y, box.max.y - r), mid.z, r));
        }
      }
      o.children.forEach(walk);
    };
    walk(doll);
  }
  if (rare) {
    const k = rare === GOLD.id ? CROWN_GOLD : 1;
    solid.push({ ...hit(0, top + 0.06 * k, 0.04, 0.15 * k), part: 'crown' });
  }
  const w = BODY_W[body];
  const widen = (h: Hit): Hit => ({ ...h, c: new THREE.Vector3(h.c.x * w, h.c.y, h.c.z * w), r: h.r * w });
  const hits = { solid: solid.map(widen), ears: ears.map(widen) };
  hitsCache.set(key, hits);
  return hits;
}
