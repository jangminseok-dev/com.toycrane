import type RAPIER from '@dimforge/rapier3d-deterministic-compat';
import type { BoxWire } from '../net/protocol';
import type { Rapier } from './rapier';

// 상자 기계(피규어·고리 걸기, 계획 12)의 물리 세계 — 같은 집게(FigureClaw)·한 바퀴(FigureCycleRunner)가 이것만 보고 돈다
export type BoxPower = { grip: number; lift: number; carry: number; max_lift: number; max_clear: number };
export interface BoxWorld {
  readonly R: Rapier;
  readonly world: RAPIER.World;
  readonly box: RAPIER.RigidBody;
  readonly dims: { w: number; d: number; h: number };
  readonly power: BoxPower;
  readonly clawScale: number; // 집게 크기 배율(clawShape)
  readonly floorY: number; // 아무것도 안 닿아도 집게가 이 아래로는 안 내려간다
  readonly slipRule: 'corners' | 'none'; // corners: 상자가 들림 한계를 넘으면 미끄러져 놓음(피규어), none: 걸림은 모양으로만(고리 걸기)
  time: number;
  tick(): void;
  step(dt: number): void;
  boxPose(): BoxWire;
  fallen(): boolean;
  still(): boolean;
  dispose(): void;
}
