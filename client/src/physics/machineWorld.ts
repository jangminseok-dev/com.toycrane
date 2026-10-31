import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { CLAW } from '../data/claw';
import { MACHINE_SPEC } from '../data/storeLayout';
import type { DollPose, DollSpot } from '../net/protocol';
import type { Hit } from '../world/dolls';
import { DOLL_FLOOR } from '../world/machine';
import { ANGULAR_DAMPING, FRICTION, LINEAR_DAMPING, RESTITUTION, dollColliders, type Ball } from './dollBody';
import type { Rapier } from './rapier';

export type { Rapier };
type Body = RAPIER.RigidBody;

// 기계 속 물리 세계 (물리 뽑기 설계 §4.1·§4.2·§9.1·§9.2): 기계 안 좌표(dollPose와 같음, 바닥 y = DOLL_FLOOR).
// 고정 간격 1/120초, 한 번에 최대 4번(넘치면 버림). 상자(바닥·벽·천장), 구멍(네모)과 턱, 아무도 하지 않을 때 구멍을 덮는 뚜껑.
// 안 앉은 인형(y null)은 천장에서 번호 순서로 0.25초 간격으로 떨어진다 — 같은 입력이면 어느 화면에서든 같은 결과(결정성)
export const STEP = 1 / 120, MAX_STEPS = 4;
const WALL_MARGIN = 0.12; // 놀이 영역(집게가 가는 범위)보다 벽이 이만큼 밖
const CEILING = 2.2, DROP_Y = 1.9, DROP_GAP = 0.25;
const FALL_DEPTH = 0.15; // 구멍 바닥보다 이만큼 아래면 빠진 것
const CATCH_Y = 0.3; // 빠진 인형이 끝없이 떨어지지 않게 받는 바닥
const SKIN = 0.0; // 콜라이더 여유 (0이면 모양 그대로)
const LID_H = 0.1; // 뚜껑 고깔 높이

export class MachineWorld {
  readonly world: RAPIER.World;
  time = 0;
  private carry = 0;
  private bodies = new Map<number, Body>();
  private spots = new Map<number, DollSpot>();
  private pending: { uid: number; at: number }[] = [];
  private lid: RAPIER.Collider | null = null;
  private holeOpen = false;

  constructor(readonly R: Rapier, spots: DollSpot[]) {
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = STEP;
    this.buildBox();
    let drops = 0;
    for (const s of [...spots].sort((a, b) => a[12] - b[12])) {
      const uid = s[12];
      this.spots.set(uid, s);
      if (s[2] === null) {
        const body = this.addDoll(s, [s[1], DROP_Y, s[3]], [0, 0, 0, 1]);
        body.setEnabled(false);
        this.pending.push({ uid, at: drops * DROP_GAP });
        drops++;
      } else this.addDoll(s, [s[1], s[2], s[3]], [s[4], s[5], s[6], s[7]]);
    }
    this.setHoleOpen(false);
  }

  private fixed(hx: number, hy: number, hz: number, x: number, y: number, z: number): RAPIER.Collider {
    return this.world.createCollider(this.R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(FRICTION).setRestitution(0));
  }

  private buildBox(): void {
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
    const H = (CEILING - f) / 2, cy = f + H;
    this.fixed(t, H, d + t, -w - t, cy, 0); this.fixed(t, H, d + t, w + t, cy, 0);
    this.fixed(w + t, H, t, 0, cy, -d - t); this.fixed(w + t, H, t, 0, cy, d + t);
    this.fixed(w + t, t, d + t, 0, CEILING + t, 0);
    this.fixed(w + 0.5, t, d + 0.5, 0, CATCH_Y - t, 0);
  }

  private addDoll(spot: DollSpot, p: [number, number, number], q: [number, number, number, number]): Body {
    const { shapes, mass } = dollColliders(spot);
    const desc = this.R.RigidBodyDesc.dynamic().setTranslation(p[0], p[1], p[2]).setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] })
      .setAngularDamping(ANGULAR_DAMPING).setLinearDamping(LINEAR_DAMPING).setCanSleep(true);
    const body = this.world.createRigidBody(desc);
    const volume = shapes.reduce((v, s) => v + (4 / 3) * Math.PI * s.r ** 3, 0);
    for (const s of shapes) {
      this.world.createCollider(
        this.R.ColliderDesc.ball(s.r + SKIN).setTranslation(s.at[0], s.at[1], s.at[2]).setDensity(mass / volume).setFriction(FRICTION).setRestitution(RESTITUTION),
        body,
      );
    }
    this.bodies.set(spot[12], body);
    return body;
  }

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
    this.world.step();
    this.time += STEP;
  }

  // 모두 잠들 때까지(최대 maxSeconds) 돌리고 쓴 초를 돌려준다
  settle(maxSeconds = CLAW.settle_seconds): number {
    const from = this.time;
    while (this.time - from < maxSeconds && (this.pending.length > 0 || this.movingPoses().length > 0)) this.tick();
    return this.time - from;
  }

  private pose(uid: number, body: Body): DollPose {
    const t = body.translation(), r = body.rotation();
    return { uid, p: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w] };
  }

  poses(): DollPose[] {
    return [...this.bodies].map(([uid, b]) => this.pose(uid, b));
  }

  movingPoses(): DollPose[] {
    return [...this.bodies].filter(([, b]) => b.isEnabled() && !b.isSleeping()).map(([uid, b]) => this.pose(uid, b));
  }

  // 뚜껑은 미끄러운 고깔 — 인형이 그 위에 앉지 못하고 굴러 내려와야 다음 판에 거저 빠지는 일이 없다 (설계 §9.1)
  setHoleOpen(open: boolean): void {
    this.holeOpen = open;
    if (open && this.lid) { this.world.removeCollider(this.lid, true); this.lid = null; }
    if (!open && !this.lid) {
      const [hx, hz] = MACHINE_SPEC.hole, half = CLAW.hole.size / 2;
      this.lid = this.world.createCollider(this.R.ColliderDesc.cone(LID_H / 2, half * 1.08).setTranslation(hx, DOLL_FLOOR + LID_H / 2 - 0.01, hz).setFriction(0).setRestitution(0));
    }
  }

  isHoleOpen(): boolean {
    return this.holeOpen;
  }

  // 바닥보다 아래로 떨어진 인형 번호 — 구멍 말고는 내려갈 길이 없다 (빠진 뒤 받는 바닥에서 굴러가도 센다)
  fallen(): number[] {
    return [...this.bodies].filter(([, b]) => b.translation().y < DOLL_FLOOR - FALL_DEPTH).map(([uid]) => uid);
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
