import * as THREE from 'three';
import type { Move, PlayerView } from '../net/protocol';
import { makeAvatar, type Avatar } from '../world/avatar';
import { extrapolate, type RemoteState } from './remote';

type Remote = { avatar: Avatar; state: RemoteState; shown: THREE.Vector2 };
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
    this.remotes.delete(id);
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
      const moving = Math.hypot(r.state.dir.x, r.state.dir.z) > 0;
      if (moving) r.avatar.root.rotation.y = Math.atan2(r.state.dir.x, r.state.dir.z);
      r.avatar.setWalking(moving);
      r.avatar.update(nowMs / 1000);
    }
  }
}
