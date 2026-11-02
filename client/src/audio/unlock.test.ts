import { expect, test } from 'vitest';
// 휴대폰(사용자 2026-11-02 '모바일에서 배경음이 안 나오는 것 같아'): 손가락 터치의 pointerdown은 브라우저가 '사용자 조작'으로 치지 않아(pointerdown은 마우스만,
// 터치는 pointerup·touchend·click) 그때 연 소리는 멈춘 채였고 듣는 것도 끝나 영영 조용했다 — 떼는 순간(pointerup)·글쇠에 열고, 정말 돌 때까지 계속 듣는다
test('audio opens on pointer up and keeps listening until the context really runs', async () => {
  const g = globalThis as Record<string, unknown>, handlers: Record<string, () => void> = {}, removed: string[] = [];
  const { unlockAudio } = await import('./sfx'); // 이 파일만의 새 모듈(열린 소리는 모듈 안에 남는다)
  g.addEventListener = (type: string, fn: () => void) => { handlers[type] = fn; };
  g.removeEventListener = (type: string) => { removed.push(type); };
  let state = 'suspended', opened = 0;
  g.AudioContext = class {
    get state() { return state; } currentTime = 0; destination = {};
    resume() { return Promise.resolve(); }
    createGain() { return { gain: {}, connect: (x: unknown) => x }; }
  };
  unlockAudio(() => { opened++; });
  expect(handlers.pointerdown).toBeUndefined();
  expect(Object.keys(handlers).sort()).toEqual(['keydown', 'pointerup', 'touchend']);
  handlers.pointerup(); await Promise.resolve(); await Promise.resolve();
  expect(opened).toBe(0); // 아직 멈춘 채 — 계속 듣는다
  expect(removed).toEqual([]);
  state = 'running';
  handlers.touchend(); await Promise.resolve(); await Promise.resolve();
  expect(opened).toBe(1);
  expect(removed.sort()).toEqual(['keydown', 'pointerup', 'touchend']);
});
