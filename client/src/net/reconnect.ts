// 끊기면 0.5·1·2·4·8초 간격으로 다시 시도 (배포하면 모든 웹소켓이 끊긴다)
export function nextDelay(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 8000);
}
