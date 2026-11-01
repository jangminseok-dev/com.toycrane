import { isPusher } from '../data/pushers';
import type { DollSpot } from '../net/protocol';
import { MachineWorld } from './machineWorld';
import { PusherWorld } from './pusherWorld';
import type { Rapier } from './rapier';

// 기계 번호로 고르는 물리 세계(설계 ring-hook §4): 미는 뽑기는 판이 오가는 세계(phase = 판 시각을 이만큼 앞서 시작), 아니면 인형 기계
export function craneWorld(R: Rapier, id: string, spots: DollSpot[], phase = 0): MachineWorld {
  return isPusher(id) ? new PusherWorld(R, spots, phase) : new MachineWorld(R, spots);
}
