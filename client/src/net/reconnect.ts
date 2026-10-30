import { CLOSE_OTHER_TAB, CLOSE_UNKNOWN_GUEST } from './protocol';

// 끊기면 0.5·1·2·4·8초 간격으로 다시 시도 (배포하면 모든 웹소켓이 끊긴다)
export function nextDelay(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 8000);
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// 성공할 때까지 간격을 두고 다시 한다. 다시 하기 전마다 onRetry(시도 번호)로 알린다
export async function retrying<T>(task: () => Promise<T>, onRetry: (attempt: number) => void, sleep = wait): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch {
      onRetry(attempt);
      await sleep(nextDelay(attempt));
    }
  }
}

// 매장 웹소켓이 닫혔을 때: 다른 창에 밀려났으면 멈춤, 게스트가 사라졌으면 처음부터, 나머지(만석·배포·끊김)는 간격을 두고 다시
export function closeAction(code: number): 'stop' | 'restart' | 'retry' {
  if (code === CLOSE_OTHER_TAB) return 'stop';
  if (code === CLOSE_UNKNOWN_GUEST) return 'restart';
  return 'retry';
}
