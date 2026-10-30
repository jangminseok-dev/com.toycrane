import { expect, test } from 'vitest';
import { joystickVector } from './joystick';

test('joystick dead zone and saturation', () => {
  expect(joystickVector({ x: 0, z: 0 }, { x: 5, z: 0 }, 50)).toEqual({ x: 0, z: 0 });
  expect(joystickVector({ x: 0, z: 0 }, { x: 100, z: 0 }, 50)).toEqual({ x: 1, z: 0 });
});

// 서버·다른 사람 화면은 늘 같은 속도(3.2m/s)로 보므로, 살짝 기울여도 길이 1 (최종 리뷰 #4)
test('joystick outside dead zone is unit length', () => {
  expect(joystickVector({ x: 10, z: 10 }, { x: 10, z: 35 }, 50)).toEqual({ x: 0, z: 1 });
  const v = joystickVector({ x: 0, z: 0 }, { x: 12, z: 16 }, 50);
  expect(Math.hypot(v.x, v.z)).toBeCloseTo(1);
});
