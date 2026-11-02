import type RAPIER from '@dimforge/rapier3d-deterministic-compat';
import type { BoxWire } from '../net/protocol';
import type { ClawShape, FigureClaw } from './figureClaw';
import type { FigurePhase } from './figureCycle';
import type { Rapier } from './rapier';

// 상자 기계(피규어·고리 걸기, 계획 12)의 물리 세계 — 같은 집게(FigureClaw)·한 바퀴(FigureCycleRunner)가 이것만 보고 돈다
export type BoxPower = { grip: number; lift: number; carry: number; max_lift: number; max_clear: number };
export interface BoxWorld {
  readonly R: Rapier;
  readonly world: RAPIER.World;
  readonly box: RAPIER.RigidBody;
  readonly dims: { w: number; d: number; h: number };
  readonly power: BoxPower;
  readonly clawShape: ClawShape; // 집게 모양(피규어는 상자 종류별 크기, 고리 걸기는 가는 팔 — 구멍에 들어가게)
  readonly floorY: number; // 아무것도 안 닿아도 집게가 이 아래로는 안 내려간다
  readonly slipRule: 'corners' | 'none'; // corners: 상자가 들림 한계를 넘으면 미끄러져 놓음(피규어), none: 걸림은 모양으로만(고리 걸기)
  readonly carryHome: boolean; // true면 쥔(걸린) 채 집으로 돌아와 놓는다(고리 걸기 — 걸린 상자가 출구 쪽으로 끌려옴), false면 위에서 놓고 돌아옴(피규어)
  time: number;
  cycle?(phase: FigurePhase, claw: FigureClaw, x: number, z: number): void; // 걸음마다(세계 한 걸음 전) — 고리 걸기의 걸림 판정
  tick(): void;
  step(dt: number): void;
  boxPose(): BoxWire;
  extraPose?(): BoxWire; // 상자에 딸린 움직이는 부분(고리 걸기의 접히는 날개) — 그림·중계
  surfaceBelow?(x: number, z: number, fromY: number): number; // (x, z) 위 fromY에서 곧장 아래로 처음 닿는 높이 — 겨냥 표시(세계는 안 움직인다)
  fallen(): boolean;
  still(): boolean;
  dispose(): void;
}
