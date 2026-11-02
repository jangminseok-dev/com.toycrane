import { expect, test } from 'vitest';
import { AD_SLOTS, AD_TOWER } from './ads';
import { AD_SIGNS } from './copy';

// 광고 자리는 공용 설정 파일(shared/ads.json) 하나 — 광장 광고판 4개뿐 (사용자 2026-11-01: 광고는 광장 4개에만)
test('there are four ad slots, one per plaza board', () => {
  expect(AD_SLOTS.map((s) => s.id)).toEqual([1, 2, 3, 4]);
  expect(AD_SIGNS).toEqual([...AD_SLOTS, ...AD_TOWER].map((s) => s.text));
});

// 오픈 때는 빈 광고 자리('광고문의1~9')처럼 보이지 않게 우리 내용(인사·하는 법·희귀·친구)을 띄우고, '광고 문의'는 광장 한 곳에만 작게
// 두어 누르면 인스타그램으로(사용자 2026-11-02). 문구에 가운데 점 없음
const INSTAGRAM = 'https://www.instagram.com/onlinetoycrane/';
test('the boards show our own words and one inquiry board links to Instagram', () => {
  const all = [...AD_SLOTS, ...AD_TOWER];
  expect(all.some((s) => /광고문의\d/.test(s.text))).toBe(false);
  expect(all.every((s) => !s.text.includes('·') && !(s.sub ?? '').includes('·'))).toBe(true);
  const linked = AD_SLOTS.filter((s) => s.link);
  expect(linked).toHaveLength(1);
  expect(linked[0]).toMatchObject({ text: '광고 문의', link: INSTAGRAM, sub: '@onlinetoycrane' });
  expect(AD_TOWER.filter((s) => s.text.includes('광고 문의'))).toHaveLength(1);
});

// 진열탑 전광판에는 광고 다섯 자리가 차례로 흐른다 — 번호는 광장 광고판 다음(5~9)이라 광고 자리 번호가 겹치지 않는다 (사용자 2026-11-01)
test('the tower board has five ad slots after the plaza ones', () => {
  expect(AD_TOWER.map((s) => s.id)).toEqual([5, 6, 7, 8, 9]);
  expect(AD_TOWER.every((s) => s.image === null)).toBe(true);
});
