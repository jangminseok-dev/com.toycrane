import * as THREE from 'three';
import type { FigureSpot } from '../data/figures';

// 피규어 시점(9단계 설계 §3.3.1): ①은 정면, ①을 떼면 옆 대각선(진짜 가게에서 몸을 기울여 들여다보듯), 판이 끝나면 정면.
// 기계 좌표 [눈, 보는 점]. 상자(11×8×22cm)가 작아 인형 기계보다 가깝게 본다. 휴대폰 세로(가로 화각이 좁음)는 조금 뒤에서,
// 보는 점을 오른쪽 버튼 쪽으로 옮겨 상자와 ①② 버튼이 함께 들어오게
const POSES = {
  wide: { front: [[0, 1.5, 1.4], [0, 1.05, 0.05]], side: [[1.45, 1.55, 1.15], [0, 1.05, 0]] },
  tall: { front: [[0.16, 1.62, 1.75], [0.16, 1.0, 0.1]], side: [[1.55, 1.6, 1.5], [0.08, 1.02, 0.15]] },
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
