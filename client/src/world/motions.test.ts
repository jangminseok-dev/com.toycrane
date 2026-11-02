import { expect, test } from 'vitest';
import { resultSteps } from './motions';

// 시제품 play() 순서: 쾅 → 두근두근 → (성공) 꺼내기·보여주기·번쩍·가방에 쏙 / (실패) 털썩
test('result motions follow the prototype order', () => {
  expect(resultSteps('win')).toEqual(['bonk', 'nervous', 'takeout', 'show', 'lift', 'bag']);
  expect(resultSteps('slip')).toEqual(['bonk', 'nervous', 'slump']);
  expect(resultSteps('miss')).toEqual(['bonk', 'nervous', 'slump']);
});

// 조르기·주기·기쁨·시무룩 (교환소 개편 설계 §4.8): 조르기는 되풀이하다 멈추면 손·고개가 쉬는 자리로 돌아온다
import { beforeAll } from 'vitest';
import { Tweens } from '../game/tween';
import { stubCanvas } from '../test/canvasStub';
import { REST_L, REST_R, makeAvatar } from './avatar';
import { playGive, playHappy, playSulk, startBegging } from './motions';

beforeAll(stubCanvas);

async function run(tw: Tweens, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 30) { tw.update(1 / 30); for (let k = 0; k < 4; k++) await Promise.resolve(); }
}

test('begging repeats until stopped, then hands and head come back', async () => {
  const { rig } = makeAvatar(0, '토끼'), tw = new Tweens();
  const beg = startBegging(rig, tw);
  await run(tw, 1.5);
  expect(rig.handL.distanceTo(REST_L)).toBeGreaterThan(0.1);
  const done = beg.stop();
  await run(tw, 1);
  await done;
  expect(rig.handL.distanceTo(REST_L)).toBeLessThan(1e-6);
  expect(rig.handR.distanceTo(REST_R)).toBeLessThan(1e-6);
  expect(rig.head.rotation.z).toBeCloseTo(0);
});

test('give, happy and sulk finish back at rest', async () => {
  for (const motion of [(r: Parameters<typeof playHappy>[0], tw: Tweens) => playGive(r, tw, 1.2), playHappy, playSulk]) {
    const { rig } = makeAvatar(0, '토끼'), tw = new Tweens();
    let finished = false;
    void motion(rig, tw).then(() => { finished = true; });
    await run(tw, 2.5);
    expect(finished).toBe(true);
    expect(rig.handL.distanceTo(REST_L)).toBeLessThan(1e-6);
    expect(rig.crouch).toBeCloseTo(0);
  }
});

// 사용자 2026-11-02 '인형 뽑을 때 왜 캐릭터들이 뒤돌아보고 춤추는 거야': 하는 동안·결과 때 기계를 계속 보고(돌아서지 않음), 몸을 좌우로 흔들지 않는다
test('playing and its results keep facing the machine without swaying', async () => {
  const { playResult, startPlaying } = await import('./motions');
  const THREE = await import('three');
  const face = 1.2;
  for (const outcome of ['miss', 'win'] as const) {
    const tw = new Tweens(), a = makeAvatar(0, 'x'), r = a.rig;
    let turned = 0, sway = 0;
    const watch = () => { turned = Math.max(turned, Math.abs(r.root.rotation.y - face)); sway = Math.max(sway, Math.abs(r.bob.rotation.z)); };
    const playing = startPlaying(r, tw, face);
    for (let t = 0; t < 2; t += 1 / 30) { tw.update(1 / 30); watch(); for (let k = 0; k < 4; k++) await Promise.resolve(); }
    const stopped = playing.stop();
    for (let i = 0; i < 30; i++) { tw.update(1 / 30); for (let k = 0; k < 4; k++) await Promise.resolve(); }
    await stopped;
    const fx = { bonk() {}, claw: async () => {}, afterClaw() {}, pop() {}, win: () => 0.5, fail() {} };
    let done = false;
    void playResult(r, tw, outcome, outcome === 'win' ? new THREE.Group() : null, fx, face).then(() => { done = true; });
    for (let i = 0; i < 30 * 12 && !done; i++) { tw.update(1 / 30); watch(); for (let k = 0; k < 4; k++) await Promise.resolve(); }
    expect(done, outcome).toBe(true);
    expect(turned, `${outcome} turn`).toBeLessThan(0.01);
    expect(sway, `${outcome} sway`).toBeLessThan(0.03);
  }
}, 60_000);

// 집게가 오르내리는 동안(두근두근) 두 손은 조작대에 둔 채 고개만 살짝 들어 집게를 본다 — 두 손을 배 앞에 모으고 고개를 숙이니
// 다른 사람 화면에서 이상한 자세로 보였다(사용자 2026-11-02 사진 229)
test('while the claw moves the player keeps both hands on the controls and looks up', async () => {
  const { playResult } = await import('./motions');
  const tw = new Tweens(), r = makeAvatar(0, 'x').rig;
  let clawDone: () => void = () => {};
  const fx = { bonk() {}, claw: () => new Promise<void>((res) => { clawDone = res; }), afterClaw() {}, pop() {}, win: () => 0.5, fail() {} };
  void playResult(r, tw, 'miss', null, fx, 0);
  for (let i = 0; i < 45; i++) { tw.update(1 / 30); for (let k = 0; k < 4; k++) await Promise.resolve(); } // 쾅 → 두근두근 자세
  expect(r.handL.z).toBeGreaterThan(0.5); expect(r.handR.z).toBeGreaterThan(0.5); // 조작대(앞 0.56)에 손
  expect(Math.abs(r.handL.x - r.handR.x)).toBeGreaterThan(0.4); // 버튼·레버에 하나씩 — 가운데로 모으지 않는다
  expect(r.head.rotation.x).toBeLessThan(0); // 위(집게)를 본다
  clawDone();
});
