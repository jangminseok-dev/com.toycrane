import * as THREE from 'three';
import type { Move, PlayerView } from '../net/protocol';
import { makeAvatar, type Avatar, type AvatarRig } from '../world/avatar';
import { BEGGING } from '../world/copy';
import { startBegging } from '../world/motions';
import type { Tweens } from './tween';
import { extrapolate, isMoving, type RemoteState } from './remote';

type Remote = { avatar: Avatar; state: RemoteState; shown: THREE.Vector2; nick: string; room: number | null; begging: { stop(): Promise<void> } | null; fade: number };
const FADE_TO = 0.15, FADE_SECONDS = 0.2; // 내 카메라를 가리는 사람 (교환소 개편 설계 §4.7.2)
const SMOOTH = 0.2; // 매 프레임 추정 위치로 20%씩 다가간다

// 같은 매장의 다른 사람들: 받은 위치에서 추정한 곳으로 부드럽게 따라 움직인다
export class RemotePlayers {
  private remotes = new Map<string, Remote>();

  constructor(private scene: THREE.Scene) {}

  add(p: PlayerView, nowMs: number): void {
    this.remove(p.id);
    const avatar = makeAvatar(p.color, p.nick);
    avatar.root.position.set(p.x, 0, p.z);
    this.scene.add(avatar.root);
    this.remotes.set(p.id, {
      avatar,
      state: { pos: { x: p.x, z: p.z }, dir: { x: p.dx, z: p.dz }, receivedAt: nowMs },
      shown: new THREE.Vector2(p.x, p.z),
      nick: p.nick,
      room: null, begging: null, fade: 1,
    });
  }

  move(m: Move, nowMs: number): void {
    const r = this.remotes.get(m.id);
    if (r) r.state = { pos: { x: m.x, z: m.z }, dir: { x: m.dx, z: m.dz }, receivedAt: nowMs };
  }

  remove(id: string): void {
    const r = this.remotes.get(id);
    if (!r) return;
    this.scene.remove(r.avatar.root);
    r.avatar.dispose();
    this.remotes.delete(id);
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

  // 한 판 중 내 카메라와 기계 사이에 선 사람(blocking이 참)을 거의 투명하게, 벗어나면 원래대로 (blocking이 null이면 모두 원래대로)
  fade(blocking: ((p: { x: number; z: number }) => boolean) | null, dt: number): void {
    const step = (1 - FADE_TO) * Math.min(1, dt / FADE_SECONDS);
    for (const r of this.remotes.values()) {
      const target = blocking && blocking({ x: r.shown.x, z: r.shown.y }) ? FADE_TO : 1;
      if (r.fade === target) continue;
      r.fade = target < r.fade ? Math.max(target, r.fade - step) : Math.min(target, r.fade + step);
      r.avatar.setFade(r.fade);
    }
  }

  fadeOf(id: string): number {
    return this.remotes.get(id)?.fade ?? 1;
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
