import * as THREE from 'three';
import { encodePose, type ClawPose, type DollPose, type Pose } from '../net/protocol';

// 구경꾼 중계 (물리 뽑기 설계 §4.5): 판을 하는 화면이 집게 자리·벌림과 움직이는 인형의 자리·돌림을 초당 10번 재서, 0.4초마다 한 묶음으로 보낸다
// (매장으로 들어오는 메시지가 무료 한도 하루 10만 개 — 10개/초로 보내면 하루 15시간 몫뿐, 사용자 2026-11-02 '0.4초로'). 구경할 사람이
// 기계 가까이(WATCH_REACH) 없으면 아예 보내지 않는다. 받는 화면은 묶음 속 자리들을 각각의 시각에 놓고 0.5초 늦게 그 사이를 이어 그린다.
// 판이 끝나면 machine으로 맞춘다
type Pending = { at: number; c: ClawPose; d: DollPose[] };
export class PoseSender {
  private lastSample = -Infinity;
  private lastFlush = -Infinity;
  private pending: Pending[] = [];
  private machineId = '';

  constructor(private send: (msg: string) => void, private hz = 10, private batch = 0.4) {}

  frame(machineId: string, claw: { x: number; y: number; z: number; open: number }, moving: DollPose[], now: number, watched = true): void {
    this.machineId = machineId;
    if (!watched) { this.pending.length = 0; this.lastFlush = now; return; } // 보는 사람이 없는 동안의 자리는 버린다
    if (this.lastFlush === -Infinity) this.lastFlush = now;
    if (now - this.lastSample >= 1 / this.hz) {
      this.lastSample = now;
      this.pending.push({ at: now, c: [claw.x, claw.y, claw.z, claw.open], d: moving.map((x) => ({ uid: x.uid, p: [...x.p] as DollPose['p'], q: [...x.q] as DollPose['q'] })) });
    }
    if (now - this.lastFlush >= this.batch) this.flush(now);
  }

  // 모아 둔 자리를 지금 보낸다(판이 끝날 때 done보다 먼저 가게). 나이는 가장 새 자리 기준(0)
  flush(now: number): void {
    this.lastFlush = now;
    if (!this.pending.length) return;
    const newest = this.pending[this.pending.length - 1].at;
    this.send(encodePose(this.machineId, this.pending.map((p) => ({ age: newest - p.at, c: p.c, d: p.d }))));
    this.pending = [];
  }
}

type Sample = { at: number; claw: ClawPose; dolls: Map<number, DollPose> };
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export class PoseReceiver {
  private samples: Sample[] = []; // 시각 순
  private known = new Map<number, DollPose>(); // 마지막으로 받은 인형 자리 (이번 중계에 없는 인형은 그대로)

  constructor(private delay = 0.5) {}

  push(m: Pose, now: number): void {
    for (const [age, c, d] of m.f) {
      const dolls = new Map<number, DollPose>();
      for (const [uid, x, y, z, qx, qy, qz, qw] of d) { const p: DollPose = { uid, p: [x, y, z], q: [qx, qy, qz, qw] }; dolls.set(uid, p); this.known.set(uid, p); }
      this.samples.push({ at: now - age, claw: c, dolls });
    }
    this.samples.sort((a, b) => a.at - b.at);
  }

  sample(now: number): { claw: ClawPose; dolls: Map<number, DollPose> } {
    const t = now - this.delay;
    const out = new Map(this.known);
    if (!this.samples.length) return { claw: [0, 0, 0, 0], dolls: out };
    let i = 0;
    while (i + 1 < this.samples.length && this.samples[i + 1].at <= t) i++;
    if (i > 0) this.samples.splice(0, i); // 지난 자리는 버린다 — [0]은 t 이전의 마지막(또는 아직 안 온 첫 자리), [1]은 t 뒤의 첫 자리
    const a = this.samples[0], b = this.samples[1];
    if (!b || t <= a.at || b.at <= a.at) return { claw: a.claw, dolls: out };
    const k = Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at)));
    const claw = a.claw.map((v, j) => lerp(v, b.claw[j], k)) as ClawPose;
    for (const [uid, pb] of b.dolls) {
      const pa = a.dolls.get(uid);
      if (!pa) continue;
      qa.set(pa.q[0], pa.q[1], pa.q[2], pa.q[3]); qb.set(pb.q[0], pb.q[1], pb.q[2], pb.q[3]); qa.slerp(qb, k);
      out.set(uid, { uid, p: [lerp(pa.p[0], pb.p[0], k), lerp(pa.p[1], pb.p[1], k), lerp(pa.p[2], pb.p[2], k)], q: [qa.x, qa.y, qa.z, qa.w] });
    }
    return { claw, dolls: out };
  }
}
