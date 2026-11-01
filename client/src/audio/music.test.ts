import { afterEach, expect, test } from 'vitest';
import { SFX_SOFTEST } from './sfx';
import { MUSIC_GAIN, Music, VOICES, notesFor, type Note } from './music';

// 배경음(설계 2026-11-02 §7): 100BPM 8마디 반복, 코드·베이스·짧은 멜로디
const peak = (n: Note) => MUSIC_GAIN * VOICES[n.voice].vol;
test('music is quieter than sound effects', () => {
  const notes = notesFor(0);
  // 가장 큰 순간(같이 울리는 음의 합)도 가장 작은 효과음보다 작다
  const loudest = Math.max(...notes.map((a) => notes.filter((b) => b.t <= a.t && a.t < b.t + b.dur).reduce((s, b) => s + peak(b), 0)));
  expect(loudest).toBeLessThan(SFX_SOFTEST);
  expect(Math.max(...notes.map((n) => n.t + n.dur))).toBeLessThanOrEqual(32 + 1e-9); // 8마디 × 4박
});

test('the loop changes its melody each round', () => {
  const lead = (r: number) => JSON.stringify(notesFor(r).filter((n) => n.voice === 'lead'));
  const rest = (r: number) => JSON.stringify(notesFor(r).filter((n) => n.voice !== 'lead'));
  expect(lead(0)).not.toBe(lead(1));
  expect(lead(1)).not.toBe(lead(2));
  expect(lead(1)).toBe(lead(1)); // 같은 바퀴는 같은 멜로디
  expect(rest(0)).toBe(rest(1)); // 코드·베이스는 그대로
});

// 끄면 바로 0, 이 기기에 기억해서 다음 접속에도 꺼져 있다
const fakeAc = () => {
  const gains: { gain: { value: number; setValueAtTime(v: number, t: number): void; cancelScheduledValues(t: number): void }; connect(x: unknown): unknown }[] = [];
  const node = () => ({ connect: (x: unknown) => x });
  const ac = {
    currentTime: 0, destination: {},
    createGain() {
      const g = { gain: { value: 1, setValueAtTime(v: number) { g.gain.value = v; }, cancelScheduledValues() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (x: unknown) => x };
      gains.push(g); return g;
    },
    createOscillator: () => ({ ...node(), type: '', frequency: { value: 0 }, start() {}, stop() {} }),
  };
  return { ac: ac as unknown as AudioContext, master: () => gains[0] };
};
const store = () => { const m = new Map<string, string>(); return { get: (k: string) => m.get(k) ?? null, set: (k: string, v: string) => { m.set(k, v); } }; };
let music: Music | null = null;
afterEach(() => music?.stop());

test('muting stops at once and is remembered', () => {
  const s = store(), { ac, master } = fakeAc();
  music = new Music(s);
  expect(music.muted).toBe(false);
  music.start(ac);
  expect(master().gain.value).toBe(MUSIC_GAIN);
  expect(music.playing).toBe(true);
  music.setMuted(true);
  expect(master().gain.value).toBe(0);
  expect(music.playing).toBe(false);
  expect(new Music(s).muted).toBe(true);
  music.setMuted(false);
  expect(master().gain.value).toBe(MUSIC_GAIN);
  expect(new Music(s).muted).toBe(false);
});
