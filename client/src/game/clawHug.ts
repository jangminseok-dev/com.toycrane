// 쥔 뒤 화면에 보이는 벌림: 물리는 손가락이 닿는 순간 오므리기를 멈추지만, 봉제 인형을 쥔 손가락은 조금 더 파고들어 감싼다 —
// 화면(과 중계)만 그렇게 보이고 물리·판정은 그대로다 (사용자 2026-10-31 밤: "감싸는 맛")
export const HUG_SINK = 0.22, HUG_SECONDS = 0.4;

export function hugOpen(physOpen: number, holding: boolean, shown: number, dt: number): number {
  if (!holding) return physOpen;
  const target = Math.max(0, physOpen - HUG_SINK);
  return target + (shown - target) * Math.exp(-dt * 3 / HUG_SECONDS);
}
