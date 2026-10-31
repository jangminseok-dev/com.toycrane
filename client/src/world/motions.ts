import * as THREE from 'three';
import { Tweens, ease } from '../game/tween';
import { REST_L, REST_R, type AvatarRig } from './avatar';
import { makeCloud } from './effects';

// 기계 앞 모션 8종 (설계 §5.5, 시제품 spike-arcade-big-v3.html play() 1100~1185행):
// 코인 넣기 · 조이스틱 · 내리기 쾅 · 두근두근 / 꺼내기 · 번쩍 들기 · 가방에 쏙 · 털썩
// 자세 값은 시제품 P 표(아바타 기준 좌표). face = 기계를 바라보는 방향(기계 ry + π)
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const P = {
  coinL: V(-0.42, 0.64, 0.66), joyR: V(0.25, 1.02, 0.56),
  btnUpL: V(-0.25, 1.4, 0.42), btnL: V(-0.25, 0.99, 0.56),
  chestL: V(-0.13, 0.8, 0.38), chestR: V(0.13, 0.8, 0.38),
  braceL: V(-0.45, 0.55, 0.3), reachR: V(0.36, 0.34, 0.68),
  holdL: V(-0.2, 0.86, 0.42), holdR: V(0.2, 0.86, 0.42),
  upL: V(-0.2, 2.25, 0.12), upR: V(0.2, 2.25, 0.12),
  shoulderR: V(0.22, 1.25, -0.42), bag: V(0, 0.85, -0.46),
  sadL: V(-0.42, 0.42, 0.06), sadR: V(0.42, 0.42, 0.06),
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type Outcome = 'win' | 'slip' | 'miss';
// 결과 연출에 필요한 바깥 일들(집게·소리·기계 반짝임·카메라)은 부르는 쪽이 정한다
export type ResultFx = {
  bonk(): void;
  claw(seconds: number): Promise<void>; // 집게가 내려갔다 올라오는 동안
  afterClaw(): void; // 집게가 올라온 뒤 (내 화면: 카메라를 돌리고 내 캐릭터를 다시 보임)
  pop(): void;
  win(): number; // 번쩍 든 순간의 축하(터짐·소리·반짝임·전광판·카드), 들고 있을 초를 돌려준다
  fail(): void;
};

export function resultSteps(o: Outcome): string[] {
  return o === 'win' ? ['bonk', 'nervous', 'takeout', 'show', 'lift', 'bag'] : ['bonk', 'nervous', 'slump'];
}

function pose(rig: AvatarRig, tw: Tweens, dur: number, toL: THREE.Vector3 | null, toR: THREE.Vector3 | null, extra?: (k: number) => void, e = ease.smooth) {
  const fl = rig.handL.clone(), fr = rig.handR.clone();
  return tw.tween(dur, (k) => {
    if (toL) rig.handL.lerpVectors(fl, toL, k);
    if (toR) rig.handR.lerpVectors(fr, toR, k);
    extra?.(k);
  }, e);
}

// 코인 넣기 → 조이스틱 흔들기를 stop()까지 되풀이 (stop은 지금 흔들기가 끝나면 풀린다)
export function startPlaying(rig: AvatarRig, tw: Tweens, face: number, coin?: () => void): { stop(): Promise<void> } {
  let stopped = false;
  rig.root.rotation.y = face;
  const run = (async () => {
    await pose(rig, tw, 0.3, P.coinL, null);
    coin?.();
    await pose(rig, tw, 0.25, REST_L, P.joyR);
    while (!stopped) {
      await tw.tween(0.37, (k) => {
        const w = Math.sin(k * Math.PI * 2);
        rig.handR.set(P.joyR.x + w * 0.06, P.joyR.y, P.joyR.z + Math.cos(k * Math.PI * 2) * 0.04);
        rig.bob.rotation.z = w * 0.1;
      }, ease.lin);
    }
    rig.bob.rotation.z = 0;
  })();
  return { stop: () => { stopped = true; return run; } };
}

export async function playResult(rig: AvatarRig, tw: Tweens, o: Outcome, doll: THREE.Group | null, fx: ResultFx, face: number): Promise<void> {
  const r = rig.root;
  r.rotation.y = face;
  // 내리기 쾅
  await pose(rig, tw, 0.22, P.btnUpL, REST_R, undefined, ease.out);
  await pose(rig, tw, 0.1, P.btnL, null, undefined, ease.in);
  fx.bonk();
  await tw.tween(0.18, (k) => { rig.crouch = Math.sin(k * Math.PI) * 0.06; });
  // 두근두근 (집게가 내려갔다 올라오는 동안)
  const claw = fx.claw(1.7);
  await pose(rig, tw, 0.3, P.chestL, P.chestR);
  await Promise.all([claw, tw.tween(1.4, (k) => { rig.bob.rotation.z = Math.sin(k * Math.PI * 6) * 0.07; }, ease.lin)]);
  rig.bob.rotation.z = 0;
  fx.afterClaw();

  if (o !== 'win' || !doll) {
    // 털썩: 돌아서서 어깨 축 + 먹구름
    await pose(rig, tw, 0.45, REST_L, REST_R, (k) => { r.rotation.y = lerp(face, face + Math.PI, k); });
    fx.fail();
    const cloud = makeCloud(); rig.head.add(cloud);
    const drops = cloud.userData.drops as THREE.Object3D[];
    await pose(rig, tw, 0.4, P.sadL, P.sadR, (k) => { rig.head.rotation.x = lerp(0, 0.35, k); rig.crouch = lerp(0, 0.06, k); });
    await tw.tween(1.3, (k) => { drops.forEach((d) => { d.position.y = -0.15 - ((k * 1.6 + d.userData.off) % 1) * 0.5; }); }, ease.lin);
    await pose(rig, tw, 0.35, REST_L, REST_R, (k) => { rig.head.rotation.x = lerp(0.35, 0, k); rig.crouch = lerp(0.06, 0, k); cloud.scale.setScalar(1 - k * 0.99); });
    rig.head.remove(cloud);
    return;
  }
  // 꺼내기: 몸을 굽혀 상품 출구에서 꺼낸다
  await pose(rig, tw, 0.4, P.braceL, P.reachR, (k) => { rig.crouch = lerp(0, 0.18, k); });
  doll.scale.setScalar(0.01); r.add(doll); rig.held = doll; rig.holdMode = 'right';
  fx.pop();
  await tw.tween(0.3, (k) => doll.scale.setScalar(lerp(0.01, 0.5, k)), ease.back);
  // 뒤돌아 두 손으로 보여 주기
  await pose(rig, tw, 0.45, P.holdL, P.holdR, (k) => {
    rig.crouch = lerp(0.18, 0, k); r.rotation.y = lerp(face, face + Math.PI, k); if (k > 0.5) rig.holdMode = 'both';
  });
  // 번쩍!
  await pose(rig, tw, 0.28, P.upL, P.upR, (k) => { r.position.y = Math.sin(k * Math.PI) * 0.24; doll.scale.setScalar(lerp(0.5, 0.65, k)); }, ease.out);
  r.position.y = 0;
  await tw.wait(fx.win());
  // 가방에 쏙: 등을 보이며 등 가방에 넣는다
  rig.holdMode = 'right';
  await pose(rig, tw, 0.4, REST_L, P.shoulderR, (k) => { r.rotation.y = lerp(face + Math.PI, face + Math.PI * 1.78, k); });
  rig.holdMode = 'free';
  const from = doll.position.clone(), s0 = doll.scale.x;
  await tw.tween(0.3, (k) => { doll.position.lerpVectors(from, P.bag, k); doll.scale.setScalar(lerp(s0, 0.001, k)); }, ease.in);
  r.remove(doll); rig.held = null; rig.holdMode = 'none';
  fx.pop();
  await tw.tween(0.3, (k) => { const s = Math.sin(k * Math.PI); rig.backpack.scale.set(1 + s * 0.25, 1 - s * 0.18, 1 + s * 0.25); });
  await pose(rig, tw, 0.4, REST_L, REST_R, (k) => { r.rotation.y = lerp(face + Math.PI * 1.78, face + Math.PI, k); });
}

// ---- 조르기·주기·기쁨·시무룩 (교환소 개편 설계 §4.8) — 끝나면 손·고개·웅크림이 쉬는 자리로 돌아온다 ----
const BEG_L = V(-0.1, 0.95, 0.4), BEG_R = V(0.1, 0.95, 0.4), GIVE_R = V(0.3, 0.9, 0.75);

async function settle(rig: AvatarRig, tw: Tweens, dur = 0.25) {
  const tilt = rig.head.rotation.z, nod = rig.head.rotation.x, crouch = rig.crouch;
  await pose(rig, tw, dur, REST_L, REST_R, (k) => {
    rig.head.rotation.z = lerp(tilt, 0, k); rig.head.rotation.x = lerp(nod, 0, k); rig.crouch = lerp(crouch, 0, k);
  });
  rig.head.rotation.set(0, 0, 0); rig.crouch = 0; rig.handL.copy(REST_L); rig.handR.copy(REST_R);
}

// 조르기: 두 손을 가슴 앞에 모으고 폴짝폴짝, 고개를 갸웃 — stop()까지 되풀이
export function startBegging(rig: AvatarRig, tw: Tweens): { stop(): Promise<void> } {
  let stopped = false;
  const run = (async () => {
    await pose(rig, tw, 0.2, BEG_L, BEG_R);
    for (let i = 0; !stopped; i++) {
      await tw.tween(0.5, (k) => {
        rig.crouch = -Math.sin(k * Math.PI) * 0.06; // 폴짝
        rig.head.rotation.z = (i % 2 ? -1 : 1) * Math.sin(k * Math.PI) * 0.22; // 갸웃
      }, ease.lin);
    }
    await settle(rig, tw);
  })();
  return { stop: () => { stopped = true; return run; } };
}

// 주기: 받는 사람 쪽(toward, 세계 방향)으로 몸을 돌려 오른손을 내밀었다 거둔다
export async function playGive(rig: AvatarRig, tw: Tweens, toward: number): Promise<void> {
  rig.root.rotation.y = toward;
  await pose(rig, tw, 0.3, null, GIVE_R, (k) => { rig.crouch = Math.sin(k * Math.PI) * 0.03; });
  await tw.wait(0.25);
  await settle(rig, tw, 0.3);
}

// 받고 기뻐하기: 두 팔을 번쩍 들고 두 번 폴짝
export async function playHappy(rig: AvatarRig, tw: Tweens): Promise<void> {
  await pose(rig, tw, 0.2, P.upL, P.upR);
  await tw.tween(0.8, (k) => { rig.crouch = -Math.abs(Math.sin(k * Math.PI * 2)) * 0.12; }, ease.lin);
  await settle(rig, tw);
}

// 거절당해 시무룩: 어깨가 처지고 고개를 떨군다
export async function playSulk(rig: AvatarRig, tw: Tweens): Promise<void> {
  await pose(rig, tw, 0.35, P.sadL, P.sadR, (k) => { rig.head.rotation.x = k * 0.35; rig.crouch = k * 0.06; });
  await tw.wait(0.6);
  await settle(rig, tw, 0.35);
}
