import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MachineSpot } from '../data/storeLayout';
import { SPH_LO, canvasTex, part, toon, toonWith } from './toon';

// 큰인형 기계 (시제품 docs/reference/prototypes/spike-arcade-big-v3.html makeMachine, 578~711행).
// 실제 크레인 게임기 구성: 아래 캐비닛(투입구·조작대·상품 출구) / 유리 칸(펠트 바닥·상품 구멍·투명 가림막·뒷판) / 위 간판(이름판·전구)
const BODY = 0xf8f3fb, PANEL = 0x2b2433;
export const CLAW_REST = new THREE.Vector3(0.1, 1.95, 0); // 기계 안 좌표
export const DOLL_FLOOR = 0.87; // 펠트 위 인형 바닥 높이
export const DOLL_SCALE = 0.3; // 기계 속 인형 크기

// 기계 이름표(오리지널 이름)와 간판 색: 배치 순서대로 돌려 쓴다
const NAMES = ['곰돌이 대작전', '병아리 파티', '말랑 토끼', '포근 곰', '두근 크레인', '왕큰 인형', '행운 상자',
  '삐약 삐약', '한 번 더!', '인형 천국', '럭키 크레인', '토끼 마을', '꿀잼 뽑기'];
const TOPS = [0xff7ab6, 0xb48cff, 0xff9fcf, 0x8f7bff];
const LED_COLORS = { white: new THREE.Color(0xffffff), pink: new THREE.Color(0xff8fe0), blue: new THREE.Color(0x4fd8ff) };

const once = <T>(make: () => T) => { let v: T | undefined; return () => (v ??= make()); };
type V3 = [number, number, number];
const flat = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, rot: V3 = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.rotation.set(...rot); return m;
};

const G = once(() => ({
  cabinet: new THREE.BoxGeometry(1.2, 0.85, 1.05), ledStrip: new THREE.BoxGeometry(1.16, 0.03, 0.02), chuteRing: new THREE.BoxGeometry(0.42, 0.34, 0.02),
  chute: new THREE.BoxGeometry(0.32, 0.24, 0.03), coinPlate: new THREE.BoxGeometry(0.16, 0.22, 0.02), coinSlot: new THREE.BoxGeometry(0.03, 0.1, 0.03),
  card: new THREE.BoxGeometry(0.18, 0.12, 0.03), cardScreen: new THREE.PlaneGeometry(0.13, 0.07), panel: new THREE.BoxGeometry(1.2, 0.08, 0.28),
  panelLed: new THREE.BoxGeometry(1.16, 0.02, 0.02), stick: new THREE.CylinderGeometry(0.015, 0.015, 0.1, 8), button: new THREE.CylinderGeometry(0.07, 0.07, 0.04, 16),
  felt: new THREE.BoxGeometry(1.12, 0.02, 0.98), back: new THREE.PlaneGeometry(1.12, 1.08), inner: new THREE.BoxGeometry(1.04, 0.03, 0.05),
  hole: new THREE.PlaneGeometry(0.3, 0.3), glass: new THREE.BoxGeometry(1.14, 1.1, 1.0), pillar: new THREE.BoxGeometry(0.06, 1.1, 0.06),
  header: new THREE.BoxGeometry(1.26, 0.5, 1.11), marquee: new THREE.PlaneGeometry(1.0, 0.31), plate: new THREE.PlaneGeometry(0.26, 0.13), plateBox: new THREE.BoxGeometry(0.3, 0.17, 0.04),
  bulb: new THREE.SphereGeometry(0.026, 8, 6), bar: new THREE.BoxGeometry(0.03, 0.15, 0.02), acryl: new THREE.BoxGeometry(0.34, 0.2, 0.34),
  pole: new THREE.CylinderGeometry(0.012, 0.012, 0.85, 8),
}));
const EDGES = once(() => ({ glass: new THREE.EdgesGeometry(G().glass), acryl: new THREE.EdgesGeometry(G().acryl) }));

const M = once(() => {
  const backdropTex = canvasTex(256, 256, (g) => {
    g.fillStyle = '#f3e6ff'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(255,111,176,.35)'; g.font = '40px sans-serif'; g.textAlign = 'center';
    for (let y = 0; y < 5; y++) for (let x = 0; x < 4; x++) g.fillText((x + y) % 2 ? '★' : '♥', 32 + x * 64 + (y % 2) * 32, 40 + y * 52);
  });
  // 기계 위 체크무늬 삼각 깃발
  const flagTex = canvasTex(64, 64, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#ff5fa2'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
  }, [7, 7]);
  flagTex.rotation = Math.PI / 4;
  const flagShape = new THREE.Shape();
  flagShape.moveTo(0, 0); flagShape.lineTo(0.44, -0.2); flagShape.lineTo(0, -0.4); flagShape.closePath();
  return {
    glass: new THREE.MeshBasicMaterial({ color: 0xe8f8ff, transparent: true, opacity: 0.1, depthWrite: false }),
    edge: new THREE.LineBasicMaterial({ color: 0x3b2a5a }),
    acryl: new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.25, depthWrite: false }),
    acrylEdge: new THREE.LineBasicMaterial({ color: 0xffffff }),
    hole: new THREE.MeshBasicMaterial({ color: 0x1a1226 }),
    felt: toonWith({ color: 0xfff0f7, emissive: 0xfff0f7, emissiveIntensity: 0.45 }),
    backdrop: new THREE.MeshBasicMaterial({ map: backdropTex, color: 0xe6e0ea }),
    cardScreen: new THREE.MeshBasicMaterial({ color: 0x4fd8ff }),
    flag: new THREE.MeshLambertMaterial({ map: flagTex, side: THREE.DoubleSide }),
    flagGeo: new THREE.ShapeGeometry(flagShape),
  };
});

function fitFont(g: CanvasRenderingContext2D, text: string, size: number, weight: number, maxW: number): number {
  const font = () => `${weight} ${size}px -apple-system, "Apple SD Gothic Neo", sans-serif`;
  g.font = font();
  while (g.measureText(text).width > maxW && size > 8) { size -= 4; g.font = font(); }
  return size;
}
export function marqueeTex(text: string, color: number, h = 160): THREE.CanvasTexture {
  return canvasTex(512, h, (g) => {
    const c = '#' + new THREE.Color(color).getHexString();
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.3, c); grd.addColorStop(1, c);
    g.fillStyle = grd; g.fillRect(0, 0, 512, h);
    const fs = fitFont(g, text, h * 0.5, 900, 450);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = fs * 0.18; g.strokeStyle = '#3b2a5a'; g.strokeText(text, 256, h / 2 + 4);
    g.fillStyle = '#ffffff'; g.fillText(text, 256, h / 2 + 4);
  });
}
function plateTex(text: string): THREE.CanvasTexture {
  return canvasTex(128, 64, (g) => {
    g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(2, 2, 124, 60, 10); g.fill();
    g.fillStyle = '#3b2a5a'; g.font = '900 40px -apple-system, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 34);
  });
}

export type MachineParts = {
  statics: THREE.Group; // 움직이지 않는 부분 (기계 자리·방향에 놓임, 행마다 합침)
  ledGeo: THREE.BufferGeometry; // 기계의 LED 전부를 꼭짓점 색으로 한 덩어리 (기계 안 좌표)
};

// index: 배치 순서 (이름표·간판 색·깃발을 돌려 쓰는 기준)
export function makeMachineParts(spot: MachineSpot, index: number): MachineParts {
  const g = G(), mat = M(), m = new THREE.Group();
  m.position.set(spot.x, 0, spot.z); m.rotation.y = spot.ry;
  const add = (o: THREE.Object3D) => { m.add(o); return o; };
  // 아래 캐비닛
  add(part(g.cabinet, toon(BODY), [0, 0.425, 0], [1, 1, 1], [0, 0, 0], 1.02));
  add(part(g.chute, toon(PANEL), [-0.36, 0.3, 0.535], [1, 1, 1], [0, 0, 0], 0));
  // 코인 투입구 · 카드 단말기
  add(part(g.coinPlate, toon(0xc9c9d6), [0.42, 0.62, 0.53], [1, 1, 1], [0, 0, 0], 0));
  add(part(g.coinSlot, toon(PANEL), [0.42, 0.64, 0.535], [1, 1, 1], [0, 0, 0], 0));
  add(part(g.card, toon(PANEL), [0.15, 0.62, 0.535], [1, 1, 1], [0, 0, 0], 0));
  add(flat(g.cardScreen, mat.cardScreen, [0.15, 0.63, 0.552]));
  // 조작대: 검은 판 + 조이스틱 + 내리기 버튼
  add(part(g.panel, toon(PANEL), [0, 0.86, 0.62]));
  add(part(g.stick, toon(0x3b2a5a), [-0.25, 0.93, 0.66], [1, 1, 1], [0, 0, 0], 0));
  add(part(SPH_LO, toon(0xff5fa2), [-0.25, 0.99, 0.66], [0.05, 0.05, 0.05]));
  add(part(g.button, toon(0xff3b6b), [0.25, 0.92, 0.66]));
  // 유리 칸: 펠트 바닥, 뒷판 그림, 앞 위쪽 실내등
  add(flat(g.felt, mat.felt, [0, 0.86, 0]));
  add(flat(g.back, mat.backdrop, [0, 1.4, -0.48]));
  add(flat(g.inner, new THREE.MeshBasicMaterial({ color: 0xffffff }), [0, 1.91, 0.44]));
  // 상품 구멍 + 투명 아크릴 가림막 (앞 왼쪽 구석)
  add(flat(g.hole, mat.hole, [-0.36, 0.875, 0.27], [-Math.PI / 2, 0, 0]));
  add(flat(g.acryl, mat.acryl, [-0.36, 0.97, 0.27]));
  add(new THREE.LineSegments(EDGES().acryl, mat.acrylEdge)).position.set(-0.36, 0.97, 0.27);
  // 유리 + 기둥
  add(flat(g.glass, mat.glass, [0, 1.4, 0]));
  add(new THREE.LineSegments(EDGES().glass, mat.edge)).position.y = 1.4;
  for (const [x, z] of [[-0.57, -0.5], [0.57, -0.5], [-0.57, 0.5], [0.57, 0.5]]) add(part(g.pillar, toon(BODY), [x, 1.4, z], [1, 1, 1], [0, 0, 0], 0));
  // 위 간판 + 이름판 + 번호판
  add(part(g.header, toon(BODY), [0, 2.2, 0], [1, 1, 1], [0, 0, 0], 1.02));
  add(flat(g.marquee, new THREE.MeshBasicMaterial({ map: marqueeTex(NAMES[index % NAMES.length], TOPS[index % TOPS.length]) }), [0, 2.2, 0.558]));
  add(flat(g.plate, new THREE.MeshBasicMaterial({ map: plateTex(spot.id) }), [-0.42, 2.55, 0.5]));
  add(part(g.plateBox, toon(BODY), [-0.42, 2.55, 0.47], [1, 1, 1], [0, 0, 0], 1.04));
  if (index % 2 === 1) {
    const f = new THREE.Group();
    f.add(part(g.pole, toon(0xd8d0e0), [0, 0.425, 0], [1, 1, 1], [0, 0, 0], 0));
    f.add(flat(mat.flagGeo, mat.flag, [0.012, 0.85, 0]));
    f.position.set(0.4, 2.45, -0.3); f.rotation.z = -0.12;
    add(f);
  }
  m.traverse((o) => { o.castShadow = false; });

  // LED: 바닥 파란 띠·상품 출구 테두리·조작대 아래 띠·기둥 분홍 막대·간판 전구 → 꼭짓점 색으로 한 덩어리
  const leds: THREE.BufferGeometry[] = [];
  const led = (geo: THREE.BufferGeometry, color: THREE.Color, pos: V3) => {
    const l = geo.clone().translate(...pos);
    const n = l.attributes.position.count, cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) cols.set([color.r, color.g, color.b], i * 3);
    l.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    leds.push(l);
  };
  led(g.ledStrip, LED_COLORS.blue, [0, 0.05, 0.535]);
  led(g.chuteRing, LED_COLORS.blue, [-0.36, 0.3, 0.53]);
  led(g.panelLed, LED_COLORS.blue, [0, 0.815, 0.76]);
  for (const x of [-0.57, 0.57]) for (let i = 0; i < 6; i++) led(g.bar, LED_COLORS.pink, [x, 0.95 + i * 0.18, 0.535]);
  for (const y of [2.0, 2.4]) for (let i = 0; i < 8; i++) led(g.bulb, i % 2 ? LED_COLORS.pink : LED_COLORS.white, [-0.525 + i * 0.15, y, 0.565]);
  const ledGeo = mergeGeometries(leds.map((l) => (l.index ? l.toNonIndexed() : l)))!;

  return { statics: m, ledGeo };
}

export const ledBaseMat = once(() => new THREE.MeshBasicMaterial({ vertexColors: true }));
export const ledFlashMat = once(() => ({ hot: new THREE.MeshBasicMaterial({ color: 0xff5fa2 }), gold: new THREE.MeshBasicMaterial({ color: 0xffd36b }) }));
