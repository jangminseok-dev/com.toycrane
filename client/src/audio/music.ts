// 배경음(설계 2026-11-02 §7): 외부 음원 없이 브라우저에서 만든 밝은 게임센터 반복 곡. 100BPM 8마디(C–Am–F–G 두 번),
// 베이스(근음·5도)·코드(짧은 스탭)·멜로디(바퀴마다 조금 바뀜). 효과음보다 작게 깔고, 끄면 바로 0 — 끈 상태는 이 기기에 기억한다
const BPM = 100, BEAT = 60 / BPM, BAR = 4, BARS = 8, LOOKAHEAD = 1.5, TICK_MS = 400;
const KEY = 'toycrane.music';
export const MUSIC_GAIN = 0.018;
export const VOICES = {
  bass: { type: 'triangle', vol: 1 },
  chord: { type: 'square', vol: 0.3 },
  lead: { type: 'square', vol: 0.5 },
} as const satisfies Record<string, { type: OscillatorType; vol: number }>;
export type Note = { t: number; dur: number; midi: number; voice: keyof typeof VOICES }; // t·dur: 박

const CHORDS = [
  { root: 48, triad: [60, 64, 67], tones: [72, 76, 79, 84] }, // C
  { root: 45, triad: [57, 60, 64], tones: [69, 72, 76, 81] }, // Am
  { root: 41, triad: [53, 57, 60], tones: [69, 72, 77, 81] }, // F
  { root: 43, triad: [55, 59, 62], tones: [71, 74, 79, 83] }, // G
];
const PASSING = [72, 74, 76, 79, 81, 84]; // C 펜타토닉(멜로디 사이 음)
const RHYTHMS = [ // 한 마디 8분음표 8칸 중 소리 나는 칸
  [1, 0, 1, 0, 1, 1, 0, 0], [1, 1, 0, 1, 0, 0, 1, 0], [1, 0, 0, 1, 1, 0, 1, 0], [0, 1, 1, 0, 1, 0, 1, 1], [1, 0, 1, 1, 0, 0, 0, 0],
];

// 바퀴마다 같은 씨앗이면 같은 수열(mulberry32)
function rng(seed: number) {
  let a = (seed * 0x9e3779b9) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function notesFor(round: number): Note[] {
  const notes: Note[] = [], rand = rng(round + 1);
  for (let bar = 0; bar < BARS; bar++) {
    const c = CHORDS[bar % CHORDS.length], t0 = bar * BAR;
    notes.push({ t: t0, dur: 0.9, midi: c.root, voice: 'bass' }, { t: t0 + 2, dur: 0.9, midi: c.root + 7, voice: 'bass' }, { t: t0 + 3.5, dur: 0.45, midi: c.root + 12, voice: 'bass' });
    for (const beat of [1, 3]) for (const m of c.triad) notes.push({ t: t0 + beat, dur: 0.3, midi: m, voice: 'chord' });
    const rhythm = RHYTHMS[Math.floor(rand() * RHYTHMS.length)], hits = rhythm.flatMap((on, i) => (on ? [i] : []));
    hits.forEach((i, k) => {
      const pool = k === 0 || rand() < 0.6 ? c.tones : PASSING, next = hits[k + 1] ?? 8;
      notes.push({ t: t0 + i / 2, dur: Math.min(1, (next - i) / 2) * 0.9, midi: pool[Math.floor(rand() * pool.length)], voice: 'lead' });
    });
  }
  return notes;
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class Music {
  muted: boolean;
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private bar = 0;
  private nextBarAt = 0;
  private rounds = new Map<number, Note[]>();

  constructor(private store: { get(k: string): string | null; set(k: string, v: string): void }) {
    this.muted = store.get(KEY) === 'off';
  }

  // 첫 터치·클릭으로 소리가 열리면(브라우저 자동 재생 규칙) 시작
  start(ac: AudioContext): void {
    if (this.ac) return;
    this.ac = ac;
    this.master = ac.createGain();
    this.master.gain.setValueAtTime(this.muted ? 0 : MUSIC_GAIN, ac.currentTime);
    this.master.connect(ac.destination);
    if (!this.muted) this.play();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.store.set(KEY, muted ? 'off' : 'on');
    if (!this.ac || !this.master) return;
    this.master.gain.cancelScheduledValues(this.ac.currentTime);
    this.master.gain.setValueAtTime(muted ? 0 : MUSIC_GAIN, this.ac.currentTime);
    if (muted) this.halt(); else this.play();
  }

  stop(): void { this.halt(); }

  get playing(): boolean { return this.timer !== null; } // 마디를 걸고 있는 중

  private play(): void {
    if (this.timer || !this.ac) return;
    this.nextBarAt = this.ac.currentTime + 0.1;
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private halt(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // 앞으로 LOOKAHEAD초 안에 시작하는 마디를 미리 걸어 둔다
  private tick(): void {
    const ac = this.ac, master = this.master;
    if (!ac || !master) return;
    if (this.nextBarAt < ac.currentTime) this.nextBarAt = ac.currentTime + 0.05; // 탭이 잠들었다 깨면 지금부터
    while (this.nextBarAt < ac.currentTime + LOOKAHEAD) {
      const round = Math.floor(this.bar / BARS), inBar = this.bar % BARS;
      let notes = this.rounds.get(round);
      if (!notes) { this.rounds.clear(); this.rounds.set(round, (notes = notesFor(round))); }
      for (const n of notes) if (n.t >= inBar * BAR && n.t < (inBar + 1) * BAR) this.voice(ac, master, n, this.nextBarAt + (n.t - inBar * BAR) * BEAT);
      this.bar++;
      this.nextBarAt += BAR * BEAT;
    }
  }

  private voice(ac: AudioContext, master: GainNode, n: Note, at: number): void {
    const o = ac.createOscillator(), g = ac.createGain(), v = VOICES[n.voice], end = at + n.dur * BEAT;
    o.type = v.type; o.frequency.value = hz(n.midi);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(v.vol, at + 0.012); g.gain.exponentialRampToValueAtTime(0.001, end);
    o.connect(g).connect(master); o.start(at); o.stop(end + 0.05);
  }
}
