import { expect, test } from 'vitest';
import { DOLLS, EFFECTS, GOLD } from '../data/catalog';
import { AD_SIGNS, BEGGING, COUNTER_SIGN, DROP_LABEL, MACHINE_SIGNS, POP_CARDS, PREP, RARE_TAG, STICKER, UI, WALL_SIGN } from './copy';

// 화면에 나오는 문구를 모두 펼친다 (함수 문구는 대표 값으로)
const uiTexts = (): string[] => Object.values(UI).flatMap((v) => {
  if (typeof v === 'string') return [v];
  if (typeof v === 'function') return [(v as (...a: unknown[]) => string)(3, 7)];
  return Object.values(v as Record<string, string>);
});
const everything = () => [...POP_CARDS, STICKER, ...WALL_SIGN, PREP, COUNTER_SIGN, DROP_LABEL, ...Object.values(MACHINE_SIGNS),
  ...Object.values(DOLLS).flatMap((d) => [d.name, ...d.palette.map((c) => c.name)]), ...EFFECTS.map((e) => e.name), GOLD.name,
  ...AD_SIGNS, BEGGING, ...Object.values(RARE_TAG), ...uiTexts()];

// 설계 2026-10-31 §2 안티목표: 간판·카드·스티커·장식 어디에도 일본어(가나·한자)를 쓰지 않는다
const JP = /[぀-ヿㇰ-ㇿ一-鿿]/;
test('on-screen copy has no Japanese characters', () => {
  for (const s of everything()) expect(JP.test(s), s).toBe(false);
});

// 교환소 개편 설계 §3.5: 가운데 점(·)으로 두 문장을 잇지 않는다 — 상태는 버튼 위, 버튼 안에는 할 일만
test('on-screen copy never joins two sentences with a middle dot', () => {
  for (const s of everything()) expect(s.includes('·'), s).toBe(false);
});

test('every character has its own machine sign', () => {
  expect(Object.keys(MACHINE_SIGNS).sort()).toEqual(Object.keys(DOLLS).sort());
});

// 교환소 개편 설계 §4.7 문구
test('copy reads naturally', () => {
  expect(UI.playOne).toBe('한 판 하기');
  expect(UI.playRun(5)).toBe('다섯 판 하기');
  expect(UI.againRun(3)).toBe('세 판 더');
  expect(UI.nextRun(2)).toBe('곧 두 번째 판이 시작돼요');
  expect(UI.continueIn(12)).toBe('12초 안에 이어서 할 수 있어요');
  expect(UI.begWait(5)).toBe('5분 뒤에 다시 와요');
  expect(UI.gaveYou('토끼', 3)).toBe('토끼 님이 코인 3개를 줬어요');
  expect(POP_CARDS).toEqual(['새로 왔어요', '잘 잡혀요', '오늘의 추천', '인기 1위', '한정판', '행운 기계']);
  expect(AD_SIGNS).toHaveLength(4);
  expect(AD_SIGNS[0]).toBe('광고문의1');
});
