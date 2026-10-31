import * as THREE from 'three';
import { encodePose, type ClawPose, type DollPose, type Pose } from '../net/protocol';

// 구경꾼 중계 (물리 뽑기 설계 §4.5): 판을 하는 화면이 집게 자리·벌림과 움직이는 인형의 자리·돌림을 초당 10번 보내고,
// 받는 화면은 받은 자리 사이를 시간에 맞춰 이어 그린다(사람 움직임 보간과 같은 방식, 0.1초 늦게). 판이 끝나면 machine으로 맞춘다
export class PoseSender {
  private last = -Infinity;

  constructor(private send: (msg: string) => void, private hz = 10) {}

  frame(machineId: string, claw: { x: number; y: number; z: number; open: number }, moving: DollPose[], now: number): void {
    if (now - this.last < 1 / this.hz) return;
    this.last = now;
    this.send(encodePose(machineId, [claw.x, claw.y, claw.z, claw.open], moving));
  }
}

type Sample = { at: number; claw: ClawPose; dolls: Map<number, DollPose> };
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export class PoseReceiver {
  private prev: Sample | null = null;
  private next: Sample | null = null;
  private known = new Map<number, DollPose>(); // 마지막으로 받은 인형 자리 (이번 중계에 없는 인형은 그대로)

  constructor(private delay = 0.1) {}

  push(m: Pose, now: number): void {
    const dolls = new Map<number, DollPose>();
    for (const [uid, x, y, z, qx, qy, qz, qw] of m.d) { const p: DollPose = { uid, p: [x, y, z], q: [qx, qy, qz, qw] }; dolls.set(uid, p); this.known.set(uid, p); }
    this.prev = this.next;
    this.next = { at: now, claw: m.c, dolls };
  }

  sample(now: number): { claw: ClawPose; dolls: Map<number, DollPose> } {
    const t = now - this.delay;
    const out = new Map(this.known);
    if (!this.next) return { claw: [0, 0, 0, 0], dolls: out };
    const a = this.prev, b = this.next;
    if (!a || t >= b.at || b.at <= a.at) return { claw: b.claw, dolls: out };
    const k = Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at)));
    const claw = a.claw.map((v, i) => lerp(v, b.claw[i], k)) as ClawPose;
    for (const [uid, pb] of b.dolls) {
      const pa = a.dolls.get(uid);
      if (!pa) continue;
      qa.set(pa.q[0], pa.q[1], pa.q[2], pa.q[3]); qb.set(pb.q[0], pb.q[1], pb.q[2], pb.q[3]); qa.slerp(qb, k);
      out.set(uid, { uid, p: [lerp(pa.p[0], pb.p[0], k), lerp(pa.p[1], pb.p[1], k), lerp(pa.p[2], pb.p[2], k)], q: [qa.x, qa.y, qa.z, qa.w] });
    }
    return { claw, dolls: out };
  }
}
