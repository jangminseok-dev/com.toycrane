import { decode, needsReload, type ServerMsg } from './protocol';

// 매장 웹소켓: 해석된 메시지와 닫기 코드만 넘겨준다.
// 배포로 메시지 형식이 바뀌어 다른 버전의 welcome이 오면 한 번만 새로고침해 새 화면을 받는다(같은 버전이 오면 표시를 지운다)
const RELOADED = 'toycrane-reloaded';
export class StoreSocket {
  private ws: WebSocket;

  constructor(url: string, handlers: { onMessage(m: ServerMsg): void; onClose(code: number): void }) {
    this.ws = new WebSocket(url);
    this.ws.addEventListener('message', (e) => {
      if (typeof e.data !== 'string') return;
      if (needsReload(e.data) && reloadOnce()) return;
      const m = decode(e.data);
      if (m?.t === 'welcome') try { sessionStorage.removeItem(RELOADED); } catch { /* 저장 못 하면 다음에도 한 번 */ }
      if (m) handlers.onMessage(m);
    });
    this.ws.addEventListener('close', (e) => handlers.onClose(e.code));
  }

  send(raw: string): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(raw);
  }

  close(): void {
    this.ws.close();
  }
}

function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(RELOADED)) return false;
    sessionStorage.setItem(RELOADED, '1');
  } catch {
    return false; // 표시를 못 남기면 새로고침이 되풀이될 수 있어 하지 않는다
  }
  location.reload();
  return true;
}

export function storeUrl(store: number, guestId: string): string {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}/ws/store/${store}?guest=${encodeURIComponent(guestId)}`;
}
