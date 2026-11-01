import * as THREE from 'three';
import { PUSHER, PUSHERS, isPusher } from '../data/pushers';
import { encodeAct, type ItemWire, type PusherMsg } from '../net/protocol';
import { PUSHER_WORD, UI } from '../world/copy';
import { PUSH_BUTTON, buildPushButton, type PushButton, type PusherZone, type ShownItem } from '../world/pusherZone';
import { FinishWaits, type ButtonPlay } from './buttonPlay';

// 미는 뽑기 한 판(설계 2026-11-02 §4)의 화면 쪽: 판이 시작되면 미는 판이 선반 뒤에서 좌우로 오가고, '밀기'를 누른 순간(또는 시간이 다 되면)
// 그 자리 x를 act로 보낸다. 서버가 정한 결과(pusher 메시지)를 모두가 같은 밀기로 그린다 — 뒤에 새 인형이 떨어지고(미는 판은 그 자리로),
// 미는 판이 앞으로 나가며 인형이 전 자리에서 뒤 자리로 밀리고, 앞 끝을 넘은 인형은 출구로 떨어진다
const RESULT_WAIT = 8, DROP = 0.45, PUSH = 0.7, BACK = 0.45, DROP_H = 0.2, FALL_H = 0.3;
const SPOTS = new Map(PUSHERS.map((p) => [p.id, p]));
const RANGE = PUSHER.shelf.half_w - PUSHER.plate.half_w; // 미는 판 가운데가 갈 수 있는 x(서버 plate_range와 같음)
// 기계 좌표 [눈, 보는 점]: 선반을 조금 내려다보며 미는 판·인형·출구·버튼 '밀기'가 함께 들어오게. 휴대폰 세로는 화각이 좁아 조금 멀리
const POSES = { wide: [[0, 1.62, 1.35], [0, 0.98, 0.04]], tall: [[0, 1.78, 1.85], [0, 1.0, 0.04]] } as const;

const smooth = (t: number) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k); };

// 가운데에서 오른쪽으로 출발해 양 끝을 오가는 세모 물결
export function plateSweep(t: number): number {
  const w = RANGE * 2, s = (t * PUSHER.plate.sweep_speed + RANGE) % (2 * w);
  return -RANGE + (s < w ? s : 2 * w - s);
}

class PusherSession {
  x = 0;
  phase: 'ready' | 'pressed' | 'sent' = 'ready';
  constructor(readonly machineId: string, private limit: number, private startedAt: number) {}
  remaining(now: number): number { return this.limit - (now - this.startedAt); }
  update(now: number): 'push' | null {
    if (this.phase === 'sent') return null;
    if (this.phase === 'ready') this.x = plateSweep(now - this.startedAt);
    if (this.phase === 'pressed' || this.remaining(now) <= 0) { this.phase = 'sent'; return 'push'; }
    return null;
  }
}

type Anim = { id: string; seq: number; x: number; plateFrom: number; from: Map<number, ItemWire>; to: Map<number, ItemWire>; drop: ItemWire | null; fell: Set<number>; after: ItemWire[]; t: number; mine: boolean };

export type PusherPlayDeps = { send(msg: string): void; onDrop(machineId: string): void; onOverdue(): void };

export class PusherPlay implements ButtonPlay {
  session: PusherSession | null = null;
  readonly hint = UI.pusherHint;
  readonly prizeWord = PUSHER_WORD;
  private playId: string | null = null;
  private button: PushButton | null = null;
  private waitingSince: number | null = null;
  private anims = new Map<string, Anim>();
  private waits = new FinishWaits(3000 + (DROP + PUSH + BACK) * 1000);

  constructor(readonly zone: PusherZone, private deps: PusherPlayDeps) {}

  handles(id: string): boolean { return isPusher(id); }

  setShelves(shelves: Record<string, ItemWire[]>): void {
    for (const [id, items] of Object.entries(shelves)) if (SPOTS.has(id)) this.zone.setShelf(id, items);
  }

  start(id: string, limit: number, now: number): void {
    this.end();
    this.playId = id;
    this.session = new PusherSession(id, limit, now);
    this.button = buildPushButton(this.zone.worldOf(id));
    this.zone.hideControls(id, true);
  }

  pick(ray: THREE.Raycaster): 1 | 2 | null { return this.session?.phase === 'ready' && this.button ? this.button.pick(ray) : null; }

  // 누른 순간의 자리로 민다(보내기는 다음 프레임 — 누른 자리 그대로)
  press(button: 1 | 2): boolean {
    const s = this.session;
    if (button !== 1 || s?.phase !== 'ready') return false;
    s.phase = 'pressed';
    this.button?.setPressed(true);
    return true;
  }

  release(_button: 1 | 2, _now: number): void { this.button?.setPressed(false); }

  private push(now: number): void {
    const s = this.session!;
    this.button?.dispose(); this.button = null;
    this.zone.hideControls(s.machineId, false);
    this.zone.setPlate(s.machineId, s.x, 0);
    this.deps.send(encodeAct(s.machineId, s.x, 0));
    this.waitingSince = now;
    this.session = null;
    this.deps.onDrop(s.machineId);
  }

  // 서버가 정한 한 판 — 하는 사람·구경꾼 모두 같은 밀기
  onPusher(m: PusherMsg): void {
    if (!SPOTS.has(m.m)) return;
    const prev = this.anims.get(m.m);
    if (prev) this.settle(prev); // 앞 밀기가 덜 끝났으면 끝난 자리부터
    const from = new Map(this.zone.shelfOf(m.m).map((i) => [i[0], i] as const));
    this.anims.set(m.m, {
      id: m.m, seq: this.waits.arrived(m.m), x: m.x, plateFrom: this.zone.plateOf(m.m).x, from, to: new Map(m.items.map((i) => [i[0], i] as const)),
      drop: m.drop, fell: new Set(m.fell), after: m.items, t: 0, mine: m.m === this.playId,
    });
  }

  // result를 받은 그 자리에서 — 뒤따르는 밀기가 끝나면 결과 연출이 나오게. 밀기가 안 오면 대비 시계로 넘어간다
  finished(id: string): Promise<void> { return this.waits.wait(id); }

  private settle(a: Anim): void {
    this.zone.setShelf(a.id, a.after);
    this.zone.setPlate(a.id, a.x, 0);
    this.anims.delete(a.id);
    this.waits.finished(a.id, a.seq);
  }

  // 한 순간의 선반: 떨어지는 새 인형 → 밀리는 인형(전 자리 → 뒤 자리, 떨어질 인형은 앞 끝 너머로) → 떨어지는 인형
  private drawAnim(a: Anim): void {
    const t = a.t, push = t < DROP ? 0 : t < DROP + PUSH ? smooth((t - DROP) / PUSH) : 1 - smooth((t - DROP - PUSH) / BACK);
    this.zone.setPlate(a.id, a.plateFrom + (a.x - a.plateFrom) * smooth(t / DROP), push);
    const k = t < DROP ? 0 : smooth((t - DROP) / PUSH), fall = Math.max(0, t - DROP - PUSH) / BACK, shown: ShownItem[] = [];
    const starts = new Map(a.from);
    if (a.drop) starts.set(a.drop[0], a.drop);
    for (const [uid, s] of starts) {
      const to = a.to.get(uid), y = a.drop && uid === a.drop[0] ? DROP_H * (1 - Math.min(1, (t / DROP) ** 2)) : 0;
      if (to) shown.push({ item: to, x: s[4] + (to[4] - s[4]) * k, y, z: s[5] + (to[5] - s[5]) * k });
      else if (a.fell.has(uid)) {
        const edge = PUSHER.shelf.front_z + PUSHER.item.r;
        if (fall < 1) shown.push({ item: s, x: s[4], y: -FALL_H * fall * fall, z: s[5] + (Math.max(edge, s[5]) - s[5]) * k + 0.06 * fall });
      }
    }
    for (const [uid, to] of a.to) if (!starts.has(uid)) shown.push({ item: to, x: to[4], y: 0, z: to[5] }); // 화면이 몰랐던 인형은 제자리에
    this.zone.show(a.id, shown);
  }

  frame(dt: number, now: number): void {
    const s = this.session;
    if (s) {
      if (s.update(now) === 'push') this.push(now);
      else { this.button?.update(now); this.zone.setPlate(s.machineId, s.x, 0); }
    }
    if (this.waitingSince !== null && now - this.waitingSince > RESULT_WAIT) { this.waitingSince = null; this.deps.onOverdue(); }
    for (const a of this.anims.values()) {
      a.t += dt;
      if (a.t >= DROP + PUSH + BACK) this.settle(a);
      else this.drawAnim(a);
    }
  }

  cycling(): boolean { return !!this.playId && (this.waitingSince !== null || !!this.anims.get(this.playId)?.mine); }

  resulted(id: string): void { if (id === this.playId) this.waitingSince = null; }

  refused(id: string): void { this.resulted(id); }

  end(): void {
    this.button?.dispose(); this.button = null;
    if (this.playId) { this.zone.hideControls(this.playId, false); if (!this.anims.has(this.playId)) this.zone.setPlate(this.playId, this.zone.plateOf(this.playId).x, 0); }
    this.session = null; this.playId = null; this.waitingSince = null;
  }

  cameraPose(id: string, _now: number, aspect: number) {
    const spot = SPOTS.get(id)!, [eye, look] = aspect < 1 ? POSES.tall : POSES.wide;
    const place = (p: readonly number[]) => new THREE.Vector3(p[0], p[1], p[2]).applyAxisAngle(new THREE.Vector3(0, 1, 0), spot.ry).add(new THREE.Vector3(spot.x, 0, spot.z));
    return { pos: place(eye), look: place(look) };
  }

  buttonAt(button: 1 | 2, camera: THREE.Camera): { x: number; y: number } | null {
    if (!this.session || button !== 1) return null;
    const [x, y, z] = PUSH_BUTTON;
    const p = this.zone.worldOf(this.session.machineId).localToWorld(new THREE.Vector3(x, y + 0.02, z)).project(camera);
    return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
  }
}
