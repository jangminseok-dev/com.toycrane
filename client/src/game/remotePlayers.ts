import * as THREE from 'three';
import type { Move, PlayerView } from '../net/protocol';
import { makeAvatar, type Avatar, type AvatarRig } from '../world/avatar';
import { BEGGING } from '../world/copy';
import { startBegging } from '../world/motions';
import type { Tweens } from './tween';
import { extrapolate, isMoving, type RemoteState } from './remote';

type Remote = { avatar: Avatar; state: RemoteState; shown: THREE.Vector2; nick: string; color: number; room: number | null; begging: { stop(): Promise<void> } | null };
const SMOOTH = 0.2; // 매 프레임 추정 위치로 20%씩 다가간다

// 같은 매장의 다른 사람들: 받은 위치에서 추정한 곳으로 부드럽게 따라 움직인다
export class RemotePlayers {
  private remotes = new Map<string, Remote>();
  private hidden = false;

  constructor(private scene: THREE.Scene) {}

  add(p: PlayerView, nowMs: number): void {
    this.remove(p.id);
    const avatar = makeAvatar(p.color, p.nick);
    avatar.root.position.set(p.x, 0, p.z);
    avatar.root.visible = !this.hidden;
    this.scene.add(avatar.root);
    this.remotes.set(p.id, {
      avatar,
      state: { pos: { x: p.x, z: p.z }, dir: { x: p.dx, z: p.dz }, receivedAt: nowMs },
      shown: new THREE.Vector2(p.x, p.z),
      nick: p.nick, color: p.color,
      room: null, begging: null,
    });
  }

  move(m: Move, nowMs: number): void {
    const r = this.remotes.get(m.id);
    if (r) r.state = { pos: { x: m.x, z: m.z }, dir: { x: m.dx, z: m.dz }, receivedAt: nowMs };
  }

  remove(id: string): void {
    const r = this.remotes.get(id);
    if (!r) return;
    void r.begging?.stop(); // 조르기 모션은 stop()까지 되풀이한다 (최종 리뷰 I2)
    this.scene.remove(r.avatar.root);
    r.avatar.dispose();
    this.remotes.delete(id);
  }

  // 매장 지도의 다른 사람 점(화면에 보이는 자리)
  positions(): { x: number; z: number }[] {
    return [...this.remotes.values()].map((r) => ({ x: r.shown.x, z: r.shown.y }));
  }

  // 모션(기계 앞 코인·조이스틱·결과)을 그 사람 아바타에 입힐 때
  rigOf(id: string): AvatarRig | null {
    return this.remotes.get(id)?.avatar.rig ?? null;
  }

  // 맵 조르기 (교환소 개편 설계 §4.3): room이 있으면 '조르는 중' 꼬리표와 조르기 모션, null이면 멈춘다
  setBegging(id: string, room: number | null, tw: Tweens): void {
    const r = this.remotes.get(id);
    if (!r) return;
    r.room = room;
    r.avatar.setTag(room !== null ? BEGGING : null);
    if (room !== null && !r.begging) r.begging = startBegging(r.avatar.rig, tw);
    else if (room === null && r.begging) { void r.begging.stop(); r.begging = null; }
  }

  // 한 판 하는 동안 다른 사람 캐릭터는 모두 숨긴다(사용자 2026-11-03 — 기계 앞을 막아서는 방해). 보고 있는 사람은 화면 구석 얼굴로만 알린다
  hideAll(on: boolean): void {
    if (on === this.hidden) return;
    this.hidden = on;
    for (const r of this.remotes.values()) r.avatar.root.visible = !on;
  }

  // 구경하는 사람 얼굴(ui/peekFaces)에 쓸 이름·색과 화면에 보이는 자리
  people(): { id: string; nick: string; color: number; x: number; z: number }[] {
    return [...this.remotes].map(([id, r]) => ({ id, nick: r.nick, color: r.color, x: r.shown.x, z: r.shown.y }));
  }

  roomOf(id: string): number | null {
    return this.remotes.get(id)?.room ?? null;
  }

  // 손 닿는 거리 안에서 가장 가까운 조르는 사람
  beggarNear(pos: { x: number; z: number }, reach: number): { id: string; nick: string; room: number } | null {
    let best: { id: string; nick: string; room: number; d: number } | null = null;
    for (const [id, r] of this.remotes) {
      if (r.room === null) continue;
      const d = Math.hypot(r.shown.x - pos.x, r.shown.y - pos.z);
      if (d <= reach && (!best || d < best.d)) best = { id, nick: r.nick, room: r.room, d };
    }
    return best && { id: best.id, nick: best.nick, room: best.room };
  }

  nickOf(id: string): string {
    return this.remotes.get(id)?.nick ?? '누군가';
  }

  clear(): void {
    for (const id of [...this.remotes.keys()]) this.remove(id);
  }

  update(nowMs: number): void {
    for (const r of this.remotes.values()) {
      const target = extrapolate(r.state, nowMs);
      r.shown.x += (target.x - r.shown.x) * SMOOTH;
      r.shown.y += (target.z - r.shown.y) * SMOOTH;
      r.avatar.root.position.set(r.shown.x, 0, r.shown.y);
      const moving = isMoving(r.state, nowMs);
      if (moving) r.avatar.root.rotation.y = Math.atan2(r.state.dir.x, r.state.dir.z);
      r.avatar.setWalking(moving);
      r.avatar.update(nowMs / 1000);
    }
  }
}
