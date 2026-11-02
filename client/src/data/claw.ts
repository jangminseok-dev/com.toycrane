// 집게 성격표 (shared/claw.json, 서버 domain/shared_data.CLAW와 같은 파일) — 물리 뽑기 설계 §3.2·§3.3·§9.4.
// 집게는 판마다 똑같다: 쥠의 최대 힘 = base_force × clawStrength(x, z) × 쥠의 질 × 희귀 배율 × 종류 배율
import claw from '../../../shared/claw.json';
import { MACHINE_SPEC } from './storeLayout';

export type ClawTable = {
  base_force: number; // N — 보통 인형 머리를 노리면 10판에 3~4번 되게 시뮬레이션으로 맞춘 값
  spread: number; // 거리 배율이 평균에서 ±이만큼
  quality: { three: number; two: number }; // 손가락 셋이 깊이 닿음 / 둘만 — 둘의 비율이 '조금 빗나간 겨냥'의 성공률을 정한다(0.5: 3cm 빗나가면 12%, 0.75: 34%)
  carry_relax: number; // 구멍으로 옮기는 동안 쥠의 힘이 이 비율만큼 서서히 풀린다 (끝에서 1−carry_relax) — 간신히 든 인형은 가는 길에 떨어진다
  rare: { rare: number; gold: number };
  hole: { size: number; lip: number }; // 구멍 네모 한 변, 턱 높이 (m)
  help: { plays: number; force: number }; // 같은 기계에서 plays판 연달아 못 뽑으면 그다음 판부터 뽑을 때까지 힘 × force (game/help.ts)
  max_wins: number; // 한 판에 서버가 받아 주는 당첨 수
  cycle_seconds: number; // 집게 한 바퀴
  settle_seconds: number; // 놓은 뒤 멈춤 대기
  kind: Record<string, number>; // 종류별 힘 배율 (없는 종은 1) — 승인된 생김새는 고치지 않고 이것으로 종마다 3~4/10 (인형 리뉴얼 설계 §6)
};
export const CLAW = claw as ClawTable;

// 구멍 가장자리 1−spread → 구멍에서 가장 먼 모서리 1+spread, 그 사이는 거리에 비례
export function clawStrength(x: number, z: number): number {
  const [hx, hz, hr] = MACHINE_SPEC.hole, [w, d] = MACHINE_SPEC.play_half;
  let far = 0;
  for (const cx of [-w, w]) for (const cz of [-d, d]) far = Math.max(far, Math.hypot(cx - hx, cz - hz));
  const t = Math.min(Math.max((Math.hypot(x - hx, z - hz) - hr) / (far - hr), 0), 1);
  return 1 + CLAW.spread * (2 * t - 1);
}
