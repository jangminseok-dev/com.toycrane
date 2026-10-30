import { COUNTERS } from '../data/storeLayout';
import type { Vec2 } from './movement';

const ENTRY_REACH = 1.5;  // 줄 끝 빈자리에서 이만큼 안이면 "줄 서기"
const LEAVE_REACH = 1.5;  // 내 자리에서 이만큼 넘게 벗어나면 줄에서 나감 (설계 §3.3 "줄에서 벗어나면 차례가 빠진다")
const WINDOW_REACH = 1.0; // 서버 coins.py WINDOW_REACH와 같음
const TAKE_SECONDS = 2.0; // 서버가 0.3초 여유를 두므로 화면은 꼭 2초 뒤에 보낸다

export type QueueStatus = { kind: 'none' } | { kind: 'waiting'; place: number } | { kind: 'taking'; progress: number };

const dist = (a: Vec2, [x, z]: [number, number]) => Math.hypot(a.x - x, a.z - z);

// 교환소 줄에서 내 차례 따라가기: 서버가 보낸 줄 순서로 내 자리를 정하고, 벗어나면 나가기·맨 앞 2초 뒤 받기를 한 번씩 알린다
export class QueueClient {
  private lengths = COUNTERS.map(() => 0);
  private counter: number | null = null;
  private place = -1;
  private headAt: number | null = null;
  private sent: 'take' | 'unqueue' | null = null;

  onQueue(c: number, ids: string[], myId: string, now: number): void {
    this.lengths[c] = ids.length;
    const place = ids.indexOf(myId);
    if (place < 0) {
      if (this.counter === c) this.reset();
      return;
    }
    if (this.counter !== c) this.sent = null;
    this.counter = c;
    this.place = place;
    if (place === 0) this.headAt ??= now;
    else this.headAt = null;
  }

  reset(): void {
    this.counter = null; this.place = -1; this.headAt = null; this.sent = null;
  }

  // 줄 끝 빈자리 근처면 그 교환소 번호 (이미 줄에 있으면 null)
  entryNear(pos: Vec2): number | null {
    if (this.counter !== null) return null;
    const c = COUNTERS.findIndex((k, i) => dist(pos, k.queue[Math.min(this.lengths[i], k.queue.length - 1)]) <= ENTRY_REACH);
    return c >= 0 ? c : null;
  }

  target(): Vec2 | null {
    if (this.counter === null) return null;
    const [x, z] = COUNTERS[this.counter].queue[this.place];
    return { x, z };
  }

  tick(pos: Vec2, now: number): 'take' | 'unqueue' | null {
    if (this.counter === null || this.sent) return null;
    const k = COUNTERS[this.counter];
    if (dist(pos, k.queue[this.place]) > LEAVE_REACH) return (this.sent = 'unqueue');
    if (this.place === 0 && this.headAt !== null && dist(pos, k.window) <= WINDOW_REACH && now - this.headAt >= TAKE_SECONDS) {
      return (this.sent = 'take');
    }
    return null;
  }

  status(now: number): QueueStatus {
    if (this.counter === null) return { kind: 'none' };
    if (this.place > 0) return { kind: 'waiting', place: this.place + 1 };
    return { kind: 'taking', progress: this.headAt === null ? 0 : Math.min(1, (now - this.headAt) / TAKE_SECONDS) };
  }
}
