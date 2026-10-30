import * as THREE from 'three';
import { DOLLS } from '../data/catalog';
import { GOLD, rareMat, squirrelMat, squirrelTail } from './dollTextures';
import { CAP_LO, SPH, SPH_LO, cap, outlineMat, part, toon } from './toon';

// 인형 28종 (전부 오리지널). 시제품 docs/reference/prototypes/spike-arcade-big-v3.html makeDoll(338~535행)을 옮김.
// 이름·세트·희귀는 shared/catalog.json, 여기엔 생김새만 둔다.
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
};
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffe27a });

type V3 = [number, number, number];

// lite = 기계 속 무더기용: 면 수를 낮추고 볼터치·눈 반짝이·팔다리 같은 잔부품은 뺀다.
// 목록에 없는 id는 null (배포로 목록이 바뀐 뒤 저장된 배치에 남은 인형). 희귀 반짝이는 userData.spin으로 돌릴 것을 알려 준다.
export function makeDoll(id: string, lite = false): THREE.Group | null {
  const info = DOLLS[id];
  if (!info) return null;
  const shape = info.base ?? id, sd = LOOKS[shape], S = lite ? SPH_LO : SPH;
  if (!sd) return null;
  const body = info.base ? rareMat[id]() : shape === 'squirrel' ? squirrelMat() : toon(sd.color);
  const g = new THREE.Group();
  g.userData.spin = [];
  const OL = lite ? 0 : 1.06; // 잔부품 외곽선
  const p = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, scl: V3 = [1, 1, 1], rot: V3 = [0, 0, 0], ol = 1.06) => {
    const m = part(geo, mat, pos, scl, rot, ol); g.add(m); return m;
  };
  const pointed = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, dir: THREE.Vector3, scl: V3, ol = OL) => {
    const m = p(geo, mat, pos, scl, [0, 0, 0], ol); m.quaternion.setFromUnitVectors(UP, dir.normalize()); return m;
  };
  const eyes = (y: number, z: number, dx: number, bx: number, bz: number) => {
    for (const s of [-1, 1]) {
      p(S, INK, [s * dx, y, z], [0.045, 0.055, 0.03], [0, 0, 0], 0);
      if (lite) continue;
      p(S, white, [s * dx + 0.013, y + 0.022, z + 0.022], [0.014, 0.014, 0.01], [0, 0, 0], 0);
      p(S, BLUSH, [s * bx, y - 0.07, bz], [0.05, 0.03, 0.02], [0, 0, 0], 0);
    }
  };
  const nose = (y: number, z: number, mat: THREE.Material = INK) => p(S, mat, [0, y, z], [0.05, 0.035, 0.035], [0, 0, 0], 0);

  if (sd.round) {
    // 동글이형: 몸통 하나 (문어는 머리를 띄우고 다리 6개)
    if (shape === 'octopus') {
      p(S, body, [0, 0.62, 0], [0.42, 0.45, 0.4]);
      const n = lite ? 4 : 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.PI / 6, dx = Math.sin(a), dz = Math.cos(a);
        pointed(lite ? CAP_LO : DG.tentacle, body, [dx * 0.26, 0.14, dz * 0.26], new THREE.Vector3(dx, -0.35, dz), [1, 1, 1], 1.06);
      }
      eyes(0.66, 0.37, 0.15, 0.25, 0.33);
    } else {
      p(S, body, [0, 0.5, 0], [0.45, 0.52, 0.43]);
      if (!lite) for (const s of [-1, 1]) {
        if (sd.wings) p(S, body, [s * 0.43, 0.45, 0.02], [0.1, 0.18, 0.12], [0, 0, -s * 0.5]);
        if (sd.feet) p(S, sd.feet === 'orange' ? ORANGE : body, [s * 0.16, 0.04, 0.14], [0.11, 0.06, 0.14]);
      }
      if (shape === 'chick') {
        p(DG.beak, ORANGE, [0, 0.6, 0.46], [1, 1, 1], [Math.PI / 2, 0, 0], OL);
        if (!lite) for (const dx of [-0.06, 0, 0.06]) p(S, body, [dx, 1.04, -0.02], [0.035, 0.1, 0.035], [0, 0, dx * 5]);
        eyes(0.74, 0.35, 0.15, 0.25, 0.32);
      } else if (shape === 'penguin') {
        p(S, PURE, [0, 0.45, 0.14], [0.34, 0.4, 0.32], [0, 0, 0], 0);
        p(DG.beak, ORANGE, [0, 0.62, 0.46], [1, 0.8, 1], [Math.PI / 2, 0, 0], OL);
        eyes(0.76, 0.37, 0.14, 0.25, 0.33);
      } else if (shape === 'frog') {
        for (const s of [-1, 1]) p(S, body, [s * 0.2, 0.95, 0.12], [0.15, 0.13, 0.15]);
        eyes(0.98, 0.26, 0.2, 0.3, 0.3);
        p(S, BLUSH, [0, 0.58, 0.42], [0.2, 0.03, 0.03], [0, 0, 0], 0);
      } else if (shape === 'owl') {
        p(S, toon(0xd9c2a0), [0, 0.42, 0.18], [0.3, 0.32, 0.28], [0, 0, 0], 0);
        for (const s of [-1, 1]) {
          p(S, PURE, [s * 0.17, 0.72, 0.33], [0.15, 0.15, 0.07], [0, 0, 0], OL);
          p(DG.smallEar, body, [s * 0.24, 1.0, 0], [1, 1, 0.7], [0, 0, -s * 0.35]);
        }
        p(DG.beak, ORANGE, [0, 0.6, 0.41], [0.6, 0.6, 0.6], [Math.PI, 0, 0], 0);
        eyes(0.72, 0.4, 0.17, 0.3, 0.33);
      } else if (shape === 'duck') {
        p(S, ORANGE, [0, 0.6, 0.44], [0.17, 0.05, 0.12], [0, 0, 0], OL);
        if (!lite) p(S, body, [0, 1.04, -0.02], [0.04, 0.09, 0.04]);
        eyes(0.76, 0.36, 0.15, 0.25, 0.32);
      } else if (shape === 'seal') {
        for (const s of [-1, 1]) p(S, PURE, [s * 0.065, 0.6, 0.39], [0.08, 0.065, 0.06], [0, 0, 0], 0);
        nose(0.66, 0.44);
        eyes(0.76, 0.36, 0.17, 0.27, 0.32);
      } else if (shape === 'whale') {
        p(S, toon(0xcfe8ff), [0, 0.4, 0.16], [0.34, 0.3, 0.3], [0, 0, 0], 0);
        for (const s of [-1, 1]) p(S, body, [s * 0.13, 0.95, -0.36], [0.14, 0.05, 0.09], [0, 0, s * 0.4]);
        if (!lite) for (const [x, y] of [[0, 1.1], [-0.07, 1.19], [0.07, 1.19]]) p(S, toon(0x9fe0ff), [x, y, 0.05], [0.04, 0.05, 0.04], [0, 0, 0], 0);
        eyes(0.7, 0.38, 0.17, 0.27, 0.34);
      }
    }
  } else {
    // 서 있는 형: 몸통 + 머리 + 팔다리
    const limb = shape === 'panda' ? INK : body;
    p(S, body, [0, 0.32, 0], [0.33, 0.3, 0.3]);
    p(S, body, [0, 0.8, 0], [0.38, 0.34, 0.34]);
    if (!lite) for (const s of [-1, 1]) {
      p(S, limb, shape === 'squirrel' ? [s * 0.14, 0.44, 0.25] : [s * 0.31, 0.36, 0.06], [0.1, 0.1, 0.1]);
      p(S, limb, [s * 0.15, 0.06, 0.12], [0.12, 0.08, 0.14]);
    }
    const muzzle = (mat: THREE.Material) => { p(S, mat, [0, 0.72, 0.27], [0.15, 0.11, 0.09]); nose(0.76, 0.35); };
    let eyeZ = 0.305, eyeY = 0.83;
    for (const s of [-1, 1]) {
      if (shape === 'bunny') {
        const ear = p(lite ? CAP_LO : DG.bunnyEar, body, [s * 0.14, 1.27, -0.02], [1, 1, 1], [0, 0, -s * 0.18]);
        if (!lite) ear.add(part(DG.bunnyInner, toon(0xffb3cf), [0, 0, 0.06], [1, 1, 0.5], [0, 0, 0], 0));
      } else if (shape === 'bear' || shape === 'panda') p(S, shape === 'panda' ? INK : body, [s * 0.27, 1.07, -0.02], [0.12, 0.12, 0.08]);
      else if (shape === 'raccoon') p(S, toon(0x5a4a58), [s * 0.27, 1.05, -0.02], [0.11, 0.11, 0.07]);
      else if (shape === 'cat') p(DG.catEar, body, [s * 0.22, 1.1, 0], [1, 1, 0.6], [0, 0, -s * 0.35]);
      else if (shape === 'fox') p(DG.foxEar, body, [s * 0.21, 1.13, 0], [1, 1, 0.55], [0, 0, -s * 0.3]);
      else if (shape === 'squirrel') p(DG.foxEar, toon(sd.color), [s * 0.19, 1.13, -0.02], [0.72, 0.85, 0.5], [0, 0, -s * 0.25]);
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
      if (!lite) for (const s of [-1, 1]) p(S, INK, [s * 0.04, 0.74, 0.365], [0.02, 0.03, 0.01], [0, 0, 0], 0);
    } else if (shape === 'fox') {
      p(S, PURE, [0, 0.72, 0.24], [0.26, 0.13, 0.12], [0, 0, 0], 0);
      p(S, INK, [0, 0.75, 0.355], [0.04, 0.03, 0.03], [0, 0, 0], 0);
      p(S, body, [0, 0.32, -0.36], [0.14, 0.14, 0.28]);
      if (!lite) p(S, PURE, [0, 0.32, -0.6], [0.08, 0.08, 0.08]);
    } else if (shape === 'cat' || shape === 'hamster') {
      p(S, BLUSH, [0, 0.75, 0.34], [0.035, 0.025, 0.02], [0, 0, 0], 0);
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
      const tail = new THREE.Mesh(lite ? tails.lo : tails.hi, toon(0xb87a48));
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
      if (!lite) for (const s of [-1, 1]) p(S, INK, [s * 0.07, 0.71, 0.355], [0.02, 0.03, 0.01], [0, 0, 0], 0);
      for (const s of [-1, 1]) p(DG.smallEar, CREAM, [s * 0.17, 1.12, 0], [0.7, 0.9, 0.7], [0, 0, -s * 0.5]);
    } else if (shape === 'dino') {
      const spikeMat = info.base ? GOLD() : toon(0xffb84d);
      for (const [y, z, rx] of [[1.15, -0.05, -0.3], [1.0, -0.24, -0.9], [0.62, -0.3, -1.3]]) p(DG.spike, spikeMat, [0, y, z], [1, 1, 0.6], [rx, 0, 0]);
      p(DG.dinoTail, body, [0, 0.2, -0.4], [1, 1, 1], [-1.9, 0, 0]);
    } else if (shape === 'unicorn') {
      // 금색 뿔 + 파스텔 갈기·꼬리
      p(DG.horn, GOLD(), [0, 1.17, 0.12], [1, 1, 1], [0.35, 0, 0]);
      const manes = [toon(0xff9fcf), toon(0x9fd8ff), toon(0xffe08a)];
      for (const [i, [y, z]] of [[1.06, -0.12], [0.92, -0.28], [0.72, -0.33]].entries()) p(S, manes[i], [0, y, z], [0.12, 0.12, 0.12]);
      p(S, manes[0], [0, 0.3, -0.36], [0.1, 0.1, 0.22]);
    }
    eyes(eyeY, eyeZ, 0.13, 0.22, 0.255);
  }
  if (info.base) {
    // 희귀: 왕관 + 반짝이
    const crown = new THREE.Group();
    crown.name = 'crown';
    crown.position.set(0, sd.round ? 1.04 : 1.12, 0.04); crown.rotation.x = -0.12;
    crown.add(part(DG.crownBand, GOLD()));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      crown.add(part(DG.crownTip, GOLD(), [Math.sin(a) * 0.13, 0.08, Math.cos(a) * 0.13]));
    }
    crown.add(part(S, toon(0xff5fa2), [0, 0.02, 0.155], [0.03, 0.03, 0.02], [0, 0, 0], 0));
    g.add(crown);
    if (!lite) {
      const aura = new THREE.Group(); aura.position.y = 0.7;
      for (let i = 0; i < 7; i++) {
        const s = new THREE.Mesh(DG.spark, sparkMat);
        const a = (i / 7) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.62, Math.sin(a * 2) * 0.25, Math.sin(a) * 0.62);
        aura.add(s);
      }
      g.add(aura);
      g.userData.spin.push({ obj: aura, speed: 1.6 });
    }
  }
  return g;
}
