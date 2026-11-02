import * as THREE from 'three';
import { disposeLabel, makeLabel } from './label';
import { bakeByMaterial } from './bake';
import { SPH, cap, part, toon } from './toon';

// 서버가 정한 색 번호 0~7 순서 (server/src/toycrane/dependencies/guest_provider.py AVATAR_COLORS = 8)
export const AVATAR_COLORS = [0xff7ab6, 0x8fe3c8, 0x8fd3ff, 0xffe08a, 0xb48cff, 0xff9f43, 0x6c5ce7, 0x3fcf9f];
const HAIRS = [0x5a3a2e, 0x2b1d3f, 0x8a5a3c, 0xe8c07a, 0x3b2a5a, 0xc2410c, 0x5a3a2e, 0x2b1d3f];
const BAGS = [0x8fd3ff, 0xffd36b, 0xff7ab6, 0x8fe3c8, 0xffd36b, 0xb48cff, 0xff7ab6, 0x8fd3ff];

// 모션(world/motions.ts)이 움직이는 손잡이. 손 목표는 아바타 기준 좌표, 걷지 않을 때 손이 따라간다
export interface AvatarRig {
  root: THREE.Group;
  bob: THREE.Group;
  head: THREE.Group;
  backpack: THREE.Group;
  handL: THREE.Vector3;
  handR: THREE.Vector3;
  crouch: number;
  held: THREE.Object3D | null; // 손에 든 것 (root의 자식)
  holdMode: 'none' | 'right' | 'both' | 'free'; // free = 모션이 직접 움직임
}
export const REST_L = new THREE.Vector3(-0.52, 0.66, 0.1), REST_R = new THREE.Vector3(0.52, 0.66, 0.1);

export interface Avatar {
  root: THREE.Group;
  rig: AvatarRig;
  setWalking(on: boolean): void;
  update(t: number): void;
  dispose(): void; // 장면에서 뺄 때 이 아바타만의 GPU 자원(이름표) 해제
  setTag(text: string | null): void; // 이름표 아래 작은 꼬리표 ('조르는 중'), null이면 뗀다
  setFade(opacity: number): void; // 한 판 중 내 화면을 가릴 때 흐리게, 0이면 숨김 (1이면 원래대로)
}

const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
const hairGeo = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
const SPH_LO = new THREE.SphereGeometry(1, 14, 10); // 작은 부분(눈·반짝임·볼·앞머리) — 면을 낮춰 한 명의 삼각형을 예전 안으로
const SPH_MID = new THREE.SphereGeometry(1, 20, 14); // 손·발
const SMILE = new THREE.TorusGeometry(0.055, 0.014, 6, 14, Math.PI); // 웃는 입(위 반원을 뒤집어 U)
const SKIN = 0xffe0c8;

// 머리·몸통의 움직이지 않는 부분은 재질별로 한 덩어리로 굽고 색 번호마다 한 번만 만들어 나눠 쓴다 —
// 디테일(앞머리·귀·눈 반짝임·눈썹·입·볼)이 늘어도 한 명의 그리기 호출이 늘지 않게
type Baked = { geometry: THREE.BufferGeometry; material: THREE.Material }[];
const bakedHeads = new Map<number, Baked>(), bakedBodies = new Map<number, Baked>(), bakedBags = new Map<number, Baked>();
const bake = (g: THREE.Group): Baked => bakeByMaterial(g).map((m) => ({ geometry: m.geometry, material: m.material as THREE.Material }));
const meshesOf = (b: Baked) => b.map(({ geometry, material }) => { const m = new THREE.Mesh(geometry, material); m.castShadow = true; return m; });

// 카툰 얼굴(사용자 2026-11-02 사진 214 '더 귀엽게'): 큰 둥근 얼굴, 큰 눈에 반짝임 둘, 눈썹, 웃는 입, 볼터치, 귀, 앞머리 —
// 색 번호마다 머리 모양: 0 단발(옆머리), 1 양갈래 똥머리, 2 포니테일(머리끈), 3 바보털
function headParts(i: number): THREE.Group {
  const g = new THREE.Group(), skin = toon(SKIN), hair = toon(HAIRS[i]), dark = toon(0x2b1d3f), pink = toon(0xff9ec4);
  g.add(part(SPH, skin, [0, 0, 0], [0.56, 0.5, 0.5]));
  for (const s of [-1, 1]) g.add(part(SPH_LO, skin, [s * 0.53, -0.03, 0.02], [0.08, 0.1, 0.07], [0, 0, 0], 1.08)); // 귀
  g.add(part(hairGeo, hair, [0, 0.04, -0.04], [0.6, 0.55, 0.55], [-0.5, 0, 0], 1.04)); // 뒤통수
  for (const [x, ry] of [[-0.22, 0.35], [0, 0], [0.22, -0.35]]) g.add(part(SPH_LO, hair, [x, 0.27, 0.33], [0.2, 0.14, 0.13], [0.4, ry, 0], 1.05)); // 앞머리
  const style = i % 4;
  if (style === 0) for (const s of [-1, 1]) g.add(part(SPH_LO, hair, [s * 0.5, -0.06, 0.08], [0.13, 0.26, 0.17], [0, 0, s * 0.1], 1.05));
  if (style === 1) for (const s of [-1, 1]) g.add(part(SPH_LO, hair, [s * 0.36, 0.42, -0.06], [0.17, 0.17, 0.17], [0, 0, 0], 1.06));
  if (style === 2) {
    g.add(part(SPH_LO, hair, [0, 0.1, -0.6], [0.17, 0.28, 0.17], [-0.4, 0, 0], 1.05));
    g.add(part(SPH_LO, pink, [0, 0.26, -0.52], [0.07, 0.07, 0.07], [0, 0, 0], 1.1)); // 머리끈
  }
  if (style === 3) g.add(part(cap(0.03, 0.14), hair, [0.04, 0.6, 0.02], [1, 1, 1], [0, 0, -0.5], 1.1));
  for (const s of [-1, 1]) {
    g.add(part(SPH_LO, dark, [s * 0.18, -0.02, 0.455], [0.07, 0.095, 0.035], [0, 0, 0], 0)); // 큰 눈
    g.add(part(SPH_LO, white, [s * 0.18 + 0.025, 0.03, 0.492], [0.026, 0.03, 0.012], [0, 0, 0], 0)); // 큰 반짝임
    g.add(part(SPH_LO, white, [s * 0.18 - 0.02, -0.05, 0.494], [0.013, 0.013, 0.008], [0, 0, 0], 0)); // 작은 반짝임
    g.add(part(cap(0.013, 0.07), dark, [s * 0.19, 0.14, 0.452], [1, 1, 1], [0, 0, Math.PI / 2 + s * 0.2], 0)); // 눈썹
    g.add(part(SPH_LO, pink, [s * 0.31, -0.13, 0.385], [0.085, 0.05, 0.03], [0, 0, 0], 0)); // 볼터치
  }
  g.add(part(SMILE, toon(0x7a3b4f), [0, -0.14, 0.475], [1, 1, 1], [0, 0, Math.PI], 0)); // 웃는 입
  return g;
}
// 몸통: 원색 몸 + 흰 깃 + 노란 배지
function bodyParts(i: number): THREE.Group {
  const g = new THREE.Group();
  g.add(part(SPH, toon(AVATAR_COLORS[i]), [0, 0.62, 0], [0.36, 0.42, 0.32]));
  g.add(part(SPH_LO, white, [0, 0.98, 0.02], [0.25, 0.07, 0.23], [0, 0, 0], 1.05));
  g.add(part(SPH_LO, toon(0xffd36b), [0.13, 0.76, 0.3], [0.055, 0.055, 0.02], [0, 0, 0], 0));
  return g;
}
function bagParts(i: number): THREE.Group {
  const g = new THREE.Group();
  g.add(part(SPH, toon(BAGS[i]), [0, 0, 0], [0.3, 0.34, 0.17]));
  g.add(part(SPH, toon(0xffffff), [0, 0.13, -0.05], [0.24, 0.12, 0.14]));
  return g;
}
const cached = (map: Map<number, Baked>, i: number, make: (i: number) => THREE.Group) => map.get(i) ?? map.set(i, bake(make(i))).get(i)!;

// 손이 몸에서 떠 있는 동글이 캐릭터 (시제품 docs/reference/prototypes/spike-arcade-big-v3.html makeAvatar)
export function makeAvatar(color: number, nickname: string): Avatar {
  const i = ((color % AVATAR_COLORS.length) + AVATAR_COLORS.length) % AVATAR_COLORS.length;
  const root = new THREE.Group();
  const bob = new THREE.Group(); root.add(bob);
  const skin = toon(SKIN);
  bob.add(...meshesOf(cached(bakedBodies, i, bodyParts)));
  const head = new THREE.Group(); head.position.set(0, 1.42, 0); bob.add(head);
  head.add(...meshesOf(cached(bakedHeads, i, headParts)));
  const backpack = new THREE.Group(); backpack.position.set(0, 0.72, -0.34); bob.add(backpack);
  backpack.add(...meshesOf(cached(bakedBags, i, bagParts)));
  const feet = [-1, 1].map((s) => part(SPH_MID, toon(0x4a3b7a), [s * 0.16, 0.08, 0.06], [0.13, 0.09, 0.17]));
  root.add(...feet);
  const hands = [-1, 1].map(() => part(SPH_MID, skin, [0, 0, 0], [0.13, 0.13, 0.13]));
  root.add(...hands);
  const label = makeLabel(nickname); label.position.set(0, 2.25, 0); root.add(label);
  let tag: THREE.Sprite | null = null;
  // 흐릴 때만 이 아바타 재질을 복제해 쓴다 (툰 재질은 모두가 함께 쓰므로 원본을 흐리면 다른 사람도 흐려진다)
  let faded: { originals: Map<THREE.Mesh, THREE.Material>; clones: Map<THREE.Material, THREE.Material> } | null = null;
  root.scale.setScalar(0.85);

  const phase = Math.random() * 6;
  let walking = false;
  const rig: AvatarRig = { root, bob, head, backpack, handL: REST_L.clone(), handR: REST_R.clone(), crouch: 0, held: null, holdMode: 'none' };
  const mid = new THREE.Vector3();
  return {
    root,
    rig,
    dispose() { disposeLabel(label); if (tag) disposeLabel(tag); faded?.clones.forEach((m) => m.dispose()); },
    setFade(opacity) {
      root.visible = opacity > 0; // 다 흐려지면 숨긴다 — 투명 부품이 겹쳐 쌓이지 않게
      if (opacity >= 1) {
        if (faded) for (const [m, mat] of faded.originals) m.material = mat;
        label.material.opacity = 1; if (tag) tag.material.opacity = 1;
        if (faded) faded.originals.clear();
        return;
      }
      faded ??= { originals: new Map(), clones: new Map() };
      const f = faded;
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (!f.originals.has(m)) {
          const mat = m.material as THREE.Material;
          let clone = f.clones.get(mat);
          if (!clone) { clone = mat.clone(); clone.transparent = true; clone.depthWrite = false; f.clones.set(mat, clone); }
          f.originals.set(m, mat); m.material = clone;
        }
        (m.material as THREE.Material).opacity = opacity;
      });
      label.material.opacity = opacity; if (tag) tag.material.opacity = opacity;
    },
    setTag(text) {
      if (tag) { root.remove(tag); disposeLabel(tag); tag = null; }
      if (!text) return;
      tag = makeLabel(text); tag.name = 'tag'; tag.position.set(0, 1.98, 0); tag.scale.set(0.8, 0.2, 1);
      root.add(tag);
    },
    setWalking(on) { walking = on; },
    update(t) {
      const s = Math.sin(t * 2.4 + phase);
      if (walking) {
        const w = t * 9 + phase;
        bob.position.y = Math.abs(Math.sin(w)) * 0.07;
        hands.forEach((h, k) => h.position.set(k ? 0.52 : -0.52, 0.66, 0.1 + Math.sin(w + k * Math.PI) * 0.18));
        feet.forEach((f, k) => { f.position.z = 0.06 + Math.sin(w + k * Math.PI) * 0.12; });
      } else {
        bob.position.y = -rig.crouch;
        bob.scale.set(1 - s * 0.01, 1 + s * 0.015, 1 - s * 0.01);
        hands.forEach((h, k) => {
          const base = k ? rig.handR : rig.handL;
          h.position.set(base.x, base.y + Math.sin(t * 2.4 + phase + 0.8 + k * 0.6) * 0.025, base.z);
        });
        feet.forEach((f) => { f.position.z = 0.06; });
      }
      // 든 것은 손을 따라간다 (오른손 앞 / 두 손 가운데)
      if (rig.held && rig.holdMode === 'right') rig.held.position.copy(hands[1].position).add(mid.set(0, 0.05, 0.12));
      else if (rig.held && rig.holdMode === 'both') rig.held.position.copy(hands[0].position).add(hands[1].position).multiplyScalar(0.5).add(mid.set(0, -0.12, 0.05));
    },
  };
}
