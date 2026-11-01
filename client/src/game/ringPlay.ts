import * as THREE from 'three';
import { RING, RINGS, isRing, pegXY } from '../data/rings';
import { encodeAct, type CardWire, type RingMsg } from '../net/protocol';
import { FIGURE_CONTROLS, buildFigureControls, type FigureControls } from '../world/figureControls';
import { RING_BUTTONS, RING_WORD, UI } from '../world/copy';
import type { RingZone } from '../world/ringZone';
import type { ButtonPlay } from './buttonPlay';
import { figureCameraPose } from './figureCamera';

// 고리 뽑기 한 판(설계 2026-11-02 §3)의 화면 쪽: 조작대 버튼 ①(오른쪽)·②(위로) → ②를 떼면(또는 시간이 다 되면) 멈춘 자리를 act로 보내고,
// 서버가 정한 결과(ring 메시지)를 모두가 같은 찌르기로 그린다 — 갈고리가 구멍판 쪽으로 쑥 들어갔다 나오고, 걸려서 빠지면 카드가 출구로 날아간다
const RESULT_WAIT = 8, POKE_IN = 0.35, POKE_HOLD = 0.25, POKE_OUT = 0.35, FLY = 0.8, HOME = 0.6;
const SPOTS = new Map(RINGS.map((r) => [r.id, r]));

type Phase = 'one' | 'moving-one' | 'two' | 'moving-two' | 'sent';
class RingSession {
  x: number = RING.hook.home[0];
  y: number = RING.hook.home[1];
  phase: Phase = 'one';
  constructor(readonly machineId: string, private limit: number, private startedAt: number) {}
  remaining(now: number): number { return this.limit - (now - this.startedAt); }
  press(b: 1 | 2): boolean {
    if (b === 1 && this.phase === 'one') { this.phase = 'moving-one'; return true; }
    if (b === 2 && this.phase === 'two') { this.phase = 'moving-two'; return true; }
    return false;
  }
  release(b: 1 | 2): 'poke' | null {
    if (b === 1 && this.phase === 'moving-one') this.phase = 'two';
    if (b === 2 && this.phase === 'moving-two') { this.phase = 'sent'; return 'poke'; }
    return null;
  }
  update(dt: number, now: number): 'poke' | null {
    if (this.phase === 'sent') return null;
    const v = RING.hook.speed * dt;
    if (this.phase === 'moving-one') this.x = Math.min(RING.hook.x[1], this.x + v);
    if (this.phase === 'moving-two') this.y = Math.min(RING.hook.y[1], this.y + v);
    if (this.remaining(now) <= 0) { this.phase = 'sent'; return 'poke'; }
    return null;
  }
}

type Anim = { id: string; x: number; y: number; peg: number; caught: boolean; card: CardWire | null; pegs: CardWire[]; t: number; mine: boolean };

export type RingPlayDeps = { send(msg: string): void; onDrop(machineId: string): void; onOverdue(): void };

export class RingPlay implements ButtonPlay {
  session: RingSession | null = null;
  readonly hint = UI.ringHint;
  readonly prizeWord = RING_WORD;
  private playId: string | null = null;
  private controls: FigureControls | null = null;
  private waitingSince: number | null = null;
  private anims = new Map<string, Anim>();
  private waiters = new Map<string, (() => void)[]>();
  private homing = new Map<string, { from: [number, number]; t: number }>();

  constructor(readonly zone: RingZone, private deps: RingPlayDeps) {}

  handles(id: string): boolean { return isRing(id); }

  setBoards(boards: Record<string, CardWire[]>): void {
    for (const [id, cards] of Object.entries(boards)) if (SPOTS.has(id)) this.zone.setBoard(id, cards);
  }

  start(id: string, limit: number, now: number): void {
    this.end();
    this.playId = id;
    this.session = new RingSession(id, limit, now);
    this.controls = buildFigureControls(this.zone.worldOf(id), RING_BUTTONS);
    this.controls.setPhase('one');
    this.zone.hideControls(id, true);
  }

  pick(ray: THREE.Raycaster): 1 | 2 | null { return this.session && this.controls ? this.controls.pick(ray) : null; }

  press(button: 1 | 2): boolean {
    if (!this.session?.press(button)) return false;
    this.controls?.setPressed(button);
    return true;
  }

  release(button: 1 | 2, now: number): void {
    const s = this.session;
    if (!s) return;
    this.controls?.setPressed(null);
    const r = s.release(button);
    this.controls?.setPhase(s.phase === 'two' || s.phase === 'moving-two' ? 'two' : 'one');
    if (r === 'poke') this.poke(now);
  }

  private poke(now: number): void {
    const s = this.session!;
    this.controls?.dispose(); this.controls = null;
    this.zone.hideControls(s.machineId, false);
    this.deps.send(encodeAct(s.machineId, s.x, s.y));
    this.waitingSince = now;
    this.session = null;
    this.deps.onDrop(s.machineId);
  }

  // 서버가 정한 한 판 — 하는 사람·구경꾼 모두 같은 찌르기
  onRing(m: RingMsg): void {
    if (!SPOTS.has(m.m)) return;
    const card = m.peg >= 0 ? this.zone.boardOf(m.m)[m.peg] : null;
    this.anims.set(m.m, { id: m.m, x: m.x, y: m.y, peg: m.peg, caught: m.caught, card, pegs: m.pegs, t: 0, mine: m.m === this.playId });
    this.homing.delete(m.m);
  }

  // 그 기계의 다음(또는 지금) 찌르기가 끝나면 — 결과 연출(당첨 카드)이 그 뒤에 나오게. 3초 안에 찌르기가 없으면 그냥 넘어간다
  finished(id: string): Promise<void> {
    return new Promise((resolve) => {
      const list = this.waiters.get(id) ?? [];
      list.push(resolve); this.waiters.set(id, list);
      setTimeout(() => this.releaseWaiters(id), 3000 + (POKE_IN + POKE_HOLD + FLY) * 1000);
    });
  }

  private releaseWaiters(id: string): void {
    for (const w of this.waiters.get(id) ?? []) w();
    this.waiters.delete(id);
  }

  frame(dt: number, now: number): void {
    const s = this.session;
    if (s) {
      if (s.update(dt, now) === 'poke') this.poke(now);
      else { this.controls?.update(now); this.zone.setHook(s.machineId, s.x, s.y, 0); }
    }
    if (this.waitingSince !== null && now - this.waitingSince > RESULT_WAIT) { this.waitingSince = null; this.deps.onOverdue(); }
    for (const [id, a] of this.anims) {
      a.t += dt;
      const t = a.t, poke = t < POKE_IN ? t / POKE_IN : t < POKE_IN + POKE_HOLD ? 1 : Math.max(0, 1 - (t - POKE_IN - POKE_HOLD) / POKE_OUT);
      this.zone.setHook(id, a.x, a.y, poke);
      const flyAt = t - POKE_IN - POKE_HOLD;
      if (a.caught && a.card && a.peg >= 0 && flyAt >= 0) {
        this.zone.showCard(id, a.peg, false);
        const k = Math.min(1, flyAt / FLY), [px, py] = pegXY(a.peg), from = new THREE.Vector3(px, py - RING.card.h / 2, RING.board.z + 0.07);
        this.zone.flyCard(id, a.card, from.lerp(this.zone.chute, k * k));
      }
      if (t >= POKE_IN + POKE_HOLD + Math.max(POKE_OUT, a.caught ? FLY : 0)) {
        this.zone.flyCard(id, null, new THREE.Vector3());
        this.zone.setBoard(id, a.pegs);
        if (a.peg >= 0) this.zone.showCard(id, a.peg, true);
        this.anims.delete(id);
        this.homing.set(id, { from: [a.x, a.y], t: 0 });
        this.releaseWaiters(id);
      }
    }
    for (const [id, h] of this.homing) {
      h.t += dt;
      const k = Math.min(1, h.t / HOME), [hx, hy] = RING.hook.home;
      this.zone.setHook(id, h.from[0] + (hx - h.from[0]) * k, h.from[1] + (hy - h.from[1]) * k, 0);
      if (k >= 1) this.homing.delete(id);
    }
  }

  cycling(): boolean { return !!this.playId && (this.waitingSince !== null || !!this.anims.get(this.playId)?.mine); }

  resulted(id: string): void { if (id === this.playId) this.waitingSince = null; }

  refused(id: string): void { this.resulted(id); }

  end(): void {
    this.controls?.dispose(); this.controls = null;
    if (this.playId) { this.zone.hideControls(this.playId, false); if (!this.anims.has(this.playId)) this.zone.setHook(this.playId, RING.hook.home[0], RING.hook.home[1], 0); }
    this.session = null; this.playId = null; this.waitingSince = null;
  }

  cameraPose(id: string, _now: number, aspect: number) { return figureCameraPose(SPOTS.get(id)!, 0, aspect); }

  buttonAt(button: 1 | 2, camera: THREE.Camera): { x: number; y: number } | null {
    if (!this.session) return null;
    const [x, y, z] = button === 1 ? FIGURE_CONTROLS.one : FIGURE_CONTROLS.two;
    const p = this.zone.worldOf(this.session.machineId).localToWorld(new THREE.Vector3(x, y + 0.02, z)).project(camera);
    return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
  }
}
