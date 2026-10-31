// 화면(간판·안내 카드·스티커·벽 간판·장식)에 쓰는 문구를 한 곳에 — 일본어 글자 금지(copy.test.ts가 확인), 글꼴 표본도 여기서 만든다
export const MACHINE_NAMES = ['곰돌이 대작전', '병아리 파티', '말랑 토끼', '포근 곰', '두근 크레인', '왕큰 인형', '행운 상자',
  '삐약 삐약', '한 번 더!', '인형 천국', '럭키 크레인', '토끼 마을', '꿀잼 뽑기'];
export const POP_CARDS = ['NEW!', '잘 뽑혀요♪', '대형!', '인기 1위', '한정', '신상'];
export const STICKER = '1회 🪙1';
export const WALL_SIGN = ['toycrane', '게임센터'];
export const PREP = '준비 중';
export const COUNTER_SIGN = '코인 교환소';
export const DROP_LABEL = '잡기'; // 하강 버튼 윗면 (화살표와 함께)
export const ALL_COPY = [...MACHINE_NAMES, ...POP_CARDS, STICKER, ...WALL_SIGN, PREP, COUNTER_SIGN, DROP_LABEL, '0123456789-ABC'].join('');
