import { expect, test } from 'vitest';
import { Later } from './thumbs';

// 작은 그림은 한꺼번에 찍지 않고 프레임마다 시간 안에서 몇 장씩(최종 리뷰 I2: 입장 때 100장 가까이를 한 번에 찍어 PC가 6초 멈춤)
test('pictures are made a few per frame and callers hear when ready', () => {
  let t = 0, made = 0;
  const later = new Later((key: string) => { made++; t += 3; return `pic:${key}`; }, () => t);
  const ready: string[] = [];
  expect(later.get('a', () => ready.push('a'))).toBeUndefined();
  expect(later.get('b', () => ready.push('b'))).toBeUndefined();
  expect(later.get('a', () => ready.push('a2'))).toBeUndefined(); // 같은 그림은 한 번만 찍는다
  expect(later.get('c', () => ready.push('c'))).toBeUndefined();
  expect(made).toBe(0); // 부르는 순간엔 찍지 않는다
  later.pump(4);
  expect(ready).toEqual(['a', 'a2', 'b']); // 4ms 안: 두 장(한 장에 3ms)
  later.pump(4);
  expect(ready).toEqual(['a', 'a2', 'b', 'c']);
  expect(made).toBe(3);
  expect(later.get('b', () => ready.push('again'))).toBe('pic:b'); // 찍어 둔 것은 바로
  expect(ready).toHaveLength(4);
});
