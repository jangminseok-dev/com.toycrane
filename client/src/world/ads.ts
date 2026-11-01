// 광고 자리 (shared/ads.json, 큰 홀 설계 2026-11-01 §3): 1~10 벽 간판, 11~14 광장 광고판, 진열탑 전광판은 한가할 때 차례로.
// 광고를 바꾸려면 이 파일의 글(text)이나 그림 경로(image, 같은 출처)를 고쳐 배포한다 — 관리 화면은 없다
import ads from '../../../shared/ads.json';

export type AdSlot = { id: number; text: string; image: string | null };
export const AD_SLOTS = ads.slots as AdSlot[];
