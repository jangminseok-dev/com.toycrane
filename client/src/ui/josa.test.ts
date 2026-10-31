import { expect, test } from 'vitest';
import { eulReul, iGa } from './josa';

test('object particle follows the final consonant', () => {
  expect(eulReul('별빛 토끼')).toBe('를'); expect(eulReul('진주 펭귄')).toBe('을');
  expect(eulReul('무지개 공룡')).toBe('을'); expect(eulReul('황금 여우')).toBe('를');
});

test('iGa follows the last syllable', () => {
  expect(iGa('황금 곰돌이')).toBe('가');
  expect(iGa('별빛 토끼')).toBe('가');
  expect(iGa('민트 고양이')).toBe('가');
  expect(iGa('은하 펭귄')).toBe('이');
});
