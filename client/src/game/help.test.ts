import { expect, test } from 'vitest';
import { CLAW } from '../data/claw';
import { PUSHER } from '../data/pushers';
import { helpOf, missNote } from './help';

// 연달아 못 뽑으면 돕기(사용자 2026-11-02 '너무 쉽게는 안 되고 오기 생기게'): 인형 기계는 help.plays판 연달아 못 뽑으면 그다음 판부터 뽑을 때까지
// 집게가 세진다(진짜 확률 기계처럼), 미는 뽑기는 pity판째도 못 뽑으면 직원이 하나 꺼내 준다. 남은 판이 3판 이하일 때부터 버튼 위에 알린다
test('a doll machine warns three plays ahead, then plays with a strong claw until a win', () => {
  const P = CLAW.help.plays;
  expect(helpOf(false, 0)).toEqual({ status: null, strong: false });
  expect(helpOf(false, P - 4)).toEqual({ status: null, strong: false });
  expect(helpOf(false, P - 3)).toEqual({ status: '집게가 세지기까지 3판', strong: false });
  expect(helpOf(false, P - 1)).toEqual({ status: '집게가 세지기까지 1판', strong: false });
  expect(helpOf(false, P)).toEqual({ status: '집게 힘이 세졌어요', strong: true });
  expect(helpOf(false, P + 4)).toEqual({ status: '집게 힘이 세졌어요', strong: true });
});

test('a pusher counts down to the staff gift and never strengthens the claw', () => {
  const P = PUSHER.pity;
  expect(helpOf(true, P - 4)).toEqual({ status: null, strong: false });
  expect(helpOf(true, P - 3)).toEqual({ status: '직원 도움까지 3판', strong: false });
  expect(helpOf(true, P - 1)).toEqual({ status: '직원 도움까지 1판', strong: false });
});

// 아깝게 놓친 판(조사: 들었다 놓치는 장면이 '한 판 더'를 부른다): 인형을 들어 구멍 쪽으로 옮기다 놓쳤으면 '아까워요!'를 앞에 붙인다
test('a miss after carrying a doll says it was close, with the help count', () => {
  const P = CLAW.help.plays;
  expect(missNote(false, 1, true)).toBe('아까워요!');
  expect(missNote(false, P - 2, true)).toBe('아까워요! 집게가 세지기까지 2판');
  expect(missNote(false, P - 2, false)).toBe('집게가 세지기까지 2판');
  expect(missNote(true, PUSHER.pity - 1, true)).toBe('아까워요! 직원 도움까지 1판');
  expect(missNote(false, 1, false)).toBeNull();
});
