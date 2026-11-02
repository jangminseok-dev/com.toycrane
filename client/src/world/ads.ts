// 광고 자리 (shared/ads.json, 사용자 2026-11-01): 광장 광고판 4개(1~4)와 진열탑 전광판에 차례로 흐르는 5개(5~9). 벽 간판에는 광고가 없다.
// 광고를 바꾸려면 이 파일의 글(text)이나 그림 경로(image, 같은 출처)를 고쳐 배포한다 — 관리 화면은 없다. 오픈 때는 우리 내용과 '광고 문의'(인스타그램) 하나
import ads from '../../../shared/ads.json';

export type AdSlot = { id: number; text: string; image: string | null; sub?: string; link?: string }; // sub: 큰 글 아래 작은 줄, link: 광장 판을 누르면 여는 주소
export const AD_SLOTS = ads.slots as AdSlot[];
export const AD_TOWER = ads.tower as AdSlot[];
