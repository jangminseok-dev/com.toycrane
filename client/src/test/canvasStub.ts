// 노드 테스트에는 캔버스가 없다. 텍스처를 그리는 코드가 돌 수 있게 아무 그리기 호출이나 받아 주는 가짜 캔버스를 깐다.
const noop = () => {};
const gradient = { addColorStop: noop };
const ctx = new Proxy({} as Record<string | symbol, unknown>, {
  get(target, key) {
    if (key in target) return target[key];
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
    if (key === 'measureText') return () => ({ width: 10 });
    return noop;
  },
  set(target, key, value) { target[key] = value; return true; },
});

export function stubCanvas(): void {
  const g = globalThis as { document?: unknown };
  if (g.document) return;
  g.document = { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }) };
}
