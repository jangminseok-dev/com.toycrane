// 효과음: 짧은 음을 바로 만들어 낸다 (시제품 tone·sfx). 아이폰은 사용자가 처음 누를 때 소리를 열어야 해서 unlockAudio를 건다
let ac: AudioContext | null = null;

export function unlockAudio(): void {
  const open = () => {
    try { ac ??= new AudioContext(); void ac.resume(); } catch { /* 소리 없이 진행 */ }
    removeEventListener('pointerdown', open); removeEventListener('keydown', open);
  };
  addEventListener('pointerdown', open); addEventListener('keydown', open);
}

function tone(f: number, at: number, dur: number, type: OscillatorType = 'triangle', vol = 0.14) {
  if (!ac || ac.state !== 'running') return;
  const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + at;
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.05);
}

export const sfx = {
  coin: () => { tone(1320, 0, 0.08, 'square', 0.05); tone(1760, 0.07, 0.18, 'square', 0.05); },
  bonk: () => tone(150, 0, 0.18, 'sine', 0.3),
  pop: () => tone(900, 0, 0.12, 'sine', 0.12),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.3)),
  rare: () => [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.075, 0.45, 'triangle', 0.12)),
  fail: () => [392, 349, 294].forEach((f, i) => tone(f, i * 0.2, 0.35, 'sine', 0.12)),
};
