import { isPusher } from '../data/pushers';
import type { DollSpot } from '../net/protocol';
import { MachineWorld } from './machineWorld';
import { PusherWorld } from './pusherWorld';
import type { Rapier } from './rapier';

// 기계 번호로 고르는 물리 세계(설계 ring-hook §4): 미는 뽑기는 판이 있는 세계(running = 한 판 — 판이 움직임, phase = 판 시각의 시작점,
// 실제 시각에 맞춰 늘 오가는 그림 판과 같은 박자), 아니면 인형 기계
export function craneWorld(R: Rapier, id: string, spots: DollSpot[], running = false, phase = 0): MachineWorld {
  return isPusher(id) ? new PusherWorld(R, spots, running, phase) : new MachineWorld(R, spots);
}
