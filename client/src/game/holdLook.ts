import { probesAt } from './gripPlan';

// 쥔 인형의 보이는 모습 (사용자 2026-11-01: "손가락이 인형을 안 감싸는 느낌"): 물리는 손가락이 닿는 순간 멈추고 인형은 접촉점 근처에 매달리지만,
// 화면(과 중계)에서는 손가락을 쥔 공을 감싸는 벌림까지 오므리고, 인형을 공 중심이 손가락 우리 안(허브 바로 아래)에 오도록 조금 끌어올린다.
// 물리·판정은 그대로다 — 쥐고 놓을 때 0.3초/0.2초에 걸쳐 섞어 튀지 않게
const TIP_IN = 0.85; // 손가락 끝 반지름 = 공 반지름 × 이만큼 (살짝 파고듦)
const ABOVE_TIPS = 0.55; // 공 중심은 손가락 끝보다 반지름 × 이만큼 위 (적도 조금 아래를 쥔 모양)
const IN_SECONDS = 0.3, OUT_SECONDS = 0.2, MAX_SHIFT = 0.12;

const tipRadius = (open: number) => Math.max(...probesAt(0, 0, 0, open).tips.map((t) => Math.hypot(t.x, t.z)));
const tipsY = (open: number) => Math.min(...probesAt(0, 0, 0, open).tips.map((t) => t.y));
const wrapCache = new Map<number, number>();

// 손가락 끝이 반지름 r의 공 표면 살짝 안쪽에 오는 벌림 (벌림이 클수록 끝 반지름이 커진다)
export function wrapOpen(r: number): number {
  const key = Math.round(r * 1000);
  let open = wrapCache.get(key);
  if (open === undefined) {
    open = 0;
    for (let o = 0; o <= 1; o += 0.01) { open = o; if (tipRadius(o) >= r * TIP_IN) break; }
    wrapCache.set(key, open);
  }
  return open;
}

// 그 벌림에서 공 중심이 올 높이 (집게 원점 기준)
export const cageY = (open: number, r: number) => tipsY(open) + r * ABOVE_TIPS;

export type Hold = { r: number; c: [number, number, number] };

export class HoldLook {
  private blend = 0;

  update(dt: number, holding: boolean): void {
    const target = holding ? 1 : 0, tau = (holding ? IN_SECONDS : OUT_SECONDS) / 3;
    this.blend = target + (this.blend - target) * Math.exp(-dt / tau);
  }

  // 보이는 벌림: 물리 벌림과 감싸는 벌림 사이
  open(physOpen: number, hold: Hold | null): number {
    if (!hold || this.blend < 1e-3) return physOpen;
    return physOpen + (wrapOpen(hold.r) - physOpen) * this.blend;
  }

  // 쥔 인형을 옮겨 그릴 양: 공 중심 → 집게 원점 아래 우리 안
  shift(claw: { x: number; y: number; z: number }, hold: Hold | null): [number, number, number] {
    if (!hold || this.blend < 1e-3) return [0, 0, 0];
    const open = wrapOpen(hold.r);
    let dx = claw.x - hold.c[0], dy = claw.y + cageY(open, hold.r) - hold.c[1], dz = claw.z - hold.c[2];
    const len = Math.hypot(dx, dy, dz);
    if (len > MAX_SHIFT) { dx *= MAX_SHIFT / len; dy *= MAX_SHIFT / len; dz *= MAX_SHIFT / len; }
    return [dx * this.blend, dy * this.blend, dz * this.blend];
  }
}
