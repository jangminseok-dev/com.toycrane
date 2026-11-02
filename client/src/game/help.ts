import { CLAW } from '../data/claw';
import { PUSHER } from '../data/pushers';
import { UI } from '../world/copy';

// 연달아 못 뽑으면 돕기(사용자 2026-11-02 '너무 쉽게는 안 되고 오기 생기게', 조사: 진짜 확률 기계는 정한 판 수가 차면 집게가 세지고 램프로 알린다).
// 서버가 손님마다 기계별로 연달아 못 뽑은 판(miss)을 세어 결과에 싣는다. 인형 기계는 CLAW.help.plays판 연달아 못 뽑으면 그다음 판부터 뽑을 때까지
// 집게 힘 × CLAW.help.force(그래도 잘 겨냥해야 한다 — 머리 겨냥 70%쯤), 미는 뽑기는 PUSHER.pity판째도 못 뽑으면 직원이 하나 꺼내 준다(서버).
// 남은 판이 SHOW_LEFT 이하일 때부터 버튼 위에 알려 '한 판만 더'를 부른다
const SHOW_LEFT = 3;
export function helpOf(pusher: boolean, miss: number): { status: string | null; strong: boolean } {
  const left = (pusher ? PUSHER.pity : CLAW.help.plays) - miss;
  if (!pusher && left <= 0) return { status: UI.strongClaw, strong: true };
  return { status: left > 0 && left <= SHOW_LEFT ? (pusher ? UI.staffIn : UI.strongIn)(left) : null, strong: false };
}

// 못 뽑은 판 끝의 알림: 인형을 들어 구멍 쪽으로 옮기다 놓쳤으면 '아까워요!'를 앞에(조사: 아깝게 놓친 장면이 '한 판 더'를 부른다), 그리고 도움까지 남은 판
export function missNote(pusher: boolean, miss: number, carried: boolean): string | null {
  const help = helpOf(pusher, miss).status;
  return carried ? (help ? `${UI.nearMiss} ${help}` : UI.nearMiss) : help;
}
