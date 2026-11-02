import type RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { PUSHER, plateFront } from '../data/pushers';
import type { DollSpot } from '../net/protocol';
import { DOLL_FLOOR } from '../world/machine';
import { MACHINE_SPEC } from '../data/storeLayout';
import { MachineWorld, QuietWindow, WALL_MARGIN } from './machineWorld';
import type { Rapier } from './rapier';

// 미는 뽑기 기계 속 물리 세계(설계 2026-11-02 ring-hook §4, 사진 187·188): 인형 기계 세계에 바닥만 다르다.
// 오른쪽 넓은 칸 = 미니 인형이 수북한 바닥, 왼쪽 앞 = 한 단 높은 턱(오른쪽 끝은 낮은 턱이라 쌓인 인형이 칸으로 굴러떨어질 수 있다),
// 턱 뒤 = 미는 판이 숨는 집, 턱 앞 = 출구(바닥 없음 — 칸과는 투명 벽으로 막힘). 미는 판은 턱 깊이의 3분의 1만 오간다 —
// 코인을 넣은 판(running)에서만 들어가 있던 자리부터 움직이고, 집게가 인형을 놓은 뒤 지금 왕복을 마치고(3초 안) 들어가 멈춘다(사용자 2026-11-02).
// 아무도 안 할 때(앉히기·판 사이)는 들어가 멈춰 있다.
// 출구로 떨어진 인형만 당첨(fallen). 시각은 세계 시각(time) — 같은 입력이면 같은 결과
// 판 오른쪽 끝은 낮은 턱 안쪽까지만 — 턱 너머 칸 무더기에 기댄 인형을 건드려 무더기를 깨우지 않게
export const PLATE_INSET = 0.02;
export const plateDepth = (): number => PUSHER.plate.depth + PUSHER.plate.stroke + 0.01;
const T = 0.05, PILE_GAP = 0.06, SETTLE_MAX = 15;
// 재워도 되는 자리: 칸(낮은 턱에 기댄 인형 포함) — 턱 위 인형은 판이 밀어야 한다(움직이는 판은 잠든 인형을 깨우지 못한다)
const restable = (p: { x: number; z: number }) => p.x >= PUSHER.ledge.x1 - 0.01; // 칸 자리는 턱 오른쪽 끝에서 이만큼(서버 pusher_crane PILE_GAP과 같다)

export class PusherWorld extends MachineWorld {
  declare plate: RAPIER.RigidBody; // 부모 생성자의 buildBox에서 만든다(필드 초기화로 덮이지 않게 declare)

  // running: 코인을 넣은 판 — 판이 움직인다(앉히기 세계는 멈춤). phase: 판의 시각을 이만큼(초) 앞선 데서 시작(시험용, 판은 0 = 들어가 있음)
  private stopAt: number | null = null;
  constructor(R: Rapier, spots: DollSpot[], readonly running = false, readonly phase = 0) {
    super(R, spots, { dollScale: PUSHER.doll_scale });
    const p = this.plate.translation();
    this.plate.setTranslation({ x: p.x, y: p.y, z: this.front(0) - plateDepth() / 2 }, true); // 첫 걸음에 순간이동하지 않게
    this.saved = spots.filter((s) => s[2] !== null && restable({ x: s[1], z: s[3] })).map((s) => s[12]); // 칸 무더기만 — 턱 위 인형은 판이 밀어야 한다
  }

  // 앉은(저장된) 인형은 첫 걸음 뒤 재운다 — 칸 무더기 27개가 깨어 있으면 서로 조금씩 기며 휴대폰에서 겨누는 동안 40fps로 떨어졌다(라이브 점검).
  // 첫 걸음 전에 재우면 엔진이 처음 찾은 맞닿음으로 다시 깨운다. 움직이는 판(턱 위)·내려오는 집게가 닿은 인형은 엔진이 깨운다
  private saved: number[] | null = null;
  private sleepSaved(): void {
    if (!this.saved || this.time <= 0) return;
    for (const uid of this.saved) this.bodyOf(uid)?.sleep();
    this.saved = null;
  }

  protected buildBox(): void {
    const { ledge, plate, chute, house } = PUSHER, top = DOLL_FLOOR + ledge.h, f = DOLL_FLOOR - T;
    const [W, D] = MACHINE_SPEC.play_half, right = W + WALL_MARGIN, front = D + WALL_MARGIN, back = -front;
    const lw = ledge.x1 - ledge.x0, lx = (ledge.x0 + ledge.x1) / 2;
    // 칸 바닥(턱 오른쪽 전체, 벽까지)
    this.fixed((right - ledge.x1) / 2, T, front, (right + ledge.x1) / 2, f, 0);
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
    // 판은 집에서 나오는 덩어리: 깊이 = 앞판 두께 + 오가는 거리 — 가장 나와도 뒤끝이 집 안에 있어 판 뒤에 틈이 없다(인형이 끼어 판에 올라탔다)
    const deep = plateDepth();
    this.plate = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(lx - PLATE_INSET / 2, top + plate.h / 2, ledge.z0 - deep / 2));
    this.world.createCollider(R.ColliderDesc.cuboid(lw / 2 - 0.005 - PLATE_INSET / 2, plate.h / 2, deep / 2).setFriction(0.3).setRestitution(0), this.plate);
  }

  // 앉히기(채우기·처음 기계): 한 주기 동안 아무것도 3mm 넘게 안 움직일 때까지, 마지막 떨어뜨림 뒤 길어도 settle.max초 —
  // 인형 기계 기준(잠듦, 3초)으로는 판에 밀리는 중에 끝나 공중에 굳었다(최종 리뷰 I1). 상품 구멍이 없으니 '구멍 위 걸침'도 없다
  // 창은 판 한 주기(3초), 한도는 마지막 떨어뜨림 뒤 15초 — 놓은 뒤 기다리는 짧은 창·한도(settle.still 0.8초·max 8초)로는
  // 미니 인형 26개 무더기가 다 앉기 전에 기는 채로 저장했다(아무도 안 기다리는 앉히기라 길어도 된다)
  private quiet = new QuietWindow(PUSHER.plate.period);
  *settling(maxSeconds?: number): Generator<void, number, void> {
    this.quiet = new QuietWindow(PUSHER.plate.period);
    return yield* super.settling(Math.max(maxSeconds ?? 0, SETTLE_MAX));
  }

  protected settleBusy(): boolean {
    return !this.quiet.check(this.time, this.poses());
  }

  straddling(): number[] {
    return [];
  }

  // 출구로 빠진(앉히는 중) 인형을 다시 떨어뜨릴 자리: 칸(턱 오른쪽) 격자에서 다른 인형과 12cm 넘게 떨어진 첫 칸 — 턱·판 집 위로 가지 않게
  protected freeSpotAway(skip: number): [number, number] {
    const [W, D] = MACHINE_SPEC.play_half, cells: [number, number][] = [];
    for (let x = W; x >= PUSHER.ledge.x1 + PILE_GAP - 1e-9; x -= 0.08) for (let z = -D; z <= D + 1e-9; z += 0.08) cells.push([Math.round(x * 100) / 100, Math.round(z * 100) / 100]);
    const others = this.poses().filter((p) => p.uid !== skip).map((p) => p.p);
    return cells.find(([x, z]) => others.every((t) => Math.sqrt((t[0] - x) ** 2 + (t[2] - z) ** 2) >= 0.12)) ?? cells[0];
  }

  protected beforeStep(): void {
    this.sleepSaved();
    const p = this.plate.translation();
    this.plate.setNextKinematicTranslation({ x: p.x, y: p.y, z: this.front(this.time) - plateDepth() / 2 });
  }

  // 시각 t의 판 앞면: 움직이는 판이면 plateFront, 멈춘 뒤(stopAt)·안 움직이는 세계는 들어가 있음(z0)
  private front(t: number): number {
    if (!this.running || (this.stopAt !== null && t >= this.stopAt)) return PUSHER.ledge.z0;
    return plateFront(t + this.phase);
  }

  // 집게가 인형을 놓았다 — 판은 지금 왕복을 마치고(다음에 들어가는 때) 멈춘다
  afterRelease(): void {
    if (!this.running || this.stopAt !== null) return;
    const period = PUSHER.plate.period, t = this.time + this.phase;
    this.stopAt = Math.ceil(t / period - 1e-9) * period - this.phase;
  }

  plateMoving(): boolean {
    return this.running && (this.stopAt === null || this.time < this.stopAt);
  }

  // 미는 판 앞면 z — 그림
  plateZ(): number {
    return this.plate.translation().z + plateDepth() / 2;
  }

  plateDepth(): number {
    return plateDepth();
  }
}
