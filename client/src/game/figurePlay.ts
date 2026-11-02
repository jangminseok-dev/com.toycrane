import * as THREE from 'three';
import { FIGURE, FIGURES, boxKindOf, type BoxKind } from '../data/figures';
import { encodeDone, type BoxWire, type DollPose, type Pose } from '../net/protocol';
import { FigureClaw, tipOffset } from '../physics/figureClaw';
import { FigureCycleRunner } from '../physics/figureCycle';
import type { BoxWorld } from '../physics/boxWorld';
import { FigureWorld } from '../physics/figureWorld';
import type { Rapier } from '../physics/rapier';
import { PoseReceiver, PoseSender } from '../physics/relay';
import { buildAimGuide, type AimGuide } from '../world/aimGuide';
import { FIGURE_CONTROLS, buildFigureControls, type ButtonLabels, type FigureControls } from '../world/figureControls';
import { UI } from '../world/copy';
import { playReveal } from '../world/figureReveal';
import type { FigureZone } from '../world/figureZone';
import type { ButtonPlay } from './buttonPlay';
import { SideBlend, figureCameraPose, type CameraPoses } from './figureCamera';
import { FigureSession } from './figureSession';
import type { Vec2 } from './movement';

// 피규어 한 판(9단계 설계 §3·§4)의 화면 쪽: 조작대 버튼 ①② → 물리 한 바퀴(하는 사람 브라우저) → done 보고(상자 uid 0) → 상자 까기.
// 구경꾼은 중계(pose: 집게 + 상자 uid 0)를 받아 그린다. 판 사이 흐름(이어 하기·그만하기)은 main.ts가 인형 판과 함께 쓴다
const WATCH_REACH = 12;
export const FIGURE_SPOTS = new Map(FIGURES.map((f) => [f.id, f]));
// 상자 기계 한 종류(피규어·고리 걸기, 계획 12): 자리, 물리 세계 만들기, 버튼 글씨, 판 시작 안내 — 판 흐름·집게·구경·중계는 같다
export type BoxMachine = {
  spots: Map<string, { id: string; x: number; z: number; ry: number }>;
  makeWorld(R: Rapier, box: BoxWire, id: string): BoxWorld;
  hint: string;
  labels?: ButtonLabels;
  camera?: CameraPoses; // 기본은 피규어 시점
  aimGuide?: boolean; // 판 동안 두 팔 끝이 내려갈 자리를 보여 준다(고리 걸기 — 팔 끝을 고리 구멍에 넣어야 해서)
};
export const FIGURE_MACHINE: BoxMachine = { spots: FIGURE_SPOTS, makeWorld: (R, box, id) => new FigureWorld(R, box, boxKindOf(id)), hint: UI.figureHint };
const boxPose = (b: BoxWire): DollPose => ({ uid: 0, p: [b[0], b[1], b[2]], q: [b[3], b[4], b[5], b[6]] });

export type FigurePlayDeps = {
  send(msg: string): void;
  rapier(): Rapier | null;
  onDrop(machineId: string): void; // 집게가 내려가기 시작 — 결과를 기다린다(main의 awaiting)
  onOverdue(): void; // 내린 뒤 결과를 너무 오래 못 받음
};

export class FigurePlay implements ButtonPlay {
  session: FigureSession | null = null; // 버튼 단계
  side = new SideBlend(); // 0 정면 ~ 1 옆 대각선
  get hint(): string { return this.machine.hint; }
  private playId: string | null = null; // 내 판(버튼부터 결과까지)
  private saved = new Map<string, BoxWire>(); // 서버가 알려 준 상자 자리(welcome·figure) — 판의 시작점, 판이 결과 없이 끝나면 되돌린다
  private controls: FigureControls | null = null;
  private guide: AimGuide | null = null;
  private world: BoxWorld | null = null;
  private claw: FigureClaw | null = null;
  private runner: FigureCycleRunner | null = null;
  private dropped: FigureSession | null = null;
  private watches = new Map<string, PoseReceiver>();
  private reveals: { update(dt: number): boolean }[] = [];
  private poseSender: PoseSender;

  constructor(private scene: THREE.Scene, readonly zone: FigureZone, private deps: FigurePlayDeps, readonly machine: BoxMachine = FIGURE_MACHINE) {
    this.poseSender = new PoseSender((m) => deps.send(m));
  }

  setBoxes(boxes: Record<string, BoxWire>): void {
    for (const [id, b] of Object.entries(boxes)) this.setBox(id, b);
  }

  setBox(id: string, box: BoxWire): void {
    if (!this.machine.spots.has(id)) return;
    this.saved.set(id, box);
    this.zone.setBox(id, box);
  }

  // 화면에 그린 상자(중계·내 물리)를 서버 자리로 — 중계로 본 마지막 자리가 다음 판의 시작이 되면 하지도 않은 당첨이 난다 (최종 리뷰 I1)
  private restoreBox(id: string): void {
    const b = this.saved.get(id);
    if (b) this.zone.setBox(id, b);
  }

  start(id: string, limit: number, now: number): void {
    this.end();
    this.playId = id;
    this.stopWatch(id);
    this.restoreBox(id);
    this.session = new FigureSession(id, limit, now, -this.zone.homeOf(id).x); // 벌린 팔이 기계 안에 머무는 데까지
    this.controls = buildFigureControls(this.zone.worldOf(id), this.machine.labels);
    this.controls.setPhase('one');
    this.zone.hideControls(id, true); // 기계 그림의 고정 버튼은 숨긴다(살아 있는 버튼이 덮는다)
    const R = this.deps.rapier();
    if (R) this.world = this.machine.makeWorld(R, this.zone.boxOf(id), id); // 그 기계의 상자 세계(피규어는 상자 종류, 설계 §8)
    if (this.machine.aimGuide && this.world?.surfaceBelow) this.guide = buildAimGuide(this.zone.worldOf(id));
  }

  pick(ray: THREE.Raycaster): 1 | 2 | null {
    return this.session && this.controls ? this.controls.pick(ray) : null;
  }

  press(button: 1 | 2): boolean {
    if (!this.session?.press(button)) return false;
    this.controls?.setPressed(button);
    return true;
  }

  // ①을 떼는 순간 옆 대각선으로(버튼을 누르는 동안엔 카메라가 안 움직인다), ②를 떼면 내린다
  release(button: 1 | 2, now: number): void {
    const s = this.session;
    if (!s) return;
    this.controls?.setPressed(null);
    const moving = s.phase === 'moving-one';
    const r = s.release(button, now);
    if (moving && s.phase === 'two') this.side.start(now);
    this.controls?.setPhase(s.phase);
    if (r === 'drop') this.drop(now);
  }

  private drop(now: number): void {
    const s = this.session!, id = s.machineId, R = this.deps.rapier();
    this.controls?.dispose(); this.controls = null;
    this.guide?.dispose(); this.guide = null;
    this.zone.hideControls(id, false);
    this.dropped = s; this.session = null;
    if (R && this.world) {
      this.claw = new FigureClaw(R, this.world, s.claw.x, s.claw.z);
      this.runner = new FigureCycleRunner(this.world, this.claw, s.claw.x, s.claw.z);
    } else { // 물리가 없으면(있을 수 없지만) 상자 없이 — 서버가 거절하고 상자는 그대로
      this.deps.send(encodeDone(id, [], []));
      s.markDone(now);
    }
    this.deps.onDrop(id);
  }

  frame(dt: number, now: number): void {
    if (this.session) {
      const s = this.session;
      if (s.update(dt, now) === 'drop') this.drop(now); // 시간이 다 되면 그 자리에서
      else { this.controls?.update(now); this.zone.setClaw(s.machineId, s.claw.x, FIGURE.claw.rest_y, s.claw.z, 1); this.showAim(s.claw); }
    }
    if (this.runner && this.world && this.claw && this.playId) {
      const done = this.runner.advance(dt), [x, y, z, open] = this.runner.clawPose(), box = this.world.boxPose(), extra = this.world.extraPose?.();
      this.zone.setClaw(this.playId, x, y, z, open); this.zone.setBox(this.playId, box, extra);
      this.poseSender.frame(this.playId, { x, y, z, open }, extra ? [boxPose(box), { ...boxPose(extra), uid: 1 }] : [boxPose(box)], now); // 날개는 uid 1
      if (done) {
        const r = this.runner.done();
        this.deps.send(encodeDone(this.playId, r.won ? [0] : [], [boxPose(r.box)]));
        this.dropped?.markDone(now);
        this.claw.dispose(); this.world.dispose();
        this.claw = null; this.runner = null; this.world = null;
        this.side.stop(now); // 판이 끝나면 정면으로
      }
    }
    if (this.dropped?.resultOverdue(now)) { this.dropped = null; this.deps.onOverdue(); }
    for (const [id, rec] of this.watches) {
      const { claw, dolls } = rec.sample(now);
      if (claw[1] <= 0) continue; // 아직 중계가 없다
      this.zone.setClaw(id, claw[0], claw[1], claw[2], claw[3]);
      const b = dolls.get(0), e = dolls.get(1);
      if (b) this.zone.setBox(id, [...b.p, ...b.q], e ? [...e.p, ...e.q] : undefined);
    }
    this.reveals = this.reveals.filter((r) => r.update(dt));
  }

  handles(id: string): boolean { return this.machine.spots.has(id); }



  cameraPose(id: string, now: number, aspect: number) { return figureCameraPose(this.machine.spots.get(id)!, this.side.value(now), aspect, this.machine.camera); }

  cycling(): boolean { return this.runner !== null; }

  // 결과를 받았다 — 결과 기다리기를 끝낸다
  resulted(id: string): void {
    if (this.dropped?.machineId === id) this.dropped = null;
  }

  // 서버가 보고를 거절(done_no): 상자는 판 시작 전 그대로
  refused(id: string): void {
    if (this.playId === id) this.restoreBox(id);
    this.resulted(id);
  }

  // 남의 판: 가까운 기계만 중계를 그린다
  watch(id: string, me: Vec2): void {
    const f = this.machine.spots.get(id);
    if (!f || id === this.playId || Math.hypot(me.x - f.x, me.z - f.z) > WATCH_REACH) return;
    if (!this.watches.has(id)) this.watches.set(id, new PoseReceiver());
  }

  onPose(m: Pose, now: number): void {
    this.watches.get(m.m)?.push(m, now);
  }

  stopWatch(id: string): void {
    if (this.watches.delete(id)) { this.restClaw(id); this.restoreBox(id); }
  }

  watching(id: string): boolean { return this.watches.has(id); }

  clearWatches(): void {
    for (const id of [...this.watches.keys()]) this.stopWatch(id);
  }

  private restClaw(id: string): void {
    const home = this.zone.homeOf(id);
    this.zone.setClaw(id, home.x, FIGURE.claw.rest_y, home.z, 1);
  }

  // 상자 까기: 판이 끝나 돌아가는 정면 시점(eye → look)에서 0.9m 앞, 조금 아래 (미리보기에서 확인한 자리)
  reveal(kind: string, rare: string, view: { pos: THREE.Vector3; look: THREE.Vector3 }, done: () => void, box: BoxKind = 'long'): void {
    const dir = view.look.clone().sub(view.pos).normalize();
    const at = view.pos.clone().addScaledVector(dir, 0.9).add(new THREE.Vector3(0, -0.15, 0));
    this.reveals.push(playReveal(this.scene, at, view.pos.clone(), kind, rare, done, box));
  }

  // 판을 그만두거나 끝냄(정리): 살아 있는 버튼·물리를 치우고 집게는 제자리, 시점은 바로 정면
  // 벌린 두 팔 끝(쉬는 높이)과 그 아래 처음 닿는 높이 — 겨냥 표시
  private showAim(claw: Vec2): void {
    const w = this.world;
    if (!this.guide || !w?.surfaceBelow) return;
    const [tx, ty] = tipOffset(w.clawShape), y = FIGURE.claw.rest_y + ty;
    this.guide.set([-1, 1].map((side) => {
      const x = claw.x + side * tx;
      return { x, y, z: claw.z, floor: w.surfaceBelow!(x, claw.z, y) };
    }));
  }

  end(): void {
    this.controls?.dispose(); this.controls = null;
    this.guide?.dispose(); this.guide = null;
    if (this.playId) { this.zone.hideControls(this.playId, false); this.restClaw(this.playId); this.restoreBox(this.playId); }
    this.claw?.dispose(); this.world?.dispose();
    this.claw = null; this.runner = null; this.world = null;
    this.session = null; this.dropped = null; this.playId = null;
    this.side = new SideBlend();
  }

  // e2e: 누를 버튼의 화면 자리
  buttonAt(button: 1 | 2, camera: THREE.Camera): { x: number; y: number } | null {
    if (!this.session) return null;
    const [x, y, z] = button === 1 ? FIGURE_CONTROLS.one : FIGURE_CONTROLS.two;
    const p = this.zone.worldOf(this.session.machineId).localToWorld(new THREE.Vector3(x, y + 0.02, z)).project(camera);
    return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
  }
}
