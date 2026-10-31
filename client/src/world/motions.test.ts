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
