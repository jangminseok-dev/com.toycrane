import { UI } from '../world/copy';

export const TAKE_LIMIT = 15; // 코인 받기로 채울 수 있는 데까지(서버 coins.py TAKE_LIMIT)

// 교환소 코인 받기 버튼(친구 피드백 2026-11-02 '버튼이 안 먹기도'): 15개 이상이면 왜 안 되는지 버튼 글자로(흐리게, 안 보냄),
// 눌러서 응답을 기다리는 동안(taking)은 '받는 중' — 서버(지갑 기록)가 1초쯤 걸려 안 눌린 줄 알았다
export function takeButton(coins: number, taking: boolean): { label: string; status: string | null; dim: boolean; send: boolean } {
  if (coins >= TAKE_LIMIT) return { label: UI.takeFull, status: null, dim: true, send: false };
  if (taking) return { label: UI.takeCoins, status: UI.taking, dim: true, send: false };
  return { label: UI.takeCoins, status: null, dim: false, send: true };
}
