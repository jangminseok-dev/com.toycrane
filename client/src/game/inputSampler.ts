import type { Vec2 } from './movement';

const SECTORS = 16;
const STOP = -1;
const RESEND_MS = 3000;

// 위치는 "입력이 바뀔 때"와 "움직이는 중 3초마다"에만 보낸다 — 무료 메시지 한도를 아끼는 핵심
export class InputSampler {
  private lastSector = STOP;
  private lastSent = -Infinity;

  shouldSend(dir: Vec2, nowMs: number): boolean {
    const sector = sectorOf(dir);
    const changed = sector !== this.lastSector;
    if (!changed && (sector === STOP || nowMs - this.lastSent < RESEND_MS)) return false;
    this.lastSector = sector;
    this.lastSent = nowMs;
    return true;
  }
}

function sectorOf(dir: Vec2): number {
  if (Math.hypot(dir.x, dir.z) < 0.1) return STOP;
  const s = Math.round(Math.atan2(dir.z, dir.x) / ((Math.PI * 2) / SECTORS));
  return ((s % SECTORS) + SECTORS) % SECTORS;
}
