import type RAPIER from '@dimforge/rapier3d-deterministic-compat';
import * as THREE from 'three';
import { CLAW } from '../data/claw';
import { MACHINE_SPEC } from '../data/storeLayout';
import type { DollPose, DollSpot } from '../net/protocol';
import type { Hit } from '../world/dolls';
import { DOLL_FLOOR, DOLL_SCALE } from '../world/machine';
import { ANGULAR_DAMPING, FRICTION, LINEAR_DAMPING, RESTITUTION, dollColliders, type Ball } from './dollBody';
import type { Rapier } from './rapier';

export type { Rapier };
type Body = RAPIER.RigidBody;

// 기계 속 물리 세계 (물리 뽑기 설계 §4.1·§4.2·§9.1·§9.2): 기계 안 좌표(dollPose와 같음, 바닥 y = DOLL_FLOOR).
// 고정 간격 1/120초, 한 번에 최대 4번(넘치면 버림). 상자(바닥·벽·천장), 구멍(네모)과 턱, 아무도 하지 않을 때 구멍을 덮는 뚜껑.
// 안 앉은 인형(y null)은 천장에서 번호 순서로 0.25초 간격으로 떨어진다 — 같은 입력이면 어느 화면에서든 같은 결과(결정성)
export const STEP = 1 / 120, MAX_STEPS = 4;
// 충돌 그룹: 인형 0x0001, 노린 인형 0x0002, 손가락 끝 0x0004 (clawBody). 쌍은 (A.소속 & B.필터) && (B.소속 & A.필터)일 때 부딪힌다
export const GROUP_DOLL = 0x0001, GROUP_TARGET = 0x0002, GROUP_TIP = 0x0004, ALL = 0xffff;
export const groups = (membership: number, filter: number) => ((membership << 16) | filter) >>> 0;
export const WALL_MARGIN = 0.12; // 놀이 영역(집게가 가는 범위)보다 벽이 이만큼 밖
const CEILING = 2.2, DROP_GAP = 0.25, DROP_CLEAR = 0.03; // 떨어뜨리는 높이 = 천장 − 그 인형의 키 − 여유 (키 큰 인형이 천장에 끼지 않게, 최종 리뷰 C2)
const FALL_DEPTH = 0.15; // 구멍 바닥보다 이만큼 아래면 빠진 것
const CATCH_Y = 0.3; // 빠진 인형이 끝없이 떨어지지 않게 받는 바닥
const SKIN = 0.0; // 콜라이더 여유 (0이면 모양 그대로)
const REDROP_GAP = 0.2;
const HOLE_HALF = CLAW.hole.size / 2;
const STRADDLE_ROUNDS = 3; // 걸친 인형을 다시 떨어뜨리는 횟수 한도 (먼 칸으로 가니 보통 한 번이면 된다)
const REFILL_SETTLE = 6; // 채우기 앉히기: 마지막 인형이 떨어진 뒤 이만큼(물리 시간) — 무더기는 5초쯤 걸린다
const CONTACT_HZ = 12; // 접촉 강성(기본 30Hz): 봉제 인형은 푹신해서 쇠 집게에 맞아도 튕겨 나가지 않는다 — 30Hz면 2.3m/s로 튕기고, 8Hz는 무더기가 앉는 데 7초가 걸린다
// 손가락 끝에 바닥으로 눌렸다 풀린 인형이 다시 펴지는 속도 한도(m/s)·시간(초): 그대로 두면 눌린 만큼 접촉이 밀어 내 0.8m/s 넘게 튀어 올랐다 (인형 리뉴얼, 앞으로 나온 발)
const CUSHION_V = 0.3, CUSHION_SECONDS = 0.25, NEIGHBOR_GAP = 0.01; // 맞닿음으로 치는 틈(m)
const STILL_V = 0.02, STILL_W = 0.1; // 이보다 느리면 멈춘 것 (m/s, rad/s) — 무더기 속 인형은 아주 천천히 기어 오래 안 잠든다 // 채우기 중 구멍에 빠진 인형을 다시 떨어뜨릴 때 다른 인형과 띄우는 거리

export class MachineWorld {
  readonly world: RAPIER.World;
  time = 0;
  private carry = 0;
  private bodies = new Map<number, Body>();
  private spots = new Map<number, DollSpot>();
  private pending: { uid: number; at: number }[] = [];
  private holeOpen = false;
  private cushions = new Map<number, number>(); // 천천히 펴지는 인형 → 끝나는 시각
  private target: number | null = null;
  private redroppedAt = -Infinity; // 마지막으로 다시 떨어뜨린 시각 (앉히기 한도를 그때부터 다시 센다)
  private dropped = new Set<number>(); // 이번 세계에서 채우기로 떨어뜨린 인형 — 구멍 위 걸침 규칙은 이들에게만 (판에서 밀려 간 인형은 그대로, 사용자 결정)

  readonly dollScale: number;

  constructor(readonly R: Rapier, spots: DollSpot[], opts: { dollScale?: number } = {}) {
    this.dollScale = opts.dollScale ?? DOLL_SCALE;
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = STEP;
    this.world.integrationParameters.contact_natural_frequency = CONTACT_HZ;
    this.buildBox();
    let drops = 0;
    for (const s of [...spots].sort((a, b) => a[12] - b[12])) {
      const uid = s[12];
      this.spots.set(uid, s);
      if (s[2] === null) {
        const [x, z] = this.inside(s, s[1], s[3]);
        const body = this.addDoll(s, [x, this.dropHeight(s), z], [0, 0, 0, 1]);
        body.setEnabled(false);
        this.pending.push({ uid, at: drops * DROP_GAP });
        this.dropped.add(uid);
        drops++;
      } else this.addDoll(s, [s[1], s[2], s[3]], [s[4], s[5], s[6], s[7]]);
    }
    this.setHoleOpen(false);
  }

  // 그 인형을 떨어뜨릴 원점 높이: 천장 아래로 인형 키만큼 (원점은 발)
  // 떨어뜨리는 자리(돌림 없음)를 그 인형의 폭만큼 벽 안쪽으로 — 벽에 박힌 채 떨어뜨리면 마찰로 걸려 떨어뜨리는 높이(1.8m)에서 잠들었다
  // (라이브 C-4·C-7: 옛 모양으로 벽에 기댄 자리를 새 모양으로 다시 떨어뜨림)
  private inside(spot: DollSpot, x: number, z: number): [number, number] {
    const shapes = dollColliders(spot, this.dollScale).shapes, [W, D] = MACHINE_SPEC.play_half;
    const w = W + WALL_MARGIN - DROP_CLEAR - Math.max(...shapes.map((b) => Math.abs(b.at[0]) + b.r));
    const d = D + WALL_MARGIN - DROP_CLEAR - Math.max(...shapes.map((b) => Math.abs(b.at[2]) + b.r));
    return [Math.min(Math.max(x, -w), w), Math.min(Math.max(z, -d), d)];
  }

  private dropHeight(spot: DollSpot): number {
    const top = Math.max(...dollColliders(spot, this.dollScale).shapes.map((b) => b.at[1] + b.r));
    return CEILING - top - DROP_CLEAR;
  }

  protected fixed(hx: number, hy: number, hz: number, x: number, y: number, z: number): RAPIER.Collider {
    return this.world.createCollider(this.R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(FRICTION).setRestitution(0));
  }

  // 기계 속 바닥·벽(미는 뽑기는 덮어써 턱·미는 판·출구를 짓는다 — 부모 생성자 안에서 불리니 자식 필드 대신 모듈 값을 쓴다)
  protected buildBox(): void {
    const [W, D] = MACHINE_SPEC.play_half, [hx, hz] = MACHINE_SPEC.hole, half = CLAW.hole.size / 2;
    const w = W + WALL_MARGIN, d = D + WALL_MARGIN, t = 0.05, f = DOLL_FLOOR - t;
    // 바닥: 구멍 네모를 뺀 네 조각
    this.fixed((hx - half + w) / 2, t, d, (hx - half - w) / 2, f, 0); // 왼쪽 띠
    this.fixed((w - (hx + half)) / 2, t, d, (w + hx + half) / 2, f, 0); // 오른쪽 띠
    this.fixed(half, t, (hz - half + d) / 2, hx, f, (hz - half - d) / 2); // 안쪽 띠
    this.fixed(half, t, (d - (hz + half)) / 2, hx, f, (d + hz + half) / 2); // 앞쪽 띠
    // 구멍 턱 (네 변), 벽 넷, 천장, 받는 바닥
    const lip = CLAW.hole.lip, ly = DOLL_FLOOR + lip / 2, lt = 0.008;
    this.fixed(lt, lip / 2, half + lt, hx - half - lt, ly, hz); this.fixed(lt, lip / 2, half + lt, hx + half + lt, ly, hz);
    this.fixed(half + lt, lip / 2, lt, hx, ly, hz - half - lt); this.fixed(half + lt, lip / 2, lt, hx, ly, hz + half + lt);
    this.buildWalls();
  }

  // 벽 넷·천장·받는 바닥(빠진 인형을 멈춤)
  protected buildWalls(): void {
    const [W, D] = MACHINE_SPEC.play_half, w = W + WALL_MARGIN, d = D + WALL_MARGIN, t = 0.05, f = DOLL_FLOOR - t;
    const H = (CEILING - f) / 2, cy = f + H;
    this.fixed(t, H, d + t, -w - t, cy, 0); this.fixed(t, H, d + t, w + t, cy, 0);
    this.fixed(w + t, H, t, 0, cy, -d - t); this.fixed(w + t, H, t, 0, cy, d + t);
    this.fixed(w + t, t, d + t, 0, CEILING + t, 0);
    this.fixed(w + 0.5, t, d + 0.5, 0, CATCH_Y - t, 0);
  }

  private addDoll(spot: DollSpot, p: [number, number, number], q: [number, number, number, number]): Body {
    const { shapes, mass } = dollColliders(spot, this.dollScale);
    const desc = this.R.RigidBodyDesc.dynamic().setTranslation(p[0], p[1], p[2]).setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] })
      .setAngularDamping(ANGULAR_DAMPING).setLinearDamping(LINEAR_DAMPING).setCanSleep(true);
    const body = this.world.createRigidBody(desc);
    const volume = shapes.reduce((v, s) => v + (4 / 3) * Math.PI * s.r ** 3, 0);
    for (const s of shapes) {
      this.world.createCollider(
        this.R.ColliderDesc.ball(s.r + SKIN).setTranslation(s.at[0], s.at[1], s.at[2]).setDensity(mass / volume).setFriction(FRICTION).setRestitution(RESTITUTION)
          .setCollisionGroups(groups(GROUP_DOLL, ALL)),
        body,
      );
    }
    this.bodies.set(spot[12], body);
    return body;
  }

  // 세계 한 걸음 전(미는 뽑기: 미는 판을 그 시각 자리로)
  protected beforeStep(): void {}

  // 한 걸음(1/120초)씩, 한 번에 최대 4번 — 남은 시간은 다음 프레임으로
  step(dt: number): void {
    this.carry += dt;
    let n = 0;
    while (this.carry >= STEP && n < MAX_STEPS) { this.tick(); this.carry -= STEP; n++; }
    if (n === MAX_STEPS) this.carry = 0; // 긴 프레임의 남은 시간은 버린다 — 밀린 걸 따라잡으려다 더 느려지지 않게
  }

  private tick(): void {
    for (const p of this.pending) if (p.at <= this.time) this.bodies.get(p.uid)?.setEnabled(true);
    this.pending = this.pending.filter((p) => p.at > this.time);
    this.beforeStep();
    this.world.step();
    this.time += STEP;
    this.softenCushions();
    if (!this.holeOpen) this.redropFallen();
  }

  // 손가락 끝에 눌려 있다 풀린 인형들 — 잠깐 동안 CUSHION_V보다 빨리 움직이지 않는다. 노린 인형은 끝에 눌리지 않으니(충돌 그룹) 뺀다.
  // 눌린 인형에 맞닿은 옆 인형도 함께 — 눌린 인형이 옆 인형을 짜내듯 밀어 1.2m/s로 튀어 나갔다(구멍·기계를 키운 뒤 시험 배치에서, 2026-11-02)
  cushion(uids: number[]): void {
    const until = this.time + CUSHION_SECONDS, pressed = uids.filter((uid) => uid !== this.target && this.bodies.has(uid));
    for (const uid of pressed) this.cushions.set(uid, until);
    if (!pressed.length) return;
    const near = pressed.map((uid) => this.balls(uid));
    for (const uid of this.bodies.keys()) {
      if (uid === this.target || pressed.includes(uid)) continue;
      const mine = this.balls(uid);
      if (near.some((bs) => bs.some((a) => mine.some((b) => a.c.distanceTo(b.c) < a.r + b.r + NEIGHBOR_GAP)))) this.cushions.set(uid, until);
    }
  }

  private softenCushions(): void {
    for (const [uid, until] of this.cushions) {
      const b = this.bodies.get(uid);
      if (!b || this.time > until) { this.cushions.delete(uid); continue; }
      const v = b.linvel(), s = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); // Math.hypot은 엔진마다 끝자리가 다를 수 있다 — 결정성
      if (s > CUSHION_V) b.setLinvel({ x: (v.x * CUSHION_V) / s, y: (v.y * CUSHION_V) / s, z: (v.z * CUSHION_V) / s }, true);
    }
  }

  // 모두 잠들 때까지 돌리고 쓴 초를 돌려준다 — 한도(maxSeconds)는 마지막 인형이 떨어진 뒤부터 센다 (최종 리뷰 I9)
  settle(maxSeconds = REFILL_SETTLE): number {
    const run = this.settling(maxSeconds);
    let r = run.next();
    while (!r.done) r = run.next();
    return r.value;
  }

  // settle()을 한 걸음씩: 화면이 프레임마다 조금씩 돌린다(기계 하나를 한 프레임에 다 앉히면 50~150ms 멈칫했다, 사용자 2026-11-01).
  // 걸음 순서는 settle()과 같아 앉힌 자리도 같다
  *settling(maxSeconds = REFILL_SETTLE): Generator<void, number, void> {
    const from = this.time;
    // 끝나는 기준은 엔진의 잠듦(참된 멈춤) — 중계용 속도 문턱(still)으로 끊으면 기어가는 중에 앉힌 자리가 적힌다
    const awake = () => [...this.bodies.values()].some((b) => b.isEnabled() && !b.isSleeping());
    let lastDrop = this.pending.reduce((t, p) => Math.max(t, p.at), from);
    // 구멍에 빠져 천장 아래로 옮긴 인형이 있으면 그때부터 다시 센다 — 한도 직전에 빠진 인형이 공중에 멈춘 채 굳었다(라이브 C-4·C-7).
    // 몇 번이고 빠지는 일에 대비해 전체 한도는 네 배
    const hardStop = lastDrop + maxSeconds * 4;
    const until = () => Math.min(Math.max(lastDrop, this.redroppedAt) + maxSeconds, hardStop);
    for (let round = 0; ; round++) {
      while (this.time < until() && (this.pending.length > 0 || awake())) { this.tick(); yield; }
      // 채우기로 떨어진 인형이 구멍 위에 걸쳤으면(거저 뽑기) 구멍에서 먼 빈 칸에 다시 떨어뜨리고 더 앉힌다
      const over = this.straddling();
      if (!over.length || round >= STRADDLE_ROUNDS) break;
      for (const uid of over) this.redrop(uid, this.bodies.get(uid)!);
      lastDrop = this.time;
    }
    for (const b of this.bodies.values()) if (b.isEnabled()) b.sleep(); // 한도에 걸려 아직 흔들리는 인형은 그 자리에 재운다 — 앉힌 자리는 여기서 굳는다
    return this.time - from;
  }

  private pose(uid: number, body: Body): DollPose {
    const t = body.translation(), r = body.rotation();
    return { uid, p: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w] };
  }

  poses(): DollPose[] {
    return [...this.bodies].map(([uid, b]) => this.pose(uid, b));
  }

  // 아직 움직이는 인형: 엔진의 잠듦이 아니라 속도로 본다 (무더기 속 인형은 미세하게 떨며 오래 안 잠든다). 멈춘 인형은 settle()이 재운다
  movingPoses(): DollPose[] {
    return [...this.bodies].filter(([, b]) => b.isEnabled() && !this.still(b)).map(([uid, b]) => this.pose(uid, b));
  }

  private still(b: Body): boolean {
    if (b.isSleeping()) return true;
    const v = b.linvel(), w = b.angvel();
    return Math.hypot(v.x, v.y, v.z) < STILL_V && Math.hypot(w.x, w.y, w.z) < STILL_W;
  }

  // 구멍은 늘 뚫려 있다(막으면 그 위에 앉은 인형이 다음 판에 거저 빠진다). 대신 아무도 하지 않을 때(채우기) 빠진 인형은
  // 구멍 반대쪽으로 옮겨 다시 떨어뜨린다 — 같은 입력이면 같은 결과 (설계 §9.1의 "뚜껑"을 이렇게 푼다)
  setHoleOpen(open: boolean): void {
    this.holeOpen = open;
  }

  // 다시 떨어뜨릴 자리: 구멍에서 먼 순서로 격자를 훑어 다른 인형과 20cm 넘게 떨어진 첫 칸 (없으면 가장 먼 칸)
  private freeSpotAway(skip: number): [number, number] {
    const [hx, hz] = MACHINE_SPEC.hole, [W, D] = MACHINE_SPEC.play_half;
    const cells: [number, number][] = [];
    for (let x = -W; x <= W + 1e-9; x += 0.1) for (let z = -D; z <= D + 1e-9; z += 0.1) cells.push([Math.round(x * 100) / 100, Math.round(z * 100) / 100]);
    cells.sort((a, b) => Math.hypot(b[0] - hx, b[1] - hz) - Math.hypot(a[0] - hx, a[1] - hz));
    const others = [...this.bodies].filter(([uid]) => uid !== skip).map(([, b]) => b.translation());
    return cells.find(([x, z]) => others.every((t) => Math.hypot(t.x - x, t.z - z) >= REDROP_GAP)) ?? cells[0];
  }

  private redropFallen(): void {
    for (const [uid, b] of this.bodies) if (b.translation().y < DOLL_FLOOR - FALL_DEPTH) this.redrop(uid, b);
  }

  private redrop(uid: number, b: Body): void {
    this.redroppedAt = this.time;
    const spot = this.spots.get(uid)!, [x, z] = this.inside(spot, ...this.freeSpotAway(uid));
    b.setTranslation({ x, y: this.dropHeight(spot), z }, true);
    b.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.dropped.add(uid);
  }

  // 구멍 위에 걸친 인형(채우기로 떨어진 것만): 바닥 위 몸 공의 중심이 하나라도 구멍 네모 안
  straddling(): number[] {
    const [hx, hz] = MACHINE_SPEC.hole;
    return [...this.dropped].filter((uid) => {
      const b = this.bodies.get(uid);
      return !!b && b.isEnabled() && this.balls(uid).some((h) => h.c.y >= DOLL_FLOOR && Math.abs(h.c.x - hx) < HOLE_HALF && Math.abs(h.c.z - hz) < HOLE_HALF);
    }).sort((a, b) => a - b);
  }

  isHoleOpen(): boolean {
    return this.holeOpen;
  }

  // 바닥보다 아래로 떨어진 인형 번호 — 구멍 말고는 내려갈 길이 없다 (빠진 뒤 받는 바닥에서 굴러가도 센다)
  fallen(): number[] {
    return [...this.bodies].filter(([, b]) => b.translation().y < DOLL_FLOOR - FALL_DEPTH).map(([uid]) => uid);
  }

  // 노린 인형은 손가락 끝에 밀리지 않는다 (손가락 끝 콜라이더의 필터가 GROUP_TARGET을 뺀다) — 내려가다 쳐서 넘어뜨리지 않게. 허브는 민다
  markTarget(uid: number | null): void {
    this.target = uid;
    for (const [id, b] of this.bodies) {
      const g = groups(id === uid ? GROUP_TARGET : GROUP_DOLL, ALL);
      for (let i = 0; i < b.numColliders(); i++) b.collider(i).setCollisionGroups(g);
    }
  }

  bodyOf(uid: number): Body | undefined {
    return this.bodies.get(uid);
  }

  spotOf(uid: number): DollSpot | undefined {
    return this.spots.get(uid);
  }

  uids(): number[] {
    return [...this.bodies.keys()];
  }

  // 그 인형의 부위 공들(세계 좌표) — 집게가 닿는지 재는 데 쓴다
  balls(uid: number): Hit[] {
    const b = this.bodies.get(uid);
    if (!b) return [];
    const out: Hit[] = [];
    for (let i = 0; i < b.numColliders(); i++) { const c = b.collider(i), t = c.translation(); out.push({ c: new THREE.Vector3(t.x, t.y, t.z), r: c.radius() }); }
    return out;
  }

  remove(uid: number): void {
    const b = this.bodies.get(uid);
    if (b) { this.world.removeRigidBody(b); this.bodies.delete(uid); this.spots.delete(uid); }
    this.pending = this.pending.filter((p) => p.uid !== uid);
  }

  // 몸이 다른 인형 공을 파고든 쌍의 수 (확인용): 중심 거리 < 반지름 합 − 2cm
  overlaps(): number {
    const balls: { uid: number; c: [number, number, number]; r: number }[] = [];
    for (const [uid, b] of this.bodies) {
      for (let i = 0; i < b.numColliders(); i++) {
        const c = b.collider(i), t = c.translation(), r = c.radius();
        balls.push({ uid, c: [t.x, t.y, t.z], r });
      }
    }
    let n = 0;
    for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b = balls[j];
      if (a.uid === b.uid) continue;
      const d = Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1], a.c[2] - b.c[2]);
      if (d < a.r + b.r - 0.02) n++;
    }
    return n;
  }

  dispose(): void {
    this.world.free();
    this.bodies.clear();
  }
}

export type { Ball };
