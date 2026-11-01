import { expect, test } from 'vitest';
import { setSfxMuted, sfx, unlockAudio } from './sfx';

// 소리 끄기(설계 2026-11-02 §7)를 누르면 효과음도 나지 않는다
test('muted sound effects make no sound', () => {
  const g = globalThis as Record<string, unknown>, handlers: Record<string, () => void> = {};
  let made = 0;
  const param = { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
  g.addEventListener = (type: string, fn: () => void) => { handlers[type] = fn; };
  g.removeEventListener = () => {};
  g.AudioContext = class {
    state = 'running'; currentTime = 0; destination = {};
    resume() { return Promise.resolve(); }
    createGain() { return { gain: param, connect: (x: unknown) => x }; }
    createOscillator() { made++; return { type: '', frequency: { value: 0 }, connect: (x: unknown) => x, start() {}, stop() {} }; }
  };
  unlockAudio();
  handlers.pointerdown();
  sfx.pop();
  expect(made).toBe(1);
  setSfxMuted(true);
  sfx.pop();
  expect(made).toBe(1);
  setSfxMuted(false);
  sfx.pop();
  expect(made).toBe(2);
});
