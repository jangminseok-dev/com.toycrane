import * as THREE from 'three';
import { makeLabel } from './label';
import { SPH, cap, part, toon } from './toon';

// 서버가 정한 색 번호 0~7 순서 (server/src/toycrane/dependencies/guest_provider.py AVATAR_COLORS = 8)
export const AVATAR_COLORS = [0xff7ab6, 0x8fe3c8, 0x8fd3ff, 0xffe08a, 0xb48cff, 0xff9f43, 0x6c5ce7, 0x3fcf9f];
const HAIRS = [0x5a3a2e, 0x2b1d3f, 0x8a5a3c, 0xe8c07a, 0x3b2a5a, 0xc2410c, 0x5a3a2e, 0x2b1d3f];
const BAGS = [0x8fd3ff, 0xffd36b, 0xff7ab6, 0x8fe3c8, 0xffd36b, 0xb48cff, 0xff7ab6, 0x8fd3ff];

export interface Avatar {
  root: THREE.Group;
  setWalking(on: boolean): void;
  update(t: number): void;
}

const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
const hairGeo = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);

// 손이 몸에서 떠 있는 동글이 캐릭터 (시제품 docs/reference/prototypes/spike-arcade-big-v3.html makeAvatar)
export function makeAvatar(color: number, nickname: string): Avatar {
  const i = ((color % AVATAR_COLORS.length) + AVATAR_COLORS.length) % AVATAR_COLORS.length;
  const root = new THREE.Group();
  const bob = new THREE.Group(); root.add(bob);
  const skin = toon(0xffe0c8);
  bob.add(part(SPH, toon(AVATAR_COLORS[i]), [0, 0.62, 0], [0.36, 0.42, 0.32]));
  const head = new THREE.Group(); head.position.set(0, 1.42, 0); bob.add(head);
  head.add(part(SPH, skin, [0, 0, 0], [0.52, 0.48, 0.48]));
  head.add(part(hairGeo, toon(HAIRS[i]), [0, 0.03, -0.03], [0.55, 0.52, 0.52], [-0.45, 0, 0], 1.04));
  for (const s of [-1, 1]) {
    head.add(part(cap(0.045, 0.06), toon(0x2b1d3f), [s * 0.17, -0.02, 0.45], [1, 1, 0.5], [0, 0, 0], 0));
    head.add(part(SPH, white, [s * 0.17 + 0.015, 0.03, 0.47], [0.016, 0.016, 0.01], [0, 0, 0], 0));
    head.add(part(SPH, toon(0xff9ec4), [s * 0.3, -0.12, 0.365], [0.07, 0.04, 0.02], [0, 0, 0], 0));
  }
  head.add(part(SPH, toon(0x7a3b4f), [0, -0.16, 0.44], [0.04, 0.025, 0.02], [0, 0, 0], 0));
  const backpack = new THREE.Group(); backpack.position.set(0, 0.72, -0.34); bob.add(backpack);
  backpack.add(part(SPH, toon(BAGS[i]), [0, 0, 0], [0.3, 0.34, 0.17]));
  backpack.add(part(SPH, toon(0xffffff), [0, 0.13, -0.05], [0.24, 0.12, 0.14]));
  const feet = [-1, 1].map((s) => part(SPH, toon(0x4a3b7a), [s * 0.16, 0.08, 0.06], [0.13, 0.09, 0.17]));
  root.add(...feet);
  const hands = [-1, 1].map(() => part(SPH, skin, [0, 0, 0], [0.13, 0.13, 0.13]));
  root.add(...hands);
  const label = makeLabel(nickname); label.position.set(0, 2.25, 0); root.add(label);
  root.scale.setScalar(0.85);

  const phase = Math.random() * 6;
  let walking = false;
  return {
    root,
    setWalking(on) { walking = on; },
    update(t) {
      const s = Math.sin(t * 2.4 + phase);
      if (walking) {
        const w = t * 9 + phase;
        bob.position.y = Math.abs(Math.sin(w)) * 0.07;
        hands.forEach((h, k) => h.position.set(k ? 0.52 : -0.52, 0.66, 0.1 + Math.sin(w + k * Math.PI) * 0.18));
        feet.forEach((f, k) => { f.position.z = 0.06 + Math.sin(w + k * Math.PI) * 0.12; });
      } else {
        bob.position.y = 0;
        bob.scale.set(1 - s * 0.01, 1 + s * 0.015, 1 - s * 0.01);
        hands.forEach((h, k) => h.position.set(k ? 0.52 : -0.52, 0.66 + Math.sin(t * 2.4 + phase + 0.8 + k * 0.6) * 0.025, 0.1));
        feet.forEach((f) => { f.position.z = 0.06; });
      }
    },
  };
}
