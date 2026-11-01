import * as THREE from 'three';
import { DOLLS, GOLD } from '../../data/catalog';
import type { DollLook } from '../../net/protocol';
import { effectLook, goldMaterial, sparkMaterial } from '../dollTextures';
import { cel } from './cel';
import { FACE_MAT } from './faceAtlas';
import { PLUSH_OUTLINE, PlushBuilder, plushMat, type Hit, type Slot } from './kit';
import { SPECIES } from './species';

// 새 인형 완성 (인형 리뉴얼 설계 §4): 생김새 + 색·표정·희귀·황금 + 키 맞추기 + 캐시.
// 생김새는 시제품 단위로 짓고, 단단한 부딪힘 공의 맨 위가 서 있는 형 1.07 · 동글이형 1.02(지금 인형과 같은 키)가 되게 고르게 줄인다.
// 체형(폭)은 놓는 쪽(무더기·물리)이 x·z에 BODY_W를 곱한다
export const TARGET_TOP = { standing: 1.07, round: 1.02 };
export type Plush = { group: THREE.Group; solid: Hit[]; ears: Hit[]; head: { c: number; r: number } };
const CROWN_GOLD = 1.4; // 황금 인형의 큰 왕관

const lighter = (hex: number) => new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.55).getHex();
function bodyColor(id: string, look: DollLook): number {
  const info = DOLLS[id];
  return new THREE.Color(info.palette[look.color]?.color ?? info.palette[0].color).getHex();
}

// 특수효과 몸: 효과 무늬 + 은은한 빛을 셀 음영으로
const effectMats = new Map<string, THREE.MeshToonMaterial>();
function effectMat(rare: string): THREE.MeshToonMaterial {
  let m = effectMats.get(rare);
  if (!m) { const e = effectLook(rare); effectMats.set(rare, (m = cel({ color: 0xffffff, map: e.map, emissive: e.glow, emissiveIntensity: e.strength }))); }
  return m;
}
// 왕관 테는 위아래가 뚫린 고리(머리에 씌움)라 안쪽 면도 그린다
const crownMat = (() => { let m: THREE.MeshToonMaterial | null = null; return () => (m ??= Object.assign(cel({ color: 0xffd36b, emissive: 0x7a5200, emissiveIntensity: 0.35 }, false), { side: THREE.DoubleSide })); })();
const goldCrownMat = (() => { let m: THREE.Material | null = null; return () => (m ??= Object.assign(goldMaterial().clone(), { side: THREE.DoubleSide })); })();
const gemMat = (() => { let m: THREE.MeshToonMaterial | null = null; return () => (m ??= cel({ color: 0xff5fa2 }, false)); })();
const CROWN_TILT = 0.12, CROWN_Z = 0.04, CROWN_R = 0.155, CROWN_HALF = 0.04; // 왕관은 뒤로 살짝 젖힘, 테 반지름·반높이(배율 1)
// 왕관 가운데 높이(키 맞춘 뒤): 테 아래 둘레 8점이 머리 겉면에서 뜨지 않게(가장 뜬 점이 1cm 안) 얹는다.
// 예전에는 '부딪힘 공 맨 위 + 2cm'라 공이 머리보다 높은 동글이형에서 8~23cm 떠 있었다(사용자 2026-11-02 황금 동글이 사진)
function crownY(b: PlushBuilder, k: number, scale: number, fallbackTop: number): number {
  const R = CROWN_R * scale, half = CROWN_HALF * scale, cos = Math.cos(CROWN_TILT), sin = Math.sin(CROWN_TILT);
  const at = (x: number, z: number) => { const y = b.headTopAt(x / k, z / k); return y === null ? null : y * k; };
  const ring = Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2, sz = Math.cos(a) * R, h = at(Math.sin(a) * R, CROWN_Z + sz); return h === null ? null : h + half * cos - sz * sin; }).filter((v): v is number => v !== null);
  const apex = at(0, CROWN_Z) ?? fallbackTop;
  // 테가 뚫린 고리라 머리 꼭대기가 테 위로 나와도 된다(머리에 씌운 모양). 머리보다 큰 왕관은 꼭대기를 테 안에 품게
  return ring.length >= 4 ? Math.min(...ring) + 0.01 : apex - half * 0.5;
}
const CROWN = { band: new THREE.CylinderGeometry(0.15, 0.16, 0.08, 24, 1, true), tip: new THREE.ConeGeometry(0.035, 0.09, 10), gem: new THREE.SphereGeometry(1, 16, 12), spark: new THREE.OctahedronGeometry(0.035) };

function built(id: string, look: DollLook, lite: boolean) {
  const sp = SPECIES[id];
  if (!sp || !DOLLS[id]) return null;
  const b = new PlushBuilder({ lite });
  sp.make(b, look.face);
  const gold = look.rare === GOLD.id, effect = look.rare !== '' && !gold;
  const body = bodyColor(id, look);
  const color = (slot: Slot): number => (typeof slot === 'number' ? slot : slot === 'body' ? body : sp.slots?.[slot] ?? (slot === 'accent' ? lighter(body) : body));
  // 황금: 실(입·자수)만 빼고 온몸이 금 / 효과: 몸만 효과 무늬, 나머지는 그대로
  const out = b.build((slot) => (gold && slot !== 'thread' ? goldMaterial() : effect && slot === 'body' ? effectMat(look.rare) : plushMat(color(slot))));
  const top = Math.max(...out.solid.map((h) => h.c.y + h.r));
  return { b, out, k: (sp.round ? TARGET_TOP.round : TARGET_TOP.standing) / top, gold, effect };
}

function make(id: string, look: DollLook, lite: boolean): Plush | null {
  const made = built(id, look, lite);
  if (!made) return null;
  const { out, k, gold } = made;
  // 줄임은 도형·표지에 바로 굽는다 — 부르는 쪽이 그룹 배율을 바꿔도(손에 든 인형 등) 키가 유지되게
  for (const o of out.group.children) {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.geometry.scale(k, k, k);
    else { o.position.multiplyScalar(k); if (!o.userData.ear) o.scale.multiplyScalar(k); else { o.userData.ear.c.multiplyScalar(k); o.userData.ear.r *= k; } }
  }
  const scaled = (h: Hit): Hit => ({ ...h, c: h.c.clone().multiplyScalar(k), r: h.r * k });
  const solid = out.solid.map(scaled);
  out.group.userData.spin = [];
  if (look.rare) {
    // 희귀: 작은 왕관 + 효과 색 반짝이 / 황금: 큰 왕관 + 금빛 반짝이 더 많이 (기존 인형과 같은 자리·크기)
    const top = Math.max(...solid.map((h) => h.c.y + h.r)), scale = gold ? CROWN_GOLD : 1, cy = crownY(made.b, k, scale, top);
    const crown = new THREE.Group(); crown.name = 'crown';
    crown.position.set(0, cy, CROWN_Z); crown.rotation.x = -CROWN_TILT; crown.scale.setScalar(scale);
    const mat = gold ? goldCrownMat() : crownMat();
    const band = new THREE.Mesh(CROWN.band, mat); band.castShadow = true; crown.add(band);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const tip = new THREE.Mesh(CROWN.tip, mat); tip.position.set(Math.sin(a) * 0.13, 0.08, Math.cos(a) * 0.13); crown.add(tip); }
    const gem = new THREE.Mesh(CROWN.gem, gemMat()); gem.position.set(0, 0.02, 0.155); gem.scale.set(0.03, 0.03, 0.02); crown.add(gem);
    const ring = new THREE.Mesh(CROWN.band, PLUSH_OUTLINE); ring.scale.setScalar(1.12); crown.add(ring); // 띠 외곽선
    out.group.add(crown);
    solid.push({ c: new THREE.Vector3(0, cy + 0.04 * scale, CROWN_Z), r: 0.15 * scale, part: 'crown' });
    if (!lite) {
      const aura = new THREE.Group(); aura.position.y = 0.7; aura.name = 'aura';
      const n = gold ? 11 : 7, radius = gold ? 0.7 : 0.62, smat = sparkMaterial(look.rare);
      for (let i = 0; i < n; i++) {
        const s = new THREE.Mesh(CROWN.spark, smat), a = (i / n) * Math.PI * 2;
        s.position.set(Math.cos(a) * radius, Math.sin(a * 2) * 0.25, Math.sin(a) * radius);
        if (gold) s.scale.setScalar(1.4);
        aura.add(s);
      }
      out.group.add(aura);
    }
  }
  return { group: out.group, solid, ears: out.ears.map(scaled), head: { c: out.head.c * k, r: out.head.r * k } };
}

// 같은 겉모습은 한 번만 만들고 복사해 준다(도형·재질 공유). 무더기용(lite)은 붙들지 않는다 — 무더기(bigZone)가 합칠 조각을
// 겉모습마다 따로 붙들어서, 여기서도 붙들면 같은 도형이 두 벌 남는다(최종 리뷰 I3)
const cache = new Map<string, Plush | null>();
const CACHE_MAX = 400;
export function makePlush(id: string, look: DollLook, lite: boolean): Plush | null {
  const key = `${id}|${look.color}|${look.face}|${look.rare}`;
  let p = lite ? make(id, look, true) : cache.get(key);
  if (p === undefined) {
    p = make(id, look, false);
    cache.set(key, p);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  }
  if (!p) return null;
  const group = p.group.clone(true);
  // 복사본의 표지 userData는 JSON 복사라 벡터가 일반 객체가 된다 — 원본에서 다시 넣는다
  p.group.children.forEach((o, i) => { if (o.userData.ear) group.children[i].userData.ear = { c: o.userData.ear.c.clone(), r: o.userData.ear.r, out: o.userData.ear.out.clone() }; });
  const aura = group.getObjectByName('aura');
  group.userData.spin = aura ? [{ obj: aura, speed: look.rare === GOLD.id ? 2.2 : 1.6 }] : [];
  const copy = (h: Hit): Hit => ({ ...h, c: h.c.clone() });
  return { group, solid: p.solid.map(copy), ears: p.ears.map(copy), head: { ...p.head } };
}

// 부딪힘 공·머리만 (인형 모양 좌표, 키 맞춘 뒤, 왕관 공 포함) — 그리지 않으니 가볍고 캔버스가 필요 없다 (겨냥·물리·집게 계획)
const shapes = new Map<string, Omit<Plush, 'group'> | null>();
export function plushShape(id: string, rare = ''): Omit<Plush, 'group'> | null {
  const key = `${id}|${rare}`;
  if (shapes.has(key)) return shapes.get(key)!;
  const sp = SPECIES[id];
  let out: Omit<Plush, 'group'> | null = null;
  if (sp && DOLLS[id]) {
    const b = new PlushBuilder({ lite: false });
    sp.make(b, 0);
    const raw = b.shape(), top = Math.max(...raw.solid.map((h) => h.c.y + h.r));
    const k = (sp.round ? TARGET_TOP.round : TARGET_TOP.standing) / top;
    const scaled = (h: Hit): Hit => ({ ...h, c: h.c.clone().multiplyScalar(k), r: h.r * k });
    const solid = raw.solid.map(scaled);
    if (rare) { const s = rare === GOLD.id ? CROWN_GOLD : 1, t = Math.max(...solid.map((h) => h.c.y + h.r)); solid.push({ c: new THREE.Vector3(0, crownY(b, k, s, t) + 0.04 * s, CROWN_Z), r: 0.15 * s, part: 'crown' }); }
    out = { solid, ears: raw.ears.map(scaled), head: { c: raw.head.c * k, r: raw.head.r * k } };
  }
  shapes.set(key, out);
  return out;
}

// 단단한 부위의 꼭짓점(키 맞춘 뒤) — 부딪힘 공이 겉모습을 감싸는지 재는 시험용
export function solidPoints(id: string, lite: boolean): THREE.Vector3[] {
  const made = built(id, { color: 0, body: 'n', face: 0, rare: '' }, lite);
  return made ? made.b.solidPositions().map((v) => v.multiplyScalar(made.k)) : [];
}
export { FACE_MAT };
