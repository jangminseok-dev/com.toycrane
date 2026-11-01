// 화면(간판·안내 카드·스티커·벽 간판·장식·버튼·알림)에 쓰는 문구를 한 곳에 — 일본어 글자와 가운데 점(·) 금지(copy.test.ts가 확인),
// 글꼴 표본도 여기서 만든다. 상태는 버튼 위 작은 글, 버튼 안에는 할 일만 (교환소 개편 설계 §4.7)
// 기계 간판: 그 기계에 든 캐릭터가 드러나게 (캐릭터 하나에 기계 하나, 설계 2026-10-31 인형 채우기 §4.3)
import { AD_SLOTS, AD_TOWER } from './ads';
export const MACHINE_SIGNS: Record<string, string> = {
  bunny: '말랑 토끼', bear: '곰돌이 왕국', cat: '냥냥 하우스', dog: '멍멍 놀이터', panda: '판다 대나무숲', hamster: '햄찌 굴',
  fox: '여우 숲', raccoon: '너구리 마을', squirrel: '도토리 다람쥐', owl: '부엉이 둥지', deer: '아기사슴 들판', hedgehog: '고슴도치 정원',
  penguin: '펭귄 얼음섬', frog: '개구리 연못', duck: '오리 호수', seal: '물범 바위', octopus: '문어 바다', whale: '고래 파도',
  chick: '삐약 병아리', pig: '꿀꿀 농장', sheep: '양떼 목장', cow: '음매 젖소', dino: '공룡 탐험대', unicorn: '유니콘 꿈나라',
};
export const POP_CARDS = ['새로 왔어요', '잘 잡혀요', '오늘의 추천', '인기 1위', '한정판', '행운 기계'];
export const STICKER = '1회 🪙1';
export const WALL_SIGN = ['toycrane', '게임센터'];
export const PREP = '준비 중';
export const COUNTER_SIGN = '코인 교환소';
export const DROP_LABEL = '잡기'; // 하강 버튼 윗면 (화살표와 함께)
export const AD_SIGNS = [...AD_SLOTS, ...AD_TOWER].map((s) => s.text); // 광장 광고판 4개(1~4)와 진열탑 전광판 5개(5~9), shared/ads.json
export const BEGGING = '조르는 중'; // 조르는 사람 이름표 옆
export const RARE_TAG = { rare: '★ 희귀', gold: '★★ 황금' }; // 희귀가 든 기계 위 이름표
export const FIGURE_SIGN = '피규어 뽑기'; // 피규어 기계 간판(9단계)
export const FIGURE_BOX = 'toycrane 피규어 컬렉션'; // 랜덤 상자 윗면 — 캐릭터는 안 보인다
export const FIGURE_REVEAL = { rare: '희귀!', gold: '황금!' }; // 상자 까기 이름표(일반은 없음)
export const FIGURE_WORD = '피규어';

const COUNT = ['', '한', '두', '세', '네', '다섯'];
const ORDINAL = ['', '첫 번째', '두 번째', '세 번째', '네 번째', '다섯 번째'];
export const UI = {
  playOne: '한 판 하기',
  playRun: (n: number) => `${COUNT[n] ?? n} 판 하기`,
  again: '한 판 더',
  againRun: (n: number) => `${COUNT[n] ?? n} 판 더`,
  stand: '그만하기',
  noCoins: '코인이 없어요',
  goCounter: '교환소 가기',
  takeCoins: '코인 받기',
  beg: '조르기',
  stopBeg: '그만 조르기',
  give: '주기',
  enough: '코인이 넉넉해요',
  full: '코인이 가득 찼어요',
  begWait: (min: number) => `${min}분 뒤에 다시 와요`,
  someoneBegs: (nick: string) => `${nick} 님이 조르는 중`,
  watching: '다른 사람이 하고 있어요',
  continueIn: (s: number) => `${s}초 안에 이어서 할 수 있어요`,
  nextRun: (k: number) => `곧 ${ORDINAL[k] ?? `${k}번째`} 판이 시작돼요`,
  hint: '레버로 집게를 옮기고 잡기 버튼을 눌러요',
  physicsLoading: '준비 중', // 물리 모듈(Rapier)을 아직 받는 중
  saveFailed: '결과를 저장하지 못했어요', // 서버가 판 보고를 거절(물리 뽑기 설계 §9.7)
  wonMore: (n: number) => `인형 ${n}개가 더 들어왔어요`,
  gotCoins: (n: number) => `코인 ${n}개를 받았어요!`,
  gaveYou: (nick: string, n: number) => `${nick} 님이 코인 ${n}개를 줬어요`,
  youGave: (n: number) => `코인 ${n}개를 줬어요`,
  noCoinsToast: '코인이 없어요. 교환소에서 받을 수 있어요',
  giveTitle: (nick: string) => `${nick} 님에게 줄 코인`,
  giveCount: (n: number) => `${n}개`,
  giveMax: '최대',
  cancel: '닫기',
  giveNo: {
    gone: '그 사람이 매장을 나갔어요', stopped: '이미 그만 조르고 있어요', far: '조금 더 가까이 가 주세요', poor: '코인이 모자라요',
    full: '그 사람 코인이 가득 찼어요', self: '나에게는 줄 수 없어요', playing: '한 판이 끝나면 줄 수 있어요',
  } as Record<string, string>,
};
export const ALL_COPY = [...Object.values(MACHINE_SIGNS), ...POP_CARDS, STICKER, ...WALL_SIGN, PREP, COUNTER_SIGN, DROP_LABEL, ...AD_SIGNS, ...Object.values(RARE_TAG), FIGURE_SIGN, FIGURE_BOX, ...Object.values(FIGURE_REVEAL), FIGURE_WORD, '0123456789-ABCF?!GET'].join('');
