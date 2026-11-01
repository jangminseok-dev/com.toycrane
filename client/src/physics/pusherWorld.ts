import type RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { PUSHER, plateFront } from '../data/pushers';
import type { DollSpot } from '../net/protocol';
import { DOLL_FLOOR } from '../world/machine';
import { MachineWorld } from './machineWorld';
import type { Rapier } from './rapier';

// 미는 뽑기 기계 속 물리 세계(설계 2026-11-02 ring-hook §4, 사진 187·188): 인형 기계 세계에 바닥만 다르다.
// 오른쪽 넓은 칸 = 미니 인형이 수북한 바닥, 왼쪽 앞 = 한 단 높은 턱(오른쪽 끝은 낮은 턱이라 쌓인 인형이 칸으로 굴러떨어질 수 있다),
// 턱 뒤 = 미는 판이 숨는 집, 턱 앞 = 출구(바닥 없음 — 칸과는 투명 벽으로 막힘). 미는 판은 시각에 따라 턱 깊이의 3분의 1만 오간다.
// 출구로 떨어진 인형만 당첨(fallen). 시각은 세계 시각(time) — 같은 입력이면 같은 결과
const T = 0.05;

export class PusherWorld extends MachineWorld {
  declare plate: RAPIER.RigidBody; // 부모 생성자의 buildBox에서 만든다(필드 초기화로 덮이지 않게 declare)

  // phase: 판의 시각을 이만큼(초) 앞선 데서 시작 — 판을 하는 화면은 벽시계에 맞춰(그림과 끊기지 않게), 앉히기는 0(모든 화면이 같은 결과)
  constructor(R: Rapier, spots: DollSpot[], readonly phase = 0) {
    super(R, spots, { dollScale: PUSHER.doll_scale });
    const p = this.plate.translation();
    this.plate.setTranslation({ x: p.x, y: p.y, z: plateFront(phase) - PUSHER.plate.depth / 2 }, true); // 첫 걸음에 순간이동하지 않게
  }

  protected buildBox(): void {
    const { ledge, plate, chute, house } = PUSHER, top = DOLL_FLOOR + ledge.h, f = DOLL_FLOOR - T;
    const lw = ledge.x1 - ledge.x0, lx = (ledge.x0 + ledge.x1) / 2, back = -0.5, front = 0.5;
    // 칸 바닥(턱 오른쪽 전체)
    this.fixed((0.56 - ledge.x1) / 2, T, front, (0.56 + ledge.x1) / 2, f, 0);
    // 턱: 윗면이 top인 덩어리, 오른쪽 끝에 낮은 턱
    this.fixed(lw / 2, ledge.h / 2 + T, (ledge.z1 - ledge.z0) / 2, lx, DOLL_FLOOR + ledge.h / 2 - T, (ledge.z0 + ledge.z1) / 2);
    this.fixed(0.006, ledge.lip / 2, (ledge.z1 - ledge.z0) / 2, ledge.x1 - 0.006, top + ledge.lip / 2, (ledge.z0 + ledge.z1) / 2);
    // 미는 판 집(턱 뒤): 판 윗면보다 over만큼 높다 — 판에 얹힌 인형은 판이 들어갈 때 앞벽에 걸려 턱 위로 떨어진다.
    // 윗면은 앞으로 기운 비탈(slope_deg)이라 집 위에 떨어진 인형도 앞으로 미끄러진다(설계 '판 위에 인형이 얹히지 않는 모양')
    const hb = top + plate.h + house.over;
    this.fixed(lw / 2, (hb - f) / 2, (ledge.z0 - back) / 2, lx, (hb + f) / 2, (ledge.z0 + back) / 2);
    const a = (house.slope_deg * Math.PI) / 180, run = ledge.z0 - back, half = run / (2 * Math.cos(a));
    const zm = (ledge.z0 + back) / 2, ym = hb + (run / 2) * Math.tan(a); // 비탈 윗면 가운데 — 앞 끝이 집 앞벽 위 모서리
    this.world.createCollider(this.R.ColliderDesc.cuboid(lw / 2, T, half).setTranslation(lx, ym - T * Math.cos(a), zm - T * Math.sin(a))
      .setRotation({ x: Math.sin(a / 2), y: 0, z: 0, w: Math.cos(a / 2) }).setFriction(0.3).setRestitution(0));
    // 출구와 칸 사이 투명 벽(출구 앞쪽 x = 턱 오른쪽 끝)
    this.fixed(0.004, (DOLL_FLOOR + chute.h - (DOLL_FLOOR - 0.4)) / 2, (front - ledge.z1) / 2, ledge.x1, (DOLL_FLOOR + chute.h + DOLL_FLOOR - 0.4) / 2, (front + ledge.z1) / 2);
    this.buildWalls();
    // 미는 판: 위치 기반 kinematic, 앞면이 plateFront(t)
    const R = this.R;
    this.plate = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(lx, top + plate.h / 2, ledge.z0 - plate.depth / 2));
    this.world.createCollider(R.ColliderDesc.cuboid(lw / 2 - 0.005, plate.h / 2, plate.depth / 2).setFriction(0.3).setRestitution(0), this.plate);
  }

  protected beforeStep(): void {
    const p = this.plate.translation();
    this.plate.setNextKinematicTranslation({ x: p.x, y: p.y, z: plateFront(this.time + this.phase) - PUSHER.plate.depth / 2 });
  }

  // 미는 판 앞면 z — 그림
  plateZ(): number {
    return this.plate.translation().z + PUSHER.plate.depth / 2;
  }
}
