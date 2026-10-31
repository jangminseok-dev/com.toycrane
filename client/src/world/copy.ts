// 화면(간판·안내 카드·스티커·벽 간판·장식)에 쓰는 문구를 한 곳에 — 일본어 글자 금지(copy.test.ts가 확인), 글꼴 표본도 여기서 만든다
// 기계 간판: 그 기계에 든 캐릭터가 드러나게 (캐릭터 하나에 기계 하나, 설계 2026-10-31 인형 채우기 §4.3)
export const MACHINE_SIGNS: Record<string, string> = {
  bunny: '말랑 토끼', bear: '곰돌이 왕국', cat: '냥냥 하우스', dog: '멍멍 놀이터', panda: '판다 대나무숲', hamster: '햄찌 굴',
  fox: '여우 숲', raccoon: '너구리 마을', squirrel: '도토리 다람쥐', owl: '부엉이 둥지', deer: '아기사슴 들판', hedgehog: '고슴도치 정원',
  penguin: '펭귄 얼음섬', frog: '개구리 연못', duck: '오리 호수', seal: '물범 바위', octopus: '문어 바다', whale: '고래 파도',
  chick: '삐약 병아리', pig: '꿀꿀 농장', sheep: '양떼 목장', cow: '음매 젖소', dino: '공룡 탐험대', unicorn: '유니콘 꿈나라',
};
export const POP_CARDS = ['NEW!', '잘 뽑혀요♪', '대형!', '인기 1위', '한정', '신상'];
export const STICKER = '1회 🪙1';
export const WALL_SIGN = ['toycrane', '게임센터'];
export const PREP = '준비 중';
export const COUNTER_SIGN = '코인 교환소';
export const DROP_LABEL = '잡기'; // 하강 버튼 윗면 (화살표와 함께)
export const ALL_COPY = [...Object.values(MACHINE_SIGNS), ...POP_CARDS, STICKER, ...WALL_SIGN, PREP, COUNTER_SIGN, DROP_LABEL, '0123456789-ABC'].join('');
