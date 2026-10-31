import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MachineSpot } from '../data/storeLayout';
import { MACHINE_SIGNS, POP_CARDS } from './copy';
import { backArtTex, plateTex, popTex, signTex, stickerTex } from './signs';
import { part, toon } from './toon';

// 큰인형 기계 — 밝은 일본 게임센터 모양 (설계 2026-10-31-toycrane-graphics-a-design.md §4.1, 시제품 spike-look-a.html).
// 아래 캐비닛(원색 몸통·흰 앞판·상품 출구·코인 투입구·레버와 버튼 둘) / 유리 칸(크롬 기둥·펠트·뒷판 그림·상품 구멍과 투명 가림막·
// 천장 조명판·레일·유리 반사 줄·손글씨 안내 카드) / 위 간판(몸통 색 상자·이름판·번호판, 둘레 전구는 bigZone이 행마다 한 덩어리로)
export const CLAW_REST = new THREE.Vector3(-0.36, 1.95, 0.27); // 기계 안 좌표 — 상품 구멍 위(앞 왼쪽): 한 판은 여기서 시작한다(설계 §3.10)
export const DOLL_FLOOR = 0.87; // 펠트 위 인형 바닥 높이
export const DOLL_SCALE = 0.3; // 기계 속 인형 크기
// 조작대(기계 안 좌표): 레버(끌면 집게가 그쪽으로), 큰 빨간 하강 버튼 하나 (설계 §3.10, 3차)
export const CONTROLS = { lever: [-0.3, 0.92, 0.66], drop: [0.26, 0.925, 0.66] } as const;

// 기계마다 원색 몸통·펠트 색을 배치 순서대로 돌려 쓴다
export const MACHINE_COLORS = [0xe8384f, 0xffb81f, 0x2f7cf6, 0xff4f9a, 0x22b36b, 0x8b5cf6, 0xff8a1f, 0x12b5cb];
export const FELT_COLORS = [0x8fd3ff, 0xff9ec7, 0xffe08a, 0xb7e4a8];
const BACK_ART: [number, number][] = [[0xe8f7ff, 0xc6e7ff], [0xffe8ee, 0xffc6d4], [0xfff8de, 0xffeaa8], [0xebfbf1, 0xc9f2da]];
const POP_COLORS: [number, number][] = [[0xffe14d, 0xe8384f], [0xfff36b, 0xe8384f], [0xfff36b, 0x16a05b], [0xff4f9a, 0xffffff], [0xffffff, 0x2f6fe0], [0xffe14d, 0x7c4ff0]];
const LED = { sky: new THREE.Color(0x7fd6ff), pink: new THREE.Color(0xff6fb5), slot: new THREE.Color(0x66ffcc) };
const WHITE = 0xf8f6fb, CHROME = 0xd3d6de, DARK = 0x1b1820;

const once = <T>(make: () => T) => { let v: T | undefined; return () => (v ??= make()); };
const cached = <T>(make: (key: string) => T) => { const m = new Map<string, T>(); return (key: string) => { if (!m.has(key)) m.set(key, make(key)); return m.get(key)!; }; };
type V3 = [number, number, number];
const flat = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, rot: V3 = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.rotation.set(...rot); return m;
};
const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 1, r); // 모서리 마디 1 — 툰 칠·외곽선에서는 차이가 안 보이고 삼각형은 훨씬 적다

const G = once(() => ({
  cabinet: rbox(1.2, 0.85, 1.05, 0.04), front: rbox(1.04, 0.5, 0.02, 0.008), chute: rbox(0.32, 0.24, 0.03, 0.01),
  flap: new THREE.BoxGeometry(0.3, 0.01, 0.06), coinPlate: rbox(0.16, 0.22, 0.03, 0.01), sticker: new THREE.PlaneGeometry(0.2, 0.1),
  deck: rbox(1.2, 0.07, 0.28, 0.02), leverBase: new THREE.CylinderGeometry(0.05, 0.055, 0.02, 20), stick: new THREE.CylinderGeometry(0.01, 0.01, 0.09, 10),
  ball: new THREE.SphereGeometry(0.04, 16, 12), ring: new THREE.CylinderGeometry(0.065, 0.068, 0.025, 24), dome: new THREE.SphereGeometry(0.055, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  pillar: rbox(0.06, 1.1, 0.06, 0.015), felt: new THREE.BoxGeometry(1.12, 0.02, 0.98), back: new THREE.PlaneGeometry(1.12, 1.08),
  hole: new THREE.PlaneGeometry(0.3, 0.3), acryl: new THREE.BoxGeometry(0.34, 0.2, 0.34), rim: rbox(0.34, 0.012, 0.012, 0.004),
  ceilingLight: new THREE.PlaneGeometry(1.0, 0.85), rail: rbox(1.08, 0.022, 0.022, 0.008), glass: new THREE.BoxGeometry(1.14, 1.1, 1.0),
  streak: new THREE.PlaneGeometry(0.06, 0.55), streakThin: new THREE.PlaneGeometry(0.025, 0.55), pop: new THREE.PlaneGeometry(0.2, 0.14),
  header: rbox(1.26, 0.5, 1.11, 0.04), sign: new THREE.PlaneGeometry(1.0, 0.31), plate: new THREE.PlaneGeometry(0.26, 0.11), plateBox: rbox(0.3, 0.15, 0.04, 0.012),
  ledStrip: new THREE.BoxGeometry(1.16, 0.03, 0.02), ledBar: new THREE.BoxGeometry(0.3, 0.012, 0.012), ledSide: new THREE.BoxGeometry(0.012, 0.24, 0.012),
  slot: new THREE.BoxGeometry(0.016, 0.08, 0.006), pillarLed: new THREE.BoxGeometry(0.015, 1.0, 0.015),
}));
const EDGES = once(() => ({ glass: new THREE.EdgesGeometry(G().glass), acryl: new THREE.EdgesGeometry(G().acryl) }));

// 재질: 같은 것은 모든 기계가 나눠 쓴다(행마다 합칠 때 그리기 호출이 늘지 않게). 기계마다 다른 그림은 간판·번호판·안내 카드뿐
const M = once(() => ({
  glass: new THREE.MeshBasicMaterial({ color: 0xe8f8ff, transparent: true, opacity: 0.1, depthWrite: false }),
  edge: new THREE.LineBasicMaterial({ color: 0x3b2a5a }),
  acryl: new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.25, depthWrite: false }),
  acrylEdge: new THREE.LineBasicMaterial({ color: 0xffffff }),
  hole: new THREE.MeshBasicMaterial({ color: 0x1a1226 }),
  light: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  streak: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }),
  flap: new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.35, depthWrite: false }),
  sticker: new THREE.MeshBasicMaterial({ map: stickerTex(), alphaTest: 0.5 }),
}));
const backMat = cached((k) => { const [c1, c2] = BACK_ART[Number(k)]; return new THREE.MeshBasicMaterial({ map: backArtTex(c1, c2) }); });
const popMat = cached((k) => { const i = Number(k), [bg, fg] = POP_COLORS[i]; return new THREE.MeshBasicMaterial({ map: popTex(POP_CARDS[i], bg, fg), alphaTest: 0.5, side: THREE.DoubleSide }); });
const signMat = cached((k) => { const [name, color] = k.split('|'); return new THREE.MeshBasicMaterial({ map: signTex(name, Number(color)) }); });

// 간판 둘레 전구 자리(기계 안 좌표, 간판 앞면보다 앞): 위·아래 변과 양옆, 0.05m 간격
export const bulbSpots = once((): THREE.Vector3[] => {
  const pts: THREE.Vector3[] = [], cx = 0, cy = 2.2, z = 0.575, bw = 0.54, bh = 0.19, step = 0.05;
  for (let x = -bw; x <= bw + 1e-6; x += step) pts.push(new THREE.Vector3(cx + x, cy + bh, z), new THREE.Vector3(cx + x, cy - bh, z));
  for (let y = -bh + step; y < bh - 1e-6; y += step) pts.push(new THREE.Vector3(cx - bw, cy + y, z), new THREE.Vector3(cx + bw, cy + y, z));
  return pts;
});

export type MachineParts = {
  statics: THREE.Group; // 움직이지 않는 부분 (기계 자리·방향에 놓임, 행마다 합침)
  ledGeo: THREE.BufferGeometry; // 기계의 LED 띠·테두리 전부를 꼭짓점 색으로 한 덩어리 (기계 안 좌표)
};

// 기계 안 좌표의 레버 막대·공과 하강 버튼 — 모든 기계가 같은 모양이라 행마다 InstancedMesh로 그린다(world/bigZone.ts)
export function makeControlParts(): THREE.Group {
  const g = G(), m = new THREE.Group();
  const [lx, ly, lz] = CONTROLS.lever, [dx, dy, dz] = CONTROLS.drop;
  m.add(part(g.stick, toon(CHROME), [lx, ly + 0.04, lz], [1, 1, 1], [0, 0, 0], 0));
  m.add(part(g.ball, toon(0xff3b5c), [lx, ly + 0.1, lz]));
  m.add(part(g.dome, toon(0xff3b5c), [dx, dy, dz], [1.45, 0.6, 1.45], [0, 0, 0], 1.04));
  return m;
}

// index: 배치 순서 (몸통·펠트 색, 이름표, 안내 카드를 돌려 쓰는 기준)
export function makeMachineParts(spot: MachineSpot, index: number): MachineParts {
  const g = G(), mat = M(), m = new THREE.Group();
  m.position.set(spot.x, 0, spot.z); m.rotation.y = spot.ry;
  const add = (o: THREE.Object3D) => { m.add(o); return o; };
  const color = MACHINE_COLORS[index % MACHINE_COLORS.length], felt = index % FELT_COLORS.length;
  const chrome = toon(CHROME), white = toon(WHITE);
  // 아래 캐비닛: 원색 몸통 + 흰 앞판 + 상품 출구(투명 덮개) + 크롬 코인 투입구·스티커
  const cabinet = add(part(g.cabinet, toon(color), [0, 0.425, 0], [1, 1, 1], [0, 0, 0], 1.02));
  cabinet.name = 'cabinet';
  add(part(g.front, white, [0, 0.42, 0.528], [1, 1, 1], [0, 0, 0], 0));
  add(part(g.chute, toon(DARK), [-0.36, 0.3, 0.54], [1, 1, 1], [0, 0, 0], 0));
  add(flat(g.flap, mat.flap, [-0.36, 0.41, 0.565], [0.5, 0, 0]));
  add(part(g.coinPlate, chrome, [0.42, 0.5, 0.54], [1, 1, 1], [0, 0, 0], 0));
  add(flat(g.sticker, mat.sticker, [0.42, 0.7, 0.53]));
  // 조작대: 흰 판 + 레버 크롬 받침 + 하강 버튼 크롬 고리 (움직이는 레버 막대·공과 버튼은 makeControlParts — 하는 기계에서 숨길 수 있게 따로 그린다)
  add(part(g.deck, white, [0, 0.875, 0.62], [1, 1, 1], [0, 0, 0], 1.03));
  const [lx, ly, lz] = CONTROLS.lever;
  add(part(g.leverBase, chrome, [lx, ly, lz], [1, 1, 1], [0, 0, 0], 0));
  const [dx, dy, dz] = CONTROLS.drop;
  add(part(g.ring, chrome, [dx, dy - 0.01, dz], [1.45, 1, 1.45], [0, 0, 0], 0));
  // 유리 칸: 크롬 기둥 · 펠트 · 뒷판 그림 · 천장 조명판 · 레일
  for (const [x, z] of [[-0.57, -0.5], [0.57, -0.5], [-0.57, 0.5], [0.57, 0.5]]) add(part(g.pillar, chrome, [x, 1.4, z], [1, 1, 1], [0, 0, 0], 1.04));
  add(part(g.felt, toon(FELT_COLORS[felt]), [0, 0.86, 0], [1, 1, 1], [0, 0, 0], 0));
  add(flat(g.back, backMat(String(felt)), [0, 1.4, -0.48]));
  add(flat(g.ceilingLight, mat.light, [0, 1.93, 0], [Math.PI / 2, 0, 0]));
  for (const z of [-0.42, 0.42]) add(part(g.rail, chrome, [0, 1.9, z], [1, 1, 1], [0, 0, 0], 0));
  // 상품 구멍 + 투명 아크릴 가림막 + 크롬 테두리 (앞 왼쪽 구석)
  add(flat(g.hole, mat.hole, [-0.36, 0.875, 0.27], [-Math.PI / 2, 0, 0]));
  add(flat(g.acryl, mat.acryl, [-0.36, 0.97, 0.27]));
  add(new THREE.LineSegments(EDGES().acryl, mat.acrylEdge)).position.set(-0.36, 0.97, 0.27);
  add(part(g.rim, chrome, [-0.36, 1.07, 0.1], [1, 1, 1], [0, 0, 0], 0));
  add(part(g.rim, chrome, [-0.19, 1.07, 0.27], [1, 1, 1], [0, Math.PI / 2, 0], 0));
  // 유리 + 테두리 + 만화식 대각 반사 줄 + 손글씨 안내 카드
  add(flat(g.glass, mat.glass, [0, 1.4, 0]));
  add(new THREE.LineSegments(EDGES().glass, mat.edge)).position.y = 1.4;
  add(flat(g.streak, mat.streak, [0.22, 1.5, 0.505], [0, 0, -0.5]));
  add(flat(g.streakThin, mat.streak, [0.31, 1.5, 0.505], [0, 0, -0.5]));
  add(flat(g.pop, popMat(String(index % POP_CARDS.length)), [0.4, 1.72, 0.47], [0, 0, -0.12]));
  // 위 간판: 몸통 색 상자 + 이름판 + 번호판
  add(part(g.header, toon(color), [0, 2.2, 0], [1, 1, 1], [0, 0, 0], 1.02));
  add(flat(g.sign, signMat(`${MACHINE_SIGNS[spot.kind] ?? ''}|${color}`), [0, 2.2, 0.558])); // 그 기계에 든 캐릭터 이름 간판
  add(part(g.plateBox, white, [-0.42, 2.53, 0.47], [1, 1, 1], [0, 0, 0], 1.04));
  add(flat(g.plate, new THREE.MeshBasicMaterial({ map: plateTex(spot.id) }), [-0.42, 2.53, 0.492]));
  m.traverse((o) => { o.castShadow = false; });

  // LED: 바닥 띠·상품 출구 테두리·투입 슬롯·앞 기둥 줄 → 꼭짓점 색으로 한 덩어리
  const leds: THREE.BufferGeometry[] = [];
  const led = (geo: THREE.BufferGeometry, c: THREE.Color, pos: V3) => {
    const l = geo.clone().translate(...pos);
    const n = l.attributes.position.count, cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) cols.set([c.r, c.g, c.b], i * 3);
    l.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    leds.push(l);
  };
  led(g.ledStrip, LED.sky, [0, 0.05, 0.535]);
  for (const y of [0.18, 0.42]) led(g.ledBar, LED.pink, [-0.36, y, 0.56]);
  for (const x of [-0.52, -0.2]) led(g.ledSide, LED.pink, [x, 0.3, 0.56]);
  led(g.slot, LED.slot, [0.42, 0.53, 0.558]);
  const tint = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.6);
  for (const x of [-0.53, 0.53]) led(g.pillarLed, tint, [x, 1.4, 0.49]);
  const ledGeo = mergeGeometries(leds.map((l) => (l.index ? l.toNonIndexed() : l)))!;

  return { statics: m, ledGeo };
}

export const ledBaseMat = once(() => new THREE.MeshBasicMaterial({ vertexColors: true }));
export const ledFlashMat = once(() => ({ hot: new THREE.MeshBasicMaterial({ color: 0xff5fa2 }), gold: new THREE.MeshBasicMaterial({ color: 0xffd36b }) }));
