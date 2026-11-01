import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CEL, cel } from './cel';
import { FACE_MAT, cellUV, ensureFaceAtlas, type Cell } from './faceAtlas';

export { CEL };

// 새 인형의 재질과 모양 도구 (인형 리뉴얼 설계 §3, 승인 시제품 docs/reference/prototypes/spike-plush-v13.html).
// 매끈한 무광 천 + 또렷한 2단 셀 음영 + 가장자리 빛 + 굵은 뒷면 외곽선. 털 표현은 넣지 않는다(사용자 결정).
// 생김새는 시제품 단위(곰 머리 꼭대기 ≈ 1.76)로 짓고, 키 맞추기는 makePlush(index.ts)가 한다
export type V3 = [number, number, number];
export type Slot = 'body' | 'accent' | 'pad' | 'inner' | 'nose' | 'thread' | number; // number = 고정 색
export type PartOpts = { slot?: Slot; outline?: boolean; hit?: 'solid' | 'ear' | 'none'; name?: string; balls?: number }; // balls: 관의 부딪힘 공 수를 정해 줄 때
export type Hit = { c: THREE.Vector3; r: number; part?: 'crown' };
export type BuiltPlush = { group: THREE.Group; surface: THREE.Mesh[]; solid: Hit[]; ears: Hit[]; head: { c: number; r: number } };

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

const DOUBLE = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const V = (p: V3 | THREE.Vector3) => (p instanceof THREE.Vector3 ? p.clone() : new THREE.Vector3(...p));
const AO_STRENGTH = 0.25; // 시제품 v13 카툰 값 (셀 음영이 이미 입체를 낸다)

type Occ = { c: THREE.Vector3; r: number };
type Inside = (p: THREE.Vector3) => boolean; // 그 부위 덩어리 안쪽인지(붙음 재기)
type Part = { geo: THREE.BufferGeometry; slot: Slot; outline: boolean; hit: 'solid' | 'ear' | 'none'; name?: string; balls: Hit[]; occ: Occ[]; head?: { c: number; r: number }; inside: Inside };
// 단위 공을 m으로 옮긴 타원체의 안쪽
const ellipsoid = (m: THREE.Matrix4): Inside => { const inv = m.clone().invert(), q = new THREE.Vector3(); return (p) => q.copy(p).applyMatrix4(inv).lengthSq() <= 1; };
type Paint = { cell: Cell; at: [number, number]; size: [number, number]; name: string; flip: boolean };
type Stitch = { points: [number, number][]; r: number; name: string };

export class PlushBuilder {
  protected parts: Part[] = [];
  lastLimb: V3 = [0, 0, 0]; // 마지막 limb가 놓인 자리(이어 붙는 털뭉치·고리가 앞 것을 따라가게)
  protected paints: Paint[] = [];
  protected stitches: Stitch[] = [];
  protected seg: { sphere: [number, number]; tube: [number, number]; cap: [number, number]; lathe: number; curve: number };

  // lite(기계 속 무더기 216마리): 휴대폰 삼각형 수 때문에 팔·다리·꼬리(관)와 작은 공은 면을 낮춘다. 머리·몸 같은 큰 덩어리(돌림체, 큰 공)는
  // 기계 앞에서 화면 반을 차지해 테두리가 각져 보이므로 그대로. 관 끝 막음 공은 절반이 관 속에 묻혀 더 낮게.
  // mini(미는 뽑기 미니 인형, 크기 0.18 — 네 대에 112개): 큰 덩어리까지 더 낮춘다(lite의 절반 이하 삼각형, 휴대폰 걷기 180만 관문)
  constructor(readonly o: { lite: boolean; mini?: boolean }) {
    this.seg = o.mini
      ? { sphere: [14, 10], tube: [7, 6], cap: [6, 5], lathe: 18, curve: 10 }
      : o.lite
        ? { sphere: [16, 12], tube: [12, 9], cap: [9, 7], lathe: 24, curve: 16 }
        : { sphere: [48, 36], tube: [48, 32], cap: [48, 36], lathe: 64, curve: 48 };
  }

  // 공의 면 나눔: lite에서 가장 긴 반지름이 0.14 미만(가시·코·볼록이)이면 [8, 6], 0.4 미만(귀·손·발·볼)이면 [12, 9], 그보다 크면(머리·몸) 그대로
  private sphereSeg(r: number, scale: V3): [number, number] {
    const big = r * Math.max(...scale);
    if (!this.o.lite || big >= 0.4) return this.seg.sphere;
    if (this.o.mini) return big < 0.14 ? [6, 4] : [8, 6];
    return big < 0.14 ? [8, 6] : [12, 9];
  }

  private add(geo: THREE.BufferGeometry, balls: Hit[], occ: Occ[], inside: Inside, o: PartOpts = {}, defaultHit: 'solid' | 'ear' | 'none' = 'solid', head?: { c: number; r: number }): this {
    this.parts.push({ geo, slot: o.slot ?? 'body', outline: o.outline ?? true, hit: o.hit ?? defaultHit, name: o.name, balls, occ, head, inside });
    return this;
  }

  // 공(타원체). 부딪힘 공: 긴 축이 둘째 축의 1.31배 이하면 하나(반지름 = 긴 두 축 평균 × 0.95),
  // 더 길쭉하면 긴 축을 따라 셋(옆으로 넓은 고양이 머리처럼 — 공 하나면 양끝이 밖으로 샌다)
  sphere(r: number, at: V3, scale: V3 = [1, 1, 1], rot: V3 = [0, 0, 0], o?: PartOpts): this {
    const g = new THREE.SphereGeometry(r, ...this.sphereSeg(r, scale));
    g.scale(...scale);
    const turn = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot));
    g.applyMatrix4(turn);
    g.translate(...at);
    const axes = scale.map((k, i) => ({ len: r * k, dir: new THREE.Vector3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0).applyMatrix4(turn) })).sort((a, b) => b.len - a.len);
    const c = V(at), mean = (r * (scale[0] + scale[1] + scale[2])) / 3;
    let balls: Hit[];
    if (axes[0].len <= axes[1].len * 1.31) balls = [{ c, r: ((axes[0].len + axes[1].len) / 2) * 0.95 }];
    else {
      const rr = axes[1].len * 0.95, off = axes[0].len - rr; // 둘째 축 기준 — 날개처럼 납작한 부위도 넓은 면이 감싸지게
      balls = [-1, 0, 1].map((s) => ({ c: c.clone().addScaledVector(axes[0].dir, s * off), r: rr })); // 양끝 + 가운데(앞뒤 가운데가 비지 않게)
    }
    const shape = new THREE.Matrix4().makeTranslation(...at).multiply(turn).multiply(new THREE.Matrix4().makeScale(r * scale[0], r * scale[1], r * scale[2]));
    return this.add(g, balls, [{ c, r: mean }], ellipsoid(shape), o, 'solid', o?.name === 'head' ? { c: at[1], r: mean } : undefined);
  }

  // 몸에 붙는 둥근 부위(발·앞발·지느러미·꼬리 털뭉치·물줄기): 지금까지 만든 덩어리 안에 bury만큼 묻히도록 toward(기본: 머리 가운데) 쪽으로
  // 1cm씩 옮겨 놓는다 — 고정 좌표로 놓으면 둥근 몸에 점으로만 닿아 외곽선이 둘레를 그어 떨어져 보였다(사용자 2026-11-02)
  limb(r: number, at: V3, scale: V3 = [1, 1, 1], rot: V3 = [0, 0, 0], o?: PartOpts, toward?: V3, bury: [number, number] = [0.22, 0.5]): this {
    const head = this.parts.find((q) => q.name === 'head') ?? this.parts[0];
    head.geo.computeBoundingSphere();
    const goal = toward ? V(toward) : head.geo.boundingSphere!.center.clone(), from = V(at), dir = goal.clone().sub(from).normalize();
    const turn = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)), size = new THREE.Matrix4().makeScale(r * scale[0], r * scale[1], r * scale[2]);
    const probe = Array.from({ length: 64 }, (_, i) => { const y = 1 - (2 * (i + 0.5)) / 64, rr = Math.sqrt(1 - y * y), a = i * 2.39996; return new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr); });
    const share = (c: THREE.Vector3) => {
      const m = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).multiply(turn).multiply(size), v = new THREE.Vector3();
      return probe.filter((q) => this.parts.some((part) => part.inside(v.copy(q).applyMatrix4(m)))).length / probe.length;
    };
    // 안쪽으로는 목표점을 넘지 않고, 목표 묻힘에 못 미치면 가장 많이 묻힌 자리(가는 꼬리 끝에 붙는 지느러미 등)
    const c = from.clone(), s0 = share(c), sign = s0 < bury[0] ? 1 : s0 > bury[1] ? -1 : 0, steps = sign > 0 ? Math.floor(from.distanceTo(goal) / 0.01) : 60;
    let best = { at: c.clone(), s: s0 };
    for (let i = 0; sign && i < steps; i++) {
      c.addScaledVector(dir, 0.01 * sign);
      const s1 = share(c);
      if (sign > 0 ? s1 >= bury[0] + 0.08 : s1 <= bury[1] - 0.08) { best = { at: c.clone(), s: s1 }; break; }
      if (sign > 0 && s1 > best.s) best = { at: c.clone(), s: s1 };
      if (sign < 0) best = { at: c.clone(), s: s1 };
    }
    this.lastLimb = [best.at.x, best.at.y, best.at.z];
    return this.sphere(r, this.lastLimb, scale, rot, o);
  }

  // 겉면에 반쯤 박힌 작은 공(코·젤리 볼록이): 앞에서 본 (x, y) 자리의 지금까지 만든 겉면에 붙인다. 기본은 부딪힘 아님·외곽선 없음
  nub(r: number, at: [number, number], scale: V3 = [1, 1, 1], o: PartOpts = {}): this {
    const meshes = this.parts.map((q) => new THREE.Mesh(q.geo));
    const { p, n } = surfaceAt(meshes, at[0], at[1]);
    const g = new THREE.SphereGeometry(r, ...this.sphereSeg(r, scale));
    g.scale(...scale);
    const look = new THREE.Matrix4().lookAt(new THREE.Vector3(), n.clone().negate(), UP);
    g.applyMatrix4(look);
    g.translate(p.x, p.y, p.z);
    const shape = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(look).multiply(new THREE.Matrix4().makeScale(r * scale[0], r * scale[1], r * scale[2]));
    return this.add(g, [{ c: p, r: r * 0.9 }], [{ c: p, r }], ellipsoid(shape), { outline: false, hit: 'none', ...o });
  }

  // 머리(이름 'head' 부위) 겉면의 높이: 위에서 (x, z)로 내려 쏜 첫 만남, 안 만나면 null — 왕관을 머리에 얹을 때
  headTopAt(x: number, z: number): number | null {
    const head = this.parts.filter((q) => q.name === 'head');
    const meshes = (head.length ? head : this.parts.filter((q) => q.hit === 'solid')).map((q) => new THREE.Mesh(q.geo, DOUBLE));
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
    return ray.intersectObjects(meshes, false)[0]?.point.y ?? null;
  }

  // 부위마다 몸(다른 부위들) 안에 묻힌 꼭짓점 비율 — 0이면 떨어져 보이고(외곽선이 둘레를 긋는다), 1이면 묻혀 안 보인다
  burial(): { name?: string; at: THREE.Vector3; size: number; share: number; outline: boolean }[] {
    return this.parts.map((q, i) => {
      const pos = q.geo.getAttribute('position'), step = Math.max(1, Math.floor(pos.count / 120)), v = new THREE.Vector3();
      let n = 0, hit = 0;
      for (let k = 0; k < pos.count; k += step) {
        v.fromBufferAttribute(pos, k); n++;
        if (this.parts.some((o, j) => j !== i && o.inside(v))) hit++;
      }
      q.geo.computeBoundingSphere();
      return { name: q.name, at: q.geo.boundingSphere!.center.clone(), size: q.geo.boundingSphere!.radius, share: hit / n, outline: q.outline };
    });
  }

  // 겉모습 없이 부딪힘 공·머리만 (그리기·얼굴 그림 없이) — 겨냥·물리가 쓴다
  shape(): { solid: Hit[]; ears: Hit[]; head: { c: number; r: number } } {
    const head = this.parts.find((p) => p.head)?.head;
    return {
      solid: prune(this.parts.filter((p) => p.hit === 'solid').flatMap((p) => p.balls.map((b) => ({ c: b.c.clone(), r: b.r })))),
      ears: this.parts.filter((p) => p.hit === 'ear').flatMap((p) => p.balls.map((b) => ({ c: b.c.clone(), r: b.r }))),
      head: head ?? { c: 0, r: 0 },
    };
  }

  // 단단한 부위(hit 'solid')의 꼭짓점 — 부딪힘 공이 겉모습을 감싸는지 재는 시험용
  solidPositions(): THREE.Vector3[] {
    return this.parts.filter((q) => q.hit === 'solid').flatMap((q) => {
      const pos = q.geo.getAttribute('position');
      return Array.from({ length: pos.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(pos, i));
    });
  }

  // 곡선을 따라 가는 관, 굵기는 t(0~1)에 따라 taper배. 부딪힘 공은 굵기 2.8배 간격으로 2~5개, 반지름은 관보다 1.1배(공 사이가 비지 않게)
  tube(points: V3[], r: number, taper: (t: number) => number = () => 1, o?: PartOpts): this {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => V(p)));
    const [tub, rad] = this.seg.tube;
    const g = new THREE.TubeGeometry(curve, tub, r, rad, false), pos = g.getAttribute('position'), p = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i <= tub; i++) {
      const k = taper(i / tub); curve.getPointAt(i / tub, c);
      for (let j = 0; j <= rad; j++) { const idx = i * (rad + 1) + j; p.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c); pos.setXYZ(idx, p.x, p.y, p.z); }
    }
    g.computeVertexNormals();
    const len = curve.getLength(), n = o?.balls ?? Math.min(5, Math.max(len > 3 * r ? 3 : 2, Math.ceil(len / (2.8 * r)) + 1)); // 굵기 3배보다 긴 관은 적어도 셋(가운데가 비지 않게)
    const balls = Array.from({ length: n }, (_, i) => { const t = i / (n - 1); return { c: curve.getPointAt(t), r: r * taper(t) * 1.1 }; });
    const m = Math.max(2, Math.ceil(len / 0.07));
    const occ = Array.from({ length: m + 1 }, (_, i) => ({ c: curve.getPointAt(i / m), r: r * taper(i / m) }));
    // 양끝을 같은 굵기의 공으로 막는다 — 열린 관 끝이 구멍처럼 보이지 않게 (외곽선 껍질도 함께 닫힌다)
    const caps = [0, 1].map((t) => { const c = new THREE.SphereGeometry(r * taper(t), ...this.seg.cap); const at = curve.getPointAt(t); c.translate(at.x, at.y, at.z); return c; });
    const merged = merge([g, ...caps]);
    const along = Array.from({ length: 41 }, (_, i) => ({ c: curve.getPointAt(i / 40), r: r * taper(i / 40) }));
    return this.add(merged, balls, occ, (p) => along.some((a) => p.distanceToSquared(a.c) <= a.r * a.r), o);
  }

  // 몸통: (높이, 반지름) 윤곽을 매끈하게 이어 돌린 배 모양 한 덩어리, 앞뒤로 flatZ배. 부딪힘 공 둘
  pear(profile: [number, number][], flatZ = 0.94, zOff = 0, o?: PartOpts): this {
    const curve = new THREE.CatmullRomCurve3(profile.map(([y, r]) => new THREE.Vector3(r, y, 0)));
    const pts = curve.getPoints(this.seg.curve).map((q) => new THREE.Vector2(Math.max(q.x, 0.0001), q.y));
    pts[0].x = 0.0001; pts[pts.length - 1].x = 0.0001;
    const g = new THREE.LatheGeometry(pts, this.seg.lathe);
    g.scale(1, 1, flatZ); g.translate(0, 0, zOff);
    // 아래 1/3·위 2/3 높이의 두 공. 반지름은 제 구역(더 가까운 공 쪽) 윤곽 점까지 닿게 — 가운데가 넓은 몸통(부엉이)도 감싼다
    const ys = pts.map((q) => q.y), y0 = Math.min(...ys), y1 = Math.max(...ys), k = (1 + flatZ) / 2;
    const centers = [y0 + (y1 - y0) * 0.32, y0 + (y1 - y0) * 0.66];
    const balls = centers.map((yb, i) => {
      let r = 0;
      for (const q of pts) if (Math.abs(q.y - yb) <= Math.abs(q.y - centers[1 - i])) r = Math.max(r, Math.hypot(q.x * k, q.y - yb));
      return { c: new THREE.Vector3(0, yb, zOff), r: r * 0.97 };
    });
    const occ = profile.filter(([, r]) => r > 0.05).map(([y, r]) => ({ c: new THREE.Vector3(0, y, zOff), r: r * 0.9 }));
    // 안쪽: 그 높이의 윤곽 반지름 안(앞뒤는 flatZ로 편 뒤)
    const radiusAt = (y: number) => { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if ((y - a.y) * (y - b.y) <= 0 && a.y !== b.y) return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y); } return -1; };
    const inside: Inside = (p) => { const r = radiusAt(p.y); return r > 0 && Math.hypot(p.x, (p.z - zOff) / flatZ) <= r; };
    // name 'head'면 위쪽 공을 머리로 (동글이형: 몸 하나가 머리이자 몸통)
    return this.add(g, balls, occ, inside, o, 'solid', o?.name === 'head' ? { c: balls[1].c.y, r: balls[1].r } : undefined);
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
    const turn = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(lean, 0, -side * 0.32));
    g.applyMatrix4(turn);
    g.translate(...at);
    const shape = new THREE.Matrix4().makeTranslation(...at).multiply(turn).multiply(new THREE.Matrix4().makeScale(r * 0.6, r * 1.3, r * 0.6 * flat));
    return this.add(g, [{ c: V(at), r: r * 0.75 }], [{ c: V(at), r: r * 0.75 }], ellipsoid(shape), o, 'ear');
  }

  // 그린 얼굴 조각: 앞에서 본 (x, y) 자리의 겉면에 w×h로 투사한다(얼굴 한 장 그림의 cell 칸). flip = 좌우 뒤집기(왼눈)
  paint(cell: Cell, at: [number, number], size: [number, number], name: string, flip = false): this {
    this.paints.push({ cell, at, size, name, flip });
    return this;
  }

  // 실로 수놓은 선: 앞에서 본 점들을 겉면에 붙인 가는 관. lite에서는 입('face-mouth')만 남긴다
  stitch(points: [number, number][], r = 0.009, name = 'stitch'): this {
    if (!this.o.lite || name === 'face-mouth') this.stitches.push({ points, r, name });
    return this;
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
      const m = new THREE.Mesh(merge(geos), colors(slot));
      if (slot === 'body') m.name = 'body';
      m.castShadow = true; m.receiveShadow = false;
      group.add(m); surface.push(m);
    }
    if (hulls.length) {
      const o = new THREE.Mesh(merge(hulls), PLUSH_OUTLINE);
      o.name = 'outline'; o.castShadow = true; o.receiveShadow = false;
      group.add(o);
    }
    for (const p of this.parts.filter((x) => x.hit === 'ear')) {
      const marker = new THREE.Object3D(); marker.name = 'ear';
      const b = p.balls[0];
      marker.position.copy(b.c); // 귀 자리 표지 (귀 모양은 몸 메시에 합쳐져 있다 — 휘기는 게임에서 쓰지 않는다, 설계 §4)
      marker.userData.ear = { c: b.c.clone(), r: b.r, out: new THREE.Vector3(Math.sign(b.c.x) || 1, 0.5, 0).normalize() };
      group.add(marker);
    }
    group.updateMatrixWorld(true);
    addPaints(group, surface, this.paints);
    addStitches(group, surface, this.stitches, colors('thread'), this.o.lite);
    const head = this.parts.find((p) => p.head)?.head;
    return {
      group, surface,
      solid: prune(this.parts.filter((p) => p.hit === 'solid').flatMap((p) => p.balls.map((b) => ({ c: b.c.clone(), r: b.r })))),
      ears: this.parts.filter((p) => p.hit === 'ear').flatMap((p) => p.balls.map((b) => ({ c: b.c.clone(), r: b.r }))),
      head: head ?? { c: 0, r: 0 },
    };
  }
}

const ray = new THREE.Raycaster(), FRONT = new THREE.Vector3(0, 0, -1), UP = new THREE.Vector3(0, 1, 0);
// 앞에서 본 (x, y) 자리의 겉면 점과 바깥 법선
function surfaceAt(surface: THREE.Mesh[], x: number, y: number): { p: THREE.Vector3; n: THREE.Vector3 } {
  ray.set(new THREE.Vector3(x, y, 6), FRONT);
  const hit = ray.intersectObjects(surface, false)[0];
  if (!hit?.face) throw new Error(`겉면 없음 ${x},${y}`);
  return { p: hit.point.clone(), n: hit.face.normal.clone().transformDirection(hit.object.matrixWorld) };
}

// 그림 붙일 자리 둘레(반지름 reach)의 삼각형만 떼어 낸 임시 메시들 — 투사(DecalGeometry)는 메시의 모든 삼각형을 자르므로 미리 줄인다
function near(surface: THREE.Mesh[], p: THREE.Vector3, reach: number): THREE.Mesh[] {
  const out: THREE.Mesh[] = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), r2 = (reach * 0.75 + 0.05) ** 2;
  for (const m of surface) {
    const g = m.geometry, pos = g.getAttribute('position'), idx = g.index, tri = (idx ? idx.count : pos.count) / 3;
    const keep: number[] = [];
    for (let t = 0; t < tri; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
      if (a.distanceToSquared(p) < r2 || b.distanceToSquared(p) < r2 || c.distanceToSquared(p) < r2) keep.push(i0, i1, i2);
    }
    if (!keep.length) continue;
    const sub = new THREE.BufferGeometry();
    sub.setAttribute('position', pos); sub.setAttribute('normal', g.getAttribute('normal'));
    sub.setIndex(keep);
    out.push(new THREE.Mesh(sub));
  }
  return out;
}

// 얼굴 조각을 겉면에 투사해 한 메시(FACE_MAT)로, 조각마다 이름 단 표지(자리·크기)를 남긴다 — 표정 시험이 읽는다
function addPaints(group: THREE.Group, surface: THREE.Mesh[], paints: Paint[]): void {
  if (!paints.length) return;
  ensureFaceAtlas();
  const geos: THREE.BufferGeometry[] = [];
  for (const pt of paints) {
    const { p, n } = surfaceAt(surface, pt.at[0], pt.at[1]);
    const rot = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().lookAt(p.clone().add(n), p, UP));
    const [u0, v0, u1, v1] = cellUV(pt.cell);
    for (const m of near(surface, p, Math.max(pt.size[0], pt.size[1]))) {
      const d = new DecalGeometry(m, p, rot, new THREE.Vector3(pt.size[0], pt.size[1], 0.25));
      const uv = d.getAttribute('uv');
      if (!uv || uv.count === 0) continue;
      for (let i = 0; i < uv.count; i++) { const u = uv.getX(i); uv.setXY(i, pt.flip ? u1 - u * (u1 - u0) : u0 + u * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); }
      geos.push(d);
    }
    const marker = new THREE.Object3D(); marker.name = pt.name; marker.position.copy(p); marker.scale.set(pt.size[0], pt.size[1], 1);
    group.add(marker);
  }
  const face = new THREE.Mesh(merge(geos), FACE_MAT);
  face.name = 'face'; face.renderOrder = 1;
  group.add(face);
}

function addStitches(group: THREE.Group, surface: THREE.Mesh[], stitches: Stitch[], mat: THREE.Material, lite: boolean): void {
  if (!stitches.length) return;
  const geos: THREE.BufferGeometry[] = [];
  for (const st of stitches) {
    const pts = st.points.map(([x, y]) => { const { p, n } = surfaceAt(surface, x, y); return p.addScaledVector(n, st.r * 0.4); });
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), lite ? 8 : 24, st.r, lite ? 5 : 8, false);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(1), 3));
    geos.push(g);
    const marker = new THREE.Object3D(); marker.name = st.name; marker.position.copy(pts[0]); group.add(marker);
  }
  const m = new THREE.Mesh(merge(geos), mat);
  m.name = 'stitch'; m.castShadow = false;
  group.add(m);
}

// 인덱스가 있는 도형·없는 도형이 섞여도 합칠 수 있게(섞이면 모두 인덱스 없이)
function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const list = geos.some((g) => !g.index) ? geos.map((g) => (g.index ? g.toNonIndexed() : g)) : geos;
  return mergeGeometries(list, false)!;
}

// 다른 공 안에 거의 다 들어간 공은 뺀다 (앞발 관 끝 공은 발 공 안 등) — 물리 계산을 줄이려고
function prune(balls: Hit[]): Hit[] {
  return balls.filter((a, i) => !balls.some((b, j) => j !== i && b.r >= a.r && a.c.distanceTo(b.c) + a.r <= b.r + 0.02 && (b.r > a.r || j < i)));
}

// 뒷면 외곽선 껍질: 법선 쪽으로 w만큼 부풀린 위치만 가진 도형
function hull(part: THREE.BufferGeometry, w: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  if (part.index) g.setIndex(part.index.clone());
  const p = (part.getAttribute('position') as THREE.BufferAttribute).clone(), n = part.getAttribute('normal');
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * w, p.getY(i) + n.getY(i) * w, p.getZ(i) + n.getZ(i) * w);
  g.setAttribute('position', p);
  g.setAttribute('normal', (n as THREE.BufferAttribute).clone()); // 무더기 live 모드가 법선을 읽는다
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
