import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DECOR, type DecorSpot } from '../data/storeLayout';
import type { Occluder } from '../game/occlusion';
import { fadeMaterials } from './bake';
import { PLAIN, makeDoll } from './dolls';
import { DOLL_SCALE } from './machine';
import { prepTex } from './signs';
import { outlineMat, part, toon } from './toon';

// 빈 미니·피규어 구역의 "준비 중" 장식 (설계 2026-10-31 §3.8): 누를 수 없는 덮개 기계 줄과 경품 진열장.
// 5단계에서 진짜 기계가 들어올 자리·크기와 비슷하게 — 미니는 2단 작은 기계, 피규어는 상자 기계, 가운데는 인형을 올린 진열장.
// 휴대폰 그리기 호출을 아끼려고 왼쪽·오른쪽마다 [꼭짓점 색 툰 한 덩어리 · 외곽선 · 천 덮개 · 준비 중 판] 넷으로 합친다
const ROOM = 13, PASTEL = [0xffc6dc, 0xd9c8ff, 0xbdeedd, 0xffe2a8];
const SHELF_DOLLS = ['bear', 'bunny', 'chick', 'penguin', 'cat', 'pig'];
type V3 = [number, number, number];

const once = <T>(make: () => T) => { let v: T | undefined; return () => (v ??= make()); };
const G = once(() => ({
  miniBase: new RoundedBoxGeometry(0.9, 0.8, 0.9, 2, 0.03), miniCover: new RoundedBoxGeometry(0.94, 0.9, 0.94, 2, 0.08), miniTop: new RoundedBoxGeometry(0.94, 0.3, 0.94, 2, 0.03),
  figBase: new RoundedBoxGeometry(1.0, 0.85, 1.0, 2, 0.03), figCover: new RoundedBoxGeometry(1.04, 1.0, 1.04, 2, 0.09), figTop: new RoundedBoxGeometry(1.04, 0.32, 1.04, 2, 0.03),
  card: new THREE.PlaneGeometry(0.5, 0.25),
}));

// 한 칸(기계 하나) 또는 진열장 하나를 로컬 좌표(앞 = +z)로 만든다
function unit(kind: DecorSpot['kind'], i: number, len: number): { solid: THREE.Group; covers: THREE.Mesh[]; cards: THREE.Mesh[] } {
  const g = G(), solid = new THREE.Group(), covers: THREE.Mesh[] = [], cards: THREE.Mesh[] = [];
  const add = (geo: THREE.BufferGeometry, color: number, pos: V3) => solid.add(part(geo, toon(color), pos, [1, 1, 1], [0, 0, 0], 1.03));
  const cover = (geo: THREE.BufferGeometry, pos: V3) => { const m = new THREE.Mesh(geo); m.position.set(...pos); covers.push(m); };
  const card = (pos: V3, w: number) => { const m = new THREE.Mesh(g.card); m.position.set(...pos); m.scale.setScalar(w / 0.5); cards.push(m); };
  const color = PASTEL[i % PASTEL.length];
  if (kind === 'mini') {
    add(g.miniBase, color, [0, 0.4, 0]); cover(g.miniCover, [0, 1.25, 0]); add(g.miniTop, color, [0, 1.85, 0]);
    card([0, 1.25, 0.48], 0.5);
  } else if (kind === 'figure') {
    add(g.figBase, color, [0, 0.425, 0]); cover(g.figCover, [0, 1.35, 0]); add(g.figTop, color, [0, 2.01, 0]);
    card([0, 1.35, 0.53], 0.56);
  } else {
    // 진열장: 흰 받침 + 가운데 높은 단, 양쪽 받침 위와 높은 단 위에 인형
    add(new RoundedBoxGeometry(len, 0.7, 0.95, 2, 0.03), 0xfbf8ff, [0, 0.35, 0]);
    add(new RoundedBoxGeometry(len - 0.2, 0.35, 0.42, 2, 0.03), 0xffe6f0, [0, 0.875, 0]);
    const place = (x: number, y: number, z: number, k: number) => {
      const d = makeDoll(SHELF_DOLLS[k % SHELF_DOLLS.length], PLAIN, true);
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
function bakeColored(root: THREE.Object3D): { body: THREE.BufferGeometry | null; lines: THREE.BufferGeometry | null } {
  root.updateMatrixWorld(true);
  const body: THREE.BufferGeometry[] = [], lines: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
    for (const key of Object.keys(geo.attributes)) if (key !== 'position' && key !== 'normal') geo.deleteAttribute(key);
    const flat = geo.index ? geo.toNonIndexed() : geo;
    if (m.material === outlineMat) { lines.push(flat); return; }
    const c = ((m.material as THREE.MeshBasicMaterial).color ?? new THREE.Color(0xffffff)).clone();
    const cols = new Float32Array(flat.attributes.position.count * 3);
    for (let k = 0; k < cols.length; k += 3) cols.set([c.r, c.g, c.b], k);
    flat.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    body.push(flat);
  });
  return { body: body.length ? mergeGeometries(body) : null, lines: lines.length ? mergeGeometries(lines) : null };
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
  // 장식 줄·진열장마다 한 무리 — 캐릭터를 가리는 그 무리만 흐려진다
  return DECOR.map((d, si) => {
    const solidRoot = new THREE.Group(), coverRoot = new THREE.Group(), cardRoot = new THREE.Group();
    // 벽 너머까지 늘린 장애물 상자를 매장 안쪽으로 잘라 그 안에 놓는다
    const x0 = Math.max(d.rect[0], -ROOM), z0 = Math.max(d.rect[1], -ROOM), x1 = Math.min(d.rect[2], ROOM), z1 = Math.min(d.rect[3], ROOM);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const alongX = Math.abs(Math.cos(d.ry)) > 0.5; // 앞이 ±z면 줄은 x를 따라 놓인다
    const len = alongX ? x1 - x0 : z1 - z0;
    const holder = (child: THREE.Object3D, offset: number) => {
      const h = new THREE.Group();
      h.position.set(cx + (alongX ? offset : 0), 0, cz + (alongX ? 0 : offset)); h.rotation.y = d.ry;
      h.add(child); return h;
    };
    const count = Math.floor(len / 1.1), pad = (len - count * 1.1) / 2;
    const pieces = d.kind === 'shelf' ? [{ offset: 0, u: unit('shelf', si, len) }]
      : Array.from({ length: count }, (_, k) => ({ offset: -len / 2 + pad + 0.55 + k * 1.1, u: unit(d.kind, si * 7 + k, len) }));
    for (const { offset, u } of pieces) {
      solidRoot.add(holder(u.solid, offset));
      for (const c of u.covers) coverRoot.add(holder(c, offset));
      for (const c of u.cards) cardRoot.add(holder(c, offset));
    }
    const { body, lines } = bakeColored(solidRoot);
    const mats = [
      new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toon(0xffffff).gradientMap }),
      outlineMat.clone(),
      new THREE.MeshBasicMaterial({ color: 0xfff7fb, transparent: true, opacity: 0.88, depthWrite: false }),
      new THREE.MeshBasicMaterial({ map: cardTex }),
    ];
    const group = new THREE.Group(); group.name = `decor-${d.kind}-${si}`;
    [body, lines, mergeAt(coverRoot), mergeAt(cardRoot)].forEach((geo, k) => {
      if (!geo) return;
      const m = new THREE.Mesh(geo, mats[k]); m.castShadow = k === 0; m.receiveShadow = k === 0; group.add(m);
    });
    scene.add(group);
    return { box: new THREE.Box3().setFromObject(group), setOpacity: (o: number) => fadeMaterials(mats, o) };
  });
}
