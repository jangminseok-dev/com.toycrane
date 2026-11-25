// 매장 직원 네 명(설계 2026-11-24 store-staff): 서버 일정(시각)을 화면 시계로 옮겨 staffPose대로 그린다. 기계 앞 화면에선 그 기계로 오는 직원만 보인다
import type * as THREE from 'three';
import { STAFF_ZONES, type StaffZone } from '../data/staff';
import type { StaffZonePlan } from '../net/protocol';
import { REST_L, REST_R, type Avatar } from '../world/avatar';
import { makeStaffAvatar } from '../world/staffAvatar';
import { staffPose, staffVisible } from './staffSchedule';

export class StaffNpcs {
  private npcs = new Map<StaffZone, { avatar: Avatar; plan: StaffZonePlan | null }>();
  private offset = 0; // 서버 시각 − 화면 시각(초)

  constructor(scene: THREE.Scene) {
    for (const zone of STAFF_ZONES) {
      const avatar = makeStaffAvatar();
      scene.add(avatar.root);
      this.npcs.set(zone, { avatar, plan: null });
    }
  }

  setClock(serverNow: number, localSec: number): void { this.offset = serverNow - localSec; }
  serverTime(localSec: number): number { return localSec + this.offset; }
  setPlan(zone: StaffZone, plan: StaffZonePlan | null): void { const n = this.npcs.get(zone); if (n) n.plan = plan; }
  clear(): void { for (const n of this.npcs.values()) n.plan = null; }

  // atMachine: 기계 앞 화면이면 그 기계 id — 그 기계로 일하러 오는 직원만 보인다(staffVisible)
  update(localSec: number, atMachine: string | null = null): void {
    const t = this.serverTime(localSec);
    for (const [zone, { avatar, plan }] of this.npcs) {
      avatar.root.visible = staffVisible(plan, atMachine, t);
      if (!avatar.root.visible) continue;
      const p = staffPose(zone, plan, t), rig = avatar.rig;
      avatar.root.position.set(p.x, 0, p.z);
      avatar.root.rotation.y = p.face;
      avatar.setWalking(p.phase === 'walk');
      // 정리 손짓: 두 손을 기계 쪽으로 내밀고 번갈아 앞뒤로 / 꾸벅 인사: 몸을 앞으로 숙였다 편다 — 기계를 본 채(뒤돌기·몸 흔들기 없음)
      const wave = p.phase === 'work' ? Math.sin(p.k * Math.PI * 6) * 0.06 : 0;
      rig.handL.set(REST_L.x * 0.7, REST_L.y + (p.phase === 'work' ? 0.12 : 0), REST_L.z + (p.phase === 'work' ? 0.3 + wave : 0));
      rig.handR.set(REST_R.x * 0.7, REST_R.y + (p.phase === 'work' ? 0.12 : 0), REST_R.z + (p.phase === 'work' ? 0.3 - wave : 0));
      if (p.phase !== 'work') { rig.handL.copy(REST_L); rig.handR.copy(REST_R); }
      rig.bob.rotation.x = p.phase === 'bow' ? Math.sin(p.k * Math.PI) * 0.45 : 0;
      avatar.update(localSec);
    }
  }
}
