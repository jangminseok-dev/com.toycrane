import { expect, test } from 'vitest';
import { resultSteps } from './motions';

// 시제품 play() 순서: 쾅 → 두근두근 → (성공) 꺼내기·보여주기·번쩍·가방에 쏙 / (실패) 털썩
test('result motions follow the prototype order', () => {
  expect(resultSteps('win')).toEqual(['bonk', 'nervous', 'takeout', 'show', 'lift', 'bag']);
  expect(resultSteps('slip')).toEqual(['bonk', 'nervous', 'slump']);
  expect(resultSteps('miss')).toEqual(['bonk', 'nervous', 'slump']);
});
