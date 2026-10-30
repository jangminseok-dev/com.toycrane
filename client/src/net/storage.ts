// localStorage를 막아 둔 인앱 브라우저에서도 페이지가 멈추지 않게 감싼다 (그때는 게스트를 기억하지 못할 뿐)
export function safeStorage(open: () => Storage = () => localStorage) {
  const attempt = <T>(fn: (s: Storage) => T, fallback: T): T => {
    try { return fn(open()); } catch { return fallback; }
  };
  return {
    get: (key: string): string | null => attempt((s) => s.getItem(key), null),
    set: (key: string, value: string): void => attempt((s) => s.setItem(key, value), undefined),
    remove: (key: string): void => attempt((s) => s.removeItem(key), undefined),
  };
}
