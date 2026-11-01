import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// 새 인형의 재질과 모양 도구 (인형 리뉴얼 설계 §3, 승인 시제품 docs/reference/prototypes/spike-plush-v13.html).
// 매끈한 무광 천 + 또렷한 2단 셀 음영 + 가장자리 빛 + 굵은 뒷면 외곽선. 털 표현은 넣지 않는다(사용자 결정).
// 생김새는 시제품 단위(곰 머리 꼭대기 ≈ 1.76)로 짓고, 키 맞추기는 makePlush(index.ts)가 한다
export type V3 = [number, number, number];
export type Slot = 'body' | 'accent' | 'pad' | 'inner' | 'nose' | 'thread' | number; // number = 고정 색
export type PartOpts = { slot?: Slot; outline?: boolean; hit?: 'solid' | 'ear' | 'none'; name?: string };
export type Hit = { c: THREE.Vector3; r: number; part?: 'crown' };
export type BuiltPlush = { group: THREE.Group; surface: THREE.Mesh[]; solid: Hit[]; ears: Hit[]; head: { c: number; r: number } };

// 어두운 단 165 · 밝은 단 255, 그 사이만 선형으로 살짝 번진다
export const CEL = new THREE.DataTexture(new Uint8Array([...Array(8).fill(165), ...Array(8).fill(255)]), 16, 1, THREE.RedFormat);
CEL.minFilter = CEL.magFilter = THREE.LinearFilter;
CEL.needsUpdate = true;

// 가장자리를 살짝 밝혀 몸통이 둥글게 떠 보이게
const RIM = `
  float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
  outgoingLight += diffuseColor.rgb * 0.22 * smoothstep(0.35, 0.5, rimF);
  #include <opaque_fragment>`;
function cel(params: THREE.MeshToonMaterialParameters): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ ...params, gradientMap: CEL, vertexColors: true }); // 꼭짓점 색 = 미리 구운 주름 그늘(무더기에서는 그늘 × 색)
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', RIM); };
  m.customProgramCacheKey = () => 'plush-cel';
  m.userData.plush = true;
  return m;
}
const byColor = new Map<number, THREE.MeshToonMaterial>();
export function plushMat(color: number): THREE.MeshToonMaterial {
  let m = byColor.get(color);
  if (!m) byColor.set(color, (m = cel({ color })));
  return m;
}
export const PLUSH_VC = cel({ color: 0xffffff });
const byMap = new Map<THREE.Texture, THREE.MeshToonMaterial>();
export function plushVCWithMap(map: THREE.Texture): THREE.MeshToonMaterial {
  let m = byMap.get(map);
  if (!m) byMap.set(map, (m = cel({ color: 0xffffff, map })));
  return m;
}
// 몸에 거의 붙은 부위의 껍질이 몸 앞으로 비쳐 긁힌 자국처럼 보이지 않게 깊이를 조금 뒤로 민다
export const PLUSH_OUTLINE = new THREE.MeshBasicMaterial({ color: 0x3f2a4f, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 3, polygonOffsetUnits: 12 });
export const OUTLINE_W = 0.02;

const V = (p: V3 | THREE.Vector3) => (p instanceof THREE.Vector3 ? p.clone() : new THREE.Vector3(...p));
const AO_STRENGTH = 0.25; // 시제품 v13 카툰 값 (셀 음영이 이미 입체를 낸다)

type Occ = { c: THREE.Vector3; r: number };
type Part = { geo: THREE.BufferGeometry; slot: Slot; outline: boolean; hit: 'solid' | 'ear' | 'none'; name?: string; balls: Hit[]; occ: Occ[] };

export class PlushBuilder {
  protected parts: Part[] = [];
  protected seg: { sphere: [number, number]; tube: [number, number]; lathe: number; curve: number };

  constructor(readonly o: { lite: boolean }) {
    this.seg = o.lite ? { sphere: [16, 12], tube: [24, 10], lathe: 24, curve: 16 } : { sphere: [48, 36], tube: [48, 32], lathe: 64, curve: 48 };
  }

  private add(geo: THREE.BufferGeometry, balls: Hit[], occ: Occ[], o: PartOpts = {}, defaultHit: 'solid' | 'ear' | 'none' = 'solid'): this {
    this.parts.push({ geo, slot: o.slot ?? 'body', outline: o.outline ?? true, hit: o.hit ?? defaultHit, name: o.name, balls, occ });
    return this;
  }

  // 공(타원체): 부딪힘 공 하나 — 세 축 배율 평균 × r × 0.95
  sphere(r: number, at: V3, scale: V3 = [1, 1, 1], rot: V3 = [0, 0, 0], o?: PartOpts): this {
    const g = new THREE.SphereGeometry(r, ...this.seg.sphere);
    g.scale(...scale);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)));
    g.translate(...at);
    const mean = (r * (scale[0] + scale[1] + scale[2])) / 3;
    return this.add(g, [{ c: V(at), r: mean * 0.95 }], [{ c: V(at), r: mean }], o);
  }

  // 곡선을 따라 가는 관, 굵기는 t(0~1)에 따라 taper배. 부딪힘 공은 길이에 맞춰 2~3개
  tube(points: V3[], r: number, taper: (t: number) => number = () => 1, o?: PartOpts): this {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => V(p)));
    const [tub, rad] = this.seg.tube;
    const g = new THREE.TubeGeometry(curve, tub, r, rad, false), pos = g.getAttribute('position'), p = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i <= tub; i++) {
      const k = taper(i / tub); curve.getPointAt(i / tub, c);
      for (let j = 0; j <= rad; j++) { const idx = i * (rad + 1) + j; p.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c); pos.setXYZ(idx, p.x, p.y, p.z); }
    }
    g.computeVertexNormals();
    const len = curve.getLength(), n = Math.min(3, Math.max(2, Math.ceil(len / (2 * r))));
    const balls = Array.from({ length: n }, (_, i) => { const t = i / (n - 1); return { c: curve.getPointAt(t), r: r * taper(t) * 0.95 }; });
    const m = Math.max(2, Math.ceil(len / 0.07));
    const occ = Array.from({ length: m + 1 }, (_, i) => ({ c: curve.getPointAt(i / m), r: r * taper(i / m) }));
    return this.add(g, balls, occ, o);
  }

  // 몸통: (높이, 반지름) 윤곽을 매끈하게 이어 돌린 배 모양 한 덩어리, 앞뒤로 flatZ배. 부딪힘 공은 굵은 마디 최대 3개
  pear(profile: [number, number][], flatZ = 0.94, zOff = 0, o?: PartOpts): this {
    const curve = new THREE.CatmullRomCurve3(profile.map(([y, r]) => new THREE.Vector3(r, y, 0)));
    const pts = curve.getPoints(this.seg.curve).map((q) => new THREE.Vector2(Math.max(q.x, 0.0001), q.y));
    pts[0].x = 0.0001; pts[pts.length - 1].x = 0.0001;
    const g = new THREE.LatheGeometry(pts, this.seg.lathe);
    g.scale(1, 1, flatZ); g.translate(0, 0, zOff);
    const thick = profile.filter(([, r]) => r > 0.1);
    const pick = thick.length <= 3 ? thick : [thick[0], thick[Math.floor(thick.length / 2)], thick[thick.length - 1]];
    const k = (1 + flatZ) / 2;
    const balls = pick.map(([y, r]) => ({ c: new THREE.Vector3(0, y, zOff), r: r * k * 0.95 }));
    const occ = profile.filter(([, r]) => r > 0.05).map(([y, r]) => ({ c: new THREE.Vector3(0, y, zOff), r: r * 0.9 }));
    return this.add(g, balls, occ, o);
  }

  // 뾰족한 귀(고양이·여우): 아래는 넓고 위는 둥글게 뾰족한 납작한 물방울. 기본은 말랑한 귀(부딪힘 아님)
  pointedEar(r: number, at: V3, side: -1 | 1, flat: number, lean: number, o?: PartOpts): this {
    const g = new THREE.SphereGeometry(r, ...this.seg.sphere), pos = g.getAttribute('position'), v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const t = Math.min(1, Math.max(0, (v.y / r + 1) / 2)), k = 1 - 0.8 * Math.pow(t, 1.5);
      pos.setXYZ(i, v.x * k, v.y * 1.3, v.z * k * flat);
    }
    g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(lean, 0, -side * 0.32)));
    g.translate(...at);
    return this.add(g, [{ c: V(at), r: r * 0.75 }], [{ c: V(at), r: r * 0.75 }], o, 'ear');
  }

  build(colors: (slot: Slot) => THREE.Material): BuiltPlush {
    const occ = this.parts.flatMap((p) => p.occ);
    const bySlot = new Map<Slot, THREE.BufferGeometry[]>();
    const hulls: THREE.BufferGeometry[] = [];
    for (const p of this.parts) {
      bakeAO(p.geo, occ.filter((o) => !p.occ.includes(o)));
      (bySlot.get(p.slot) ?? bySlot.set(p.slot, []).get(p.slot)!).push(p.geo);
      if (p.outline) hulls.push(hull(p.geo, OUTLINE_W));
    }
    const group = new THREE.Group(), surface: THREE.Mesh[] = [];
    for (const [slot, geos] of bySlot) {
      const m = new THREE.Mesh(mergeGeometries(geos, false)!, colors(slot));
      if (slot === 'body') m.name = 'body';
      m.castShadow = true; m.receiveShadow = false;
      group.add(m); surface.push(m);
    }
    if (hulls.length) {
      const o = new THREE.Mesh(mergeGeometries(hulls, false)!, PLUSH_OUTLINE);
      o.name = 'outline'; o.castShadow = true; o.receiveShadow = false;
      group.add(o);
    }
    for (const p of this.parts.filter((x) => x.hit === 'ear')) {
      const marker = new THREE.Object3D(); marker.name = 'ear';
      const b = p.balls[0];
      marker.userData.ear = { c: b.c.clone(), r: b.r, out: new THREE.Vector3(Math.sign(b.c.x) || 1, 0.5, 0).normalize() };
      group.add(marker);
    }
    const head = this.parts.find((p) => p.name === 'head')?.balls[0];
    return {
      group, surface,
      solid: this.parts.filter((p) => p.hit === 'solid').flatMap((p) => p.balls.map((b) => ({ c: b.c.clone(), r: b.r }))),
      ears: this.parts.filter((p) => p.hit === 'ear').flatMap((p) => p.balls.map((b) => ({ c: b.c.clone(), r: b.r }))),
      head: head ? { c: head.c.y, r: head.r / 0.95 } : { c: 0, r: 0 },
    };
  }
}

// 뒷면 외곽선 껍질: 법선 쪽으로 w만큼 부풀린 위치만 가진 도형
function hull(part: THREE.BufferGeometry, w: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  if (part.index) g.setIndex(part.index.clone());
  const p = (part.getAttribute('position') as THREE.BufferAttribute).clone(), n = part.getAttribute('normal');
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * w, p.getY(i) + n.getY(i) * w, p.getZ(i) + n.getZ(i) * w);
  g.setAttribute('position', p);
  return g;
}

// 주름 그늘(AO): 다른 부위의 공 가리개가 가리는 만큼 꼭짓점 색을 어둡게 + 바닥 가까운 아랫면 (시제품 bakeAO, 카툰 세기)
function bakeAO(g: THREE.BufferGeometry, others: Occ[]): void {
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), col = new Float32Array(p.count * 3);
  const v = new THREE.Vector3(), nn = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); nn.fromBufferAttribute(n, i);
    let sum = 0;
    for (const o of others) {
      d.subVectors(o.c, v); const dist = Math.max(d.length(), o.r), h = o.r / dist;
      sum += h * h * Math.max(0, (nn.dot(d.normalize()) + h) / (1 + h));
    }
    let ao = 1 - Math.min(0.6, AO_STRENGTH * Math.max(0, sum - 0.08));
    ao *= 1 - 0.35 * Math.max(0, -nn.y) * Math.max(0, 1 - v.y / 0.4);
    col.set([ao, ao, ao], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
