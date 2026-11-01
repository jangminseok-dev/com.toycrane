import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DECOR, type DecorSpot } from '../data/storeLayout';
import type { Occluder } from '../game/occlusion';
import { fadeMaterials } from './bake';
import { PLAIN, makeDoll } from './dolls';
import { DOLL_SCALE } from './machine';
import { ROOM_HALF } from './layout';
import { prepTex } from './signs';
import { FACE_MAT } from './plush/faceAtlas';
import { PLUSH_OUTLINE } from './plush/kit';
import { outlineMat, part, toon } from './toon';

// 빈 미니·피규어 구역의 "준비 중" 장식 (설계 2026-10-31 §3.8): 누를 수 없는 덮개 기계 줄과 경품 진열장.
// 5단계에서 진짜 기계가 들어올 자리·크기와 비슷하게 — 미니는 2단 작은 기계, 피규어는 상자 기계, 가운데는 인형을 올린 진열장.
// 휴대폰 그리기 호출을 아끼려고 왼쪽·오른쪽마다 [꼭짓점 색 툰 한 덩어리 · 외곽선 · 천 덮개 · 준비 중 판] 넷으로 합친다
const ROOM = ROOM_HALF, PASTEL = [0xffc6dc, 0xd9c8ff, 0xbdeedd, 0xffe2a8];
const MAX_DEPTH = 2.2; // 가장 깊은 장식(미는 뽑기) — 벽 너머까지 늘린 장애물 상자도 앞면에서 이만큼만 쓴다
// 줄을 따라 칸 사이 간격(m) — 큰 홀(설계 2026-11-01 §3): 고리 줄마다 5대, 미는 뽑기 4대, 벤치 2개 (피규어는 9단계부터 진짜 기계)
const SPACING: Record<Exclude<DecorSpot['kind'], 'shelf'>, number> = { ring: 1.84, pusher: 2.8, bench: 2.5 };
const SHELF_DOLLS = ['bear', 'bunny', 'chick', 'penguin', 'cat', 'pig'];
// 진열장 인형은 종마다 한 번만 짓고 복사한다(도형·재질 공유) — 무더기용 판은 makePlush가 붙들지 않는다
const shelfDolls = new Map<string, THREE.Group | null>();
const shelfDoll = (id: string) => { if (!shelfDolls.has(id)) shelfDolls.set(id, makeDoll(id, PLAIN, true)); return shelfDolls.get(id)?.clone(true) ?? null; };
type V3 = [number, number, number];

const once = <T>(make: () => T) => { let v: T | undefined; return () => (v ??= make()); };
const G = once(() => ({
  miniBase: new RoundedBoxGeometry(0.9, 0.8, 0.9, 2, 0.03), miniCover: new RoundedBoxGeometry(0.94, 0.9, 0.94, 2, 0.08), miniTop: new RoundedBoxGeometry(0.94, 0.3, 0.94, 2, 0.03),
  pushBase: new RoundedBoxGeometry(2.2, 0.9, 2.0, 2, 0.04), pushCover: new RoundedBoxGeometry(2.24, 0.8, 2.04, 2, 0.1), pushTop: new RoundedBoxGeometry(2.24, 0.3, 0.5, 2, 0.04),
  seat: new RoundedBoxGeometry(1.6, 0.12, 0.5, 2, 0.04), leg: new THREE.BoxGeometry(0.1, 0.4, 0.4),
  card: new THREE.PlaneGeometry(0.5, 0.25),
}));

// 한 칸(기계 하나) 또는 진열장 하나를 로컬 좌표(앞 = +z)로 만든다
function unit(kind: DecorSpot['kind'], i: number, len: number): { solid: THREE.Group; covers: THREE.Mesh[]; cards: THREE.Mesh[] } {
  const g = G(), solid = new THREE.Group(), covers: THREE.Mesh[] = [], cards: THREE.Mesh[] = [];
  const add = (geo: THREE.BufferGeometry, color: number, pos: V3) => solid.add(part(geo, toon(color), pos, [1, 1, 1], [0, 0, 0], 1.03));
  const cover = (geo: THREE.BufferGeometry, pos: V3) => { const m = new THREE.Mesh(geo); m.position.set(...pos); covers.push(m); };
  const card = (pos: V3, w: number) => { const m = new THREE.Mesh(g.card); m.position.set(...pos); m.scale.setScalar(w / 0.5); cards.push(m); };
  const color = PASTEL[i % PASTEL.length];
  if (kind === 'ring') {
    add(g.miniBase, color, [0, 0.4, 0]); cover(g.miniCover, [0, 1.25, 0]); add(g.miniTop, color, [0, 1.85, 0]);
    card([0, 1.25, 0.48], 0.5);
  } else if (kind === 'pusher') {
    // 한 사람용 경품 미는 기계(설계 2026-11-01 §3): 넓은 받침 + 유리 덮개 + 뒤쪽 간판
    add(g.pushBase, color, [0, 0.45, 0]); cover(g.pushCover, [0, 1.3, 0]); add(g.pushTop, color, [0, 1.85, -0.75]);
    card([0, 1.3, 1.03], 0.7);
  } else if (kind === 'bench') {
    add(g.seat, 0xffd9a8, [0, 0.46, 0]);
    for (const x of [-0.6, 0.6]) add(g.leg, 0xb98b5e, [x, 0.2, 0]);
  } else {
    // 진열장: 흰 받침 + 가운데 높은 단, 양쪽 받침 위와 높은 단 위에 인형
    add(new RoundedBoxGeometry(len, 0.7, 0.95, 2, 0.03), 0xfbf8ff, [0, 0.35, 0]);
    add(new RoundedBoxGeometry(len - 0.2, 0.35, 0.42, 2, 0.03), 0xffe6f0, [0, 0.875, 0]);
    const place = (x: number, y: number, z: number, k: number) => {
      const d = shelfDoll(SHELF_DOLLS[k % SHELF_DOLLS.length]);
      if (!d) return;
      d.scale.setScalar(DOLL_SCALE); d.position.set(x, y, z); d.rotation.y = z < 0 ? Math.PI : 0;
      solid.add(d);
    };
    const n = Math.floor((len - 0.3) / 0.34);
    for (let k = 0; k < n; k++) {
      const x = -len / 2 + 0.3 + k * 0.34;
      place(x, 0.7, 0.33, k); place(x, 0.7, -0.33, k + 3);
      if (k % 2 === 0 && k > 0 && k < n - 1) place(x, 1.05, 0.08, k + 1);
    }
    card([0, 0.4, 0.48], 0.6);
  }
  return { solid, covers, cards };
}

// 메시마다 재질 색을 꼭짓점 색으로 옮겨 한 덩어리로(외곽선은 따로 한 덩어리)
// 새 인형(plush)의 외곽선은 외곽선 덩어리로, 그린 얼굴은 얼굴 덩어리로(uv를 지켜) 따로 모은다
function bakeColored(root: THREE.Object3D): { body: THREE.BufferGeometry | null; lines: THREE.BufferGeometry | null; faces: THREE.BufferGeometry | null } {
  root.updateMatrixWorld(true);
  const body: THREE.BufferGeometry[] = [], lines: THREE.BufferGeometry[] = [], faces: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
    if (m.material === FACE_MAT) { for (const key of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(key)) geo.deleteAttribute(key); faces.push(geo.index ? geo.toNonIndexed() : geo); return; }
    for (const key of Object.keys(geo.attributes)) if (key !== 'position' && key !== 'normal') geo.deleteAttribute(key);
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    const flat = geo.index ? geo.toNonIndexed() : geo;
    if (m.material === outlineMat || m.material === PLUSH_OUTLINE) { lines.push(flat); return; }
    const c = ((m.material as THREE.MeshBasicMaterial).color ?? new THREE.Color(0xffffff)).clone();
    const cols = new Float32Array(flat.attributes.position.count * 3);
    for (let k = 0; k < cols.length; k += 3) cols.set([c.r, c.g, c.b], k);
    flat.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    body.push(flat);
  });
  return { body: body.length ? mergeGeometries(body) : null, lines: lines.length ? mergeGeometries(lines) : null, faces: faces.length ? mergeGeometries(faces) : null };
}
// 덮개·안내판처럼 모양이 같은 것들을 놓인 자리 그대로 한 덩어리로
function mergeAt(root: THREE.Object3D): THREE.BufferGeometry | null {
  root.updateMatrixWorld(true);
  const geos: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
    geos.push(geo.index ? geo.toNonIndexed() : geo);
  });
  return geos.length ? mergeGeometries(geos) : null;
}

export function buildDecor(scene: THREE.Scene): Occluder[] {
  const cardTex = prepTex();
  // 장식 종류마다 한 무리(큰 홀에서 줄이 늘어도 그리기 호출이 늘지 않게) — 캐릭터를 가리는 그 무리만 흐려진다
  const kinds = [...new Set(DECOR.map((d) => d.kind))];
  return kinds.map((kind) => {
    const solidRoot = new THREE.Group(), coverRoot = new THREE.Group(), cardRoot = new THREE.Group(), group = new THREE.Group();
    group.name = `decor-${kind}`;
    const boxes: THREE.Box3[] = [];
    DECOR.forEach((d, si) => {
      if (d.kind !== kind) return;
      // 벽 너머까지 늘린 장애물 상자를 매장 안쪽으로 잘라, 앞면(ry 쪽)에서 MAX_DEPTH 깊이 안에 놓는다 — 가운데에 두면 앞에 걸어갈 수 없는 빈틈이 생긴다
      const x0 = Math.max(d.rect[0], -ROOM), z0 = Math.max(d.rect[1], -ROOM), x1 = Math.min(d.rect[2], ROOM), z1 = Math.min(d.rect[3], ROOM);
      const alongX = Math.abs(Math.cos(d.ry)) > 0.5; // 앞이 ±z면 줄은 x를 따라 놓인다
      const half = Math.min(alongX ? z1 - z0 : x1 - x0, MAX_DEPTH) / 2;
      const cx = alongX ? (x0 + x1) / 2 : Math.sin(d.ry) > 0 ? x1 - half : x0 + half;
      const cz = alongX ? (Math.cos(d.ry) > 0 ? z1 - half : z0 + half) : (z0 + z1) / 2;
      const len = alongX ? x1 - x0 : z1 - z0, box = new THREE.Box3();
      boxes.push(box);
      const holder = (child: THREE.Object3D, offset: number) => {
        const h = new THREE.Group();
        h.position.set(cx + (alongX ? offset : 0), 0, cz + (alongX ? 0 : offset)); h.rotation.y = d.ry;
        h.add(child); return h;
      };
      const step = d.kind === 'shelf' ? len : SPACING[d.kind], count = Math.max(1, Math.floor(len / step + 1e-6)), pad = (len - count * step) / 2;
      for (let k = 0; k < count; k++) {
        const offset = d.kind === 'shelf' ? 0 : -len / 2 + pad + step / 2 + k * step, u = unit(d.kind, si * 7 + k, len);
        const parts = [holder(u.solid, offset), ...u.covers.map((c) => holder(c, offset)), ...u.cards.map((c) => holder(c, offset))];
        solidRoot.add(parts[0]); coverRoot.add(...parts.slice(1, 1 + u.covers.length)); cardRoot.add(...parts.slice(1 + u.covers.length));
        for (const p of parts) box.expandByObject(p);
        const mark = holder(new THREE.Object3D(), offset); mark.name = `decor-unit-${d.kind}`; group.add(mark); // 칸 표지(그리지 않음)
      }
    });
    const { body, lines, faces } = bakeColored(solidRoot);
    const mats = [
      new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toon(0xffffff).gradientMap }),
      outlineMat.clone(),
      new THREE.MeshBasicMaterial({ color: 0xfff7fb, transparent: true, opacity: 0.88, depthWrite: false }),
      new THREE.MeshBasicMaterial({ map: cardTex }),
      FACE_MAT.clone(),
    ];
    [body, lines, mergeAt(coverRoot), mergeAt(cardRoot), faces].forEach((geo, k) => {
      if (!geo) return;
      const m = new THREE.Mesh(geo, mats[k]); m.castShadow = k === 0; m.receiveShadow = k === 0; group.add(m);
    });
    scene.add(group);
    return { box: new THREE.Box3().setFromObject(group), boxes, setOpacity: (o: number) => fadeMaterials(mats, o) };
  });
}
