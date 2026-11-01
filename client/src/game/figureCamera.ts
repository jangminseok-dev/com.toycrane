import * as THREE from 'three';
import type { FigureSpot } from '../data/figures';

// 피규어 시점(9단계 설계 §3.3.1): ①은 정면, ①을 떼면 옆 대각선(진짜 가게에서 몸을 기울여 들여다보듯), 판이 끝나면 정면.
// 기계 좌표 [눈, 보는 점]. 선 눈높이(1.6m)에서 대기 높이(1.9m)로 움직이는 집게, 막대 위 상자, ①② 버튼이 함께 들어오게 —
// 그러려면 상자에서 2m쯤 떨어져야 한다(인형 기계 시점과 비슷한 거리). 옆은 상자로 가는 시선이 유리 칸 앞 기둥을 비켜 가게
// (PC는 거의 정옆, 휴대폰 세로는 가로 폭이 좁아 60° 대각선에서 조금 멀리). 옆 기계(2.7m 간격) 옆면 안쪽까지만. 휴대폰 세로는 화각(60°)이 달라 따로
const POSES = {
  wide: { front: [[0, 1.6, 2.0], [0, 1.35, 0]], side: [[1.7, 1.7, 0.1], [0.1, 1.45, 0.15]] },
  tall: { front: [[0, 1.6, 2.05], [0, 1.4, 0]], side: [[1.9, 1.75, 1.1], [0.1, 1.25, 0.05]] },
} as const;
const BLEND_SECONDS = 0.6;

const smooth = (t: number) => t * t * (3 - 2 * t);

// side 0(정면)~1(옆 대각선) 사이의 카메라 자리(월드)
export function figureCameraPose(spot: FigureSpot, side: number, aspect: number): { pos: THREE.Vector3; look: THREE.Vector3 } {
  const p = aspect < 1 ? POSES.tall : POSES.wide, s = Math.min(1, Math.max(0, side));
  const place = (a: readonly number[], b: readonly number[]) => new THREE.Vector3(a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), spot.ry).add(new THREE.Vector3(spot.x, 0, spot.z));
  return { pos: place(p.front[0], p.side[0]), look: place(p.front[1], p.side[1]) };
}

// 정면 → 옆으로(①을 뗄 때 start), 옆 → 정면(판이 끝날 때 stop) 0.6초 부드럽게 — 버튼을 누르는 동안은 움직이지 않는다
export class SideBlend {
  private from = 0;
  private to = 0;
  private at = -Infinity;

  value(now: number): number {
    const t = Math.min(1, Math.max(0, (now - this.at) / BLEND_SECONDS));
    return this.from + (this.to - this.from) * smooth(t);
  }

  start(now: number): void { this.from = this.value(now); this.to = 1; this.at = now; }
  stop(now: number): void { this.from = this.value(now); this.to = 0; this.at = now; }
}
