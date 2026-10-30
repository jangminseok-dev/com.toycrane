import { expect, test } from 'vitest';
import { safeStorage } from './storage';

// 일부 인앱 브라우저는 localStorage 접근 자체가 예외를 던진다 → 게스트 없이도 진행 (최종 리뷰 #3)
test('storage errors do not break the page', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  const s = safeStorage(() => broken as unknown as Storage);
  expect(s.get('k')).toBeNull();
  expect(() => s.set('k', 'v')).not.toThrow();
  expect(() => s.remove('k')).not.toThrow();
});

test('storage works normally when available', () => {
  const data = new Map<string, string>();
  const ok = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
  const s = safeStorage(() => ok as unknown as Storage);
  s.set('k', 'v');
  expect(s.get('k')).toBe('v');
  s.remove('k');
  expect(s.get('k')).toBeNull();
});
