import { decode, type ServerMsg } from './protocol';

// 매장 웹소켓: 해석된 메시지와 닫기 코드만 넘겨준다
export class StoreSocket {
  private ws: WebSocket;

  constructor(url: string, handlers: { onMessage(m: ServerMsg): void; onClose(code: number): void }) {
    this.ws = new WebSocket(url);
    this.ws.addEventListener('message', (e) => {
      const m = typeof e.data === 'string' ? decode(e.data) : null;
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

export function storeUrl(store: number, guestId: string): string {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}/ws/store/${store}?guest=${encodeURIComponent(guestId)}`;
}
