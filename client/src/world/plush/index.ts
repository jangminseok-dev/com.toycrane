import * as THREE from 'three';
import { DOLLS } from '../../data/catalog';
import type { DollLook } from '../../net/protocol';
import { PlushBuilder, plushMat, type Hit, type Slot } from './kit';
import { SPECIES } from './species';

// 새 인형 완성 (인형 리뉴얼 설계 §4): 생김새 + 색 + 키 맞추기. 생김새는 시제품 단위로 짓고,
// 단단한 부딪힘 공의 맨 위가 서 있는 형 1.07 · 동글이형 1.02(지금 인형과 같은 키)가 되게 고르게 줄인다
export const TARGET_TOP = { standing: 1.07, round: 1.02 };
export type Plush = { group: THREE.Group; solid: Hit[]; ears: Hit[]; head: { c: number; r: number } };

const lighter = (hex: number) => new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.55).getHex();

function bodyColor(id: string, look: DollLook): number {
  const info = DOLLS[id];
  return new THREE.Color(info.palette[look.color]?.color ?? info.palette[0].color).getHex();
}

function built(id: string, look: DollLook, lite: boolean) {
  const sp = SPECIES[id];
  if (!sp || !DOLLS[id]) return null;
  const b = new PlushBuilder({ lite });
  sp.make(b, look.face);
  const body = bodyColor(id, look);
  const color = (slot: Slot): number => (typeof slot === 'number' ? slot : slot === 'body' ? body : sp.slots?.[slot] ?? (slot === 'accent' ? lighter(body) : body));
  const out = b.build((slot) => plushMat(color(slot)));
  const top = Math.max(...out.solid.map((h) => h.c.y + h.r));
  return { b, out, k: (sp.round ? TARGET_TOP.round : TARGET_TOP.standing) / top };
}

export function makePlush(id: string, look: DollLook, lite: boolean): Plush | null {
  const made = built(id, look, lite);
  if (!made) return null;
  const { out, k } = made;
  // 줄임은 도형·표지에 바로 굽는다 — 부르는 쪽이 그룹 배율을 바꿔도(손에 든 인형 등) 키가 유지되게
  for (const o of out.group.children) {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.geometry.scale(k, k, k);
    else { o.position.multiplyScalar(k); o.scale.multiplyScalar(k); if (o.userData.ear) { o.userData.ear.c.multiplyScalar(k); o.userData.ear.r *= k; } }
  }
  const scaled = (h: Hit): Hit => ({ ...h, c: h.c.clone().multiplyScalar(k), r: h.r * k });
  return { group: out.group, solid: out.solid.map(scaled), ears: out.ears.map(scaled), head: { c: out.head.c * k, r: out.head.r * k } };
}

// 단단한 부위의 꼭짓점(키 맞춘 뒤) — 부딪힘 공이 겉모습을 감싸는지 재는 시험용
export function solidPoints(id: string, lite: boolean): THREE.Vector3[] {
  const made = built(id, { color: 0, body: 'n', face: 0, rare: '' }, lite);
  return made ? made.b.solidPositions().map((v) => v.multiplyScalar(made.k)) : [];
}
