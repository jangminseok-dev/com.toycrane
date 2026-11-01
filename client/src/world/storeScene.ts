import * as THREE from 'three';
import { PLAZA_RADIUS, ROOM_HALF, ROOM_HEIGHT, SPAWN_RADIUS, TOWER_HALF } from './layout';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { adSignCell, adSignsTex } from './signs';
import { AD_BOARDS } from '../data/storeLayout';
import { canvasTex, outlineMat, part, toon, toonWith } from './toon';
import { DOLLS } from '../data/catalog';
import { fadeMaterials, materialCloner } from './bake';
import { bakePlush } from './plushBake';
import { PLAIN, makeDoll } from './dolls';

// 매장 겉모습(밝은 대형 일본 게임센터): 큰 판 대리석 바닥 · 흰 벽 + 색 띠·별 · "toycrane 게임센터" 벽 간판 ·
// 구역 바닥 색 · 허브 4면 전광판 탑 · 스폰 링. 카메라가 위에서 내려다보므로 천장은 없다(설계 §3.7 2차)
// (설계 2026-10-31-toycrane-graphics-a-design.md §3.1·§4.4, 시제품 docs/reference/prototypes/spike-look-a.html)
// 탑이 내 캐릭터를 가릴 때 흐리게 하려고 탑 상자와 투명도 조절을 돌려준다
export type HubTower = {
  box: THREE.Box3;
  setOpacity(opacity: number): void;
  showMessage(line1: string, line2: string, gold: boolean, seconds: number): void; // 4면 전광판 문구를 잠깐 바꾼다(희귀 알림)
};

export function buildStore(scene: THREE.Scene): HubTower {
  scene.background = new THREE.Color(0xf4f1f7);
  addLights(scene);
  addFloor(scene);
  addWallsAndCeiling(scene);
  addZones(scene);
  addEntrance(scene);
  addPlazaAds(scene);
  return addDisplayTower(scene);
}

function addLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xeee6f2, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(3, 14, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0005;
  // 큰 홀 끝까지(벽 ±22 + 기울어진 해에 높이 2.4m가 밀리는 몫) — 그림자 카메라 위쪽을 북쪽(−z)에 맞춰 홀 네모가 그림자 그림에 반듯이 들어간다
  const S = ROOM_HALF + 1.5;
  sun.shadow.camera.up.set(0, 0, -1);
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S });
  scene.add(sun);
}

// 같은 무늬가 매번 같게 나오도록 고정된 난수
function seeded(seed: number) {
  let v = seed;
  return () => { v = (v * 16807) % 2147483647; return (v - 1) / 2147483646; };
}

// 큰 판(1.2m) 밝은 회백색 대리석: 판마다 밝기를 조금씩 다르게, 회색 결 곡선, 가는 줄눈
function addFloor(scene: THREE.Scene) {
  const size = ROOM_HALF * 2, rnd = seeded(11);
  const tex = canvasTex(1024, 1024, (g) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const base = 236 - ((x + y) % 2) * 6;
      const grd = g.createLinearGradient(x * 512, y * 512, x * 512 + 512, y * 512 + 512);
      grd.addColorStop(0, `rgb(${base},${base - 1},${base + 3})`); grd.addColorStop(1, `rgb(${base - 10},${base - 11},${base - 6})`);
      g.fillStyle = grd; g.fillRect(x * 512, y * 512, 512, 512);
    }
    g.fillStyle = 'rgba(120,110,130,.05)';
    for (let i = 0; i < 2500; i++) g.fillRect(rnd() * 1024, rnd() * 1024, 2, 2);
    for (let k = 0; k < 26; k++) {
      let x = rnd() * 1024, y = rnd() * 1024;
      g.strokeStyle = `rgba(${120 + rnd() * 40},${118 + rnd() * 40},${130 + rnd() * 40},${0.1 + rnd() * 0.25})`;
      g.lineWidth = 0.6 + rnd() * (k < 6 ? 3.2 : 1.4);
      g.beginPath(); g.moveTo(x, y);
      for (let n = 0; n < 6; n++) {
        const nx = x + (rnd() - 0.3) * 220, ny = y + (rnd() - 0.5) * 160;
        g.quadraticCurveTo(x + (rnd() - 0.5) * 120, y + (rnd() - 0.5) * 120, nx, ny); x = nx; y = ny;
      }
      g.stroke();
    }
    g.strokeStyle = 'rgba(150,145,160,.55)'; g.lineWidth = 3;
    for (const k of [0, 512, 1024]) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 1024); g.moveTo(0, k); g.lineTo(1024, k); g.stroke(); }
  }, [size / 2.4, size / 2.4]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), toonWith({ map: tex }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
}

function addWallsAndCeiling(scene: THREE.Scene) {
  const size = ROOM_HALF * 2, h = ROOM_HEIGHT;
  // 흰 벽 + 위쪽 분홍·노랑·하늘 띠 + 별 (6.5m마다 되풀이)
  const wallTex = canvasTex(1024, 512, (g) => {
    const rnd = seeded(5);
    g.fillStyle = '#fbf9fd'; g.fillRect(0, 0, 1024, 512);
    ['#ff6fb5', '#ffd84d', '#5ec8ff'].forEach((c, i) => { g.fillStyle = c; g.fillRect(0, 70 + i * 22, 1024, 22); });
    const colors = ['#ff6fb5', '#ffd84d', '#5ec8ff'];
    for (let i = 0; i < 22; i++) {
      const x = rnd() * 1024, y = 180 + rnd() * 260, r = 10 + rnd() * 12;
      g.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, q = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
      g.closePath(); g.fillStyle = colors[i % 3]; g.fill();
    }
  }, [size / 6.5, 1]);
  const wallMat = toonWith({ map: wallTex });
  // 벽은 안쪽 면만 그려서 카메라가 방 밖으로 나가면 그쪽 벽이 저절로 사라진다
  for (const [x, z, ry] of [[0, -ROOM_HALF, 0], [0, ROOM_HALF, Math.PI], [-ROOM_HALF, 0, Math.PI / 2], [ROOM_HALF, 0, -Math.PI / 2]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(size, h), wallMat);
    w.position.set(x, h / 2, z); w.rotation.y = ry; w.receiveShadow = true; w.name = 'hall-wall';
    scene.add(w);
  }
}

function addZones(scene: THREE.Scene) {
  // 구역 바닥 칠(큰 홀, 설계 2026-11-01 §3, layout.zoneAt과 같은 모양): 서쪽 인형, 동쪽 피규어, 북쪽 고리·미는 뽑기, 남쪽 두 모서리 쉼터,
  // 가운데 둥근 광장 — 꼭짓점 색으로 한 덩어리
  const tints: THREE.BufferGeometry[] = [];
  const tint = (color: number, geo: THREE.BufferGeometry, x: number, z: number) => {
    geo.rotateX(-Math.PI / 2).translate(x, 0.005, z);
    const c = new THREE.Color(color), n = geo.getAttribute('position').count;
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Array.from({ length: n }, () => [c.r, c.g, c.b]).flat()), 3));
    tints.push(geo.index ? geo.toNonIndexed() : geo);
  };
  tint(0xff7ab6, new THREE.PlaneGeometry(11, 19), -16.5, 0);
  tint(0xb48cff, new THREE.PlaneGeometry(10.5, 20), 16.75, 0);
  tint(0x4fd8ff, new THREE.PlaneGeometry(44, 8), 0, -18);
  tint(0x7bd88f, new THREE.PlaneGeometry(9, 9), -17.5, 17.5);
  tint(0x7bd88f, new THREE.PlaneGeometry(9, 9), 17.5, 17.5);
  tint(0xffe08a, new THREE.CircleGeometry(PLAZA_RADIUS, 72), 0, 0);
  const zones = new THREE.Mesh(mergeGeometries(tints)!, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.1, depthWrite: false }));
  zones.name = 'zone-tints';
  scene.add(zones);
  floorLabels(scene, [
    ['인형뽑기', -16.5, 9.2], ['피규어뽑기', 16.75, 10.2], ['고리뽑기', -8, -13.6], ['미는뽑기', 0, -13.6], ['고리뽑기', 8, -13.6],
    ['쉼터', -17.5, 13.6], ['쉼터', 17.5, 13.6], ['입구', 0, ROOM_HALF - 2.2],
  ]);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(SPAWN_RADIUS - 0.1, SPAWN_RADIUS + 0.1, 72),
    new THREE.MeshBasicMaterial({ color: 0xff7ab6, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012;
  scene.add(ring);
}

// 바닥 글씨(구역 이름): 한 그림에 줄마다 하나씩 그려 메시 하나로
function floorLabels(scene: THREE.Scene, labels: [string, number, number][]) {
  const rowH = 128, tex = canvasTex(512, rowH * labels.length, (g) => {
    g.font = '900 88px -apple-system, "Apple SD Gothic Neo", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(80,60,100,.25)';
    labels.forEach(([text], i) => g.fillText(text, 256, i * rowH + 68));
  });
  const geos = labels.map(([, x, z], i) => {
    const geo = new THREE.PlaneGeometry(4, 1), uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1 - uv.getY(k)) / labels.length); // 캔버스 위에서 i번째 줄
    return geo.rotateX(-Math.PI / 2).translate(x, 0.01, z);
  });
  const m = new THREE.Mesh(mergeGeometries(geos)!, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.name = 'floor-labels';
  scene.add(m);
}

// 광장 진열탑(설계 2026-11-01 §3): 3단 진열대에 큰 인형·피규어 상자(투명 창 안에 작은 인형), 꼭대기에 4면 전광판(희귀 알림).
// 피규어 모델은 피규어 뽑기 단계에서 — 지금 상자 속은 우리 인형. 인형·상자는 재질별로 합쳐 그린다
const TIERS: [number, number, number][] = [[TOWER_HALF * 2, 0, 0.9], [2.5, 0.9, 1.7], [1.8, 1.7, 2.5]]; // 폭, 아래, 위
const BOARD = { w: 2.6, y0: 3.0, y1: 4.3 };
function addDisplayTower(scene: THREE.Scene): HubTower {
  const root = new THREE.Group(); root.name = 'display-tower';
  scene.add(root);
  // 탑만 흐려지게 공용 재질(툰·외곽선)을 복제해 쓴다
  const bodyMat = toon(0xfbf8ff).clone(), trimMat = toon(0xffb3d9).clone(), edgeMat = outlineMat.clone();
  const add = (mesh: THREE.Mesh) => { mesh.traverse((o) => { if (o instanceof THREE.Mesh && o.material === outlineMat) o.material = edgeMat; }); root.add(mesh); };
  TIERS.forEach(([w, y0, y1], k) => add(part(new THREE.BoxGeometry(w, y1 - y0, w), k % 2 ? trimMat : bodyMat, [0, (y0 + y1) / 2, 0], [1, 1, 1], [0, 0, 0], 1.02)));
  add(part(new THREE.BoxGeometry(0.6, BOARD.y0 - TIERS[2][2], 0.6), bodyMat, [0, (BOARD.y0 + TIERS[2][2]) / 2, 0], [1, 1, 1], [0, 0, 0], 1.02));
  add(part(new THREE.BoxGeometry(BOARD.w, BOARD.y1 - BOARD.y0, BOARD.w), toon(0x2a2236).clone(), [0, (BOARD.y0 + BOARD.y1) / 2, 0], [1, 1, 1], [0, 0, 0], 1.02));
  // 진열: 아래 단 가장자리에 큰 인형(면마다 둘), 가운데 단에 피규어 상자(면마다 둘), 맨 위 단 네 모서리에 큰 인형
  const kinds = Object.keys(DOLLS), shelf = new THREE.Group();
  const boxMat = toon(0xffe9a8), glass = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false });
  const boxGeo = new THREE.BoxGeometry(0.3, 0.42, 0.2), windowGeo = new THREE.PlaneGeometry(0.24, 0.32);
  const doll = (k: number, scale: number, x: number, y: number, z: number, ry: number) => {
    const d = makeDoll(kinds[k % kinds.length], PLAIN, true);
    if (!d) return;
    d.scale.setScalar(scale); d.position.set(x, y, z); d.rotation.y = ry;
    shelf.add(d);
  };
  for (let side = 0; side < 4; side++) {
    const ry = (side * Math.PI) / 2, out = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), along = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
    for (const t of [-0.6, 0.6]) {
      const a = out.clone().multiplyScalar(1.42).addScaledVector(along, t), b = out.clone().multiplyScalar(1.07).addScaledVector(along, t * 0.75);
      doll(side * 2 + (t > 0 ? 1 : 0), 0.5, a.x, TIERS[0][2], a.z, ry);
      const box = new THREE.Mesh(boxGeo, boxMat); box.position.set(b.x, TIERS[1][2] + 0.21, b.z); box.rotation.y = ry; shelf.add(box);
      const pane = new THREE.Mesh(windowGeo, glass); pane.position.copy(box.position).addScaledVector(out, 0.101); pane.rotation.y = ry; shelf.add(pane);
      doll(8 + side * 2 + (t > 0 ? 1 : 0), 0.22, b.x, TIERS[1][2] + 0.04, b.z, ry);
    }
    const c = out.clone().add(along).multiplyScalar(0.62);
    doll(16 + side, 0.62, c.x, TIERS[2][2], c.z, ry + Math.PI / 4);
  }
  const cloner = materialCloner();
  for (const m of bakePlush(shelf, cloner.remap)) root.add(m);
  // 전광판: 평소엔 "toycrane / 어서 오세요", 희귀가 나오면 잠깐 금색 알림 (시제품 drawBoard)
  const draw = (l1: string, l2: string, gold: boolean) => (g: CanvasRenderingContext2D) => {
    g.shadowBlur = 0;
    g.fillStyle = '#0d0a14'; g.fillRect(0, 0, 512, 384);
    g.fillStyle = 'rgba(255,255,255,.05)';
    for (let y = 4; y < 384; y += 8) for (let x = 4; x < 512; x += 8) g.fillRect(x, y, 3, 3);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowBlur = 24; g.shadowColor = gold ? '#ffd36b' : '#ff5fdc'; g.fillStyle = gold ? '#ffe28a' : '#ff9fe8';
    fitText(g, l1, 92, 900, 470); g.fillText(l1, 256, 170);
    g.shadowColor = '#4fd8ff'; g.fillStyle = '#ffffff';
    fitText(g, l2, 40, 700, 480); g.fillText(l2, 256, 262);
  };
  const idle = draw('toycrane', '어서 오세요', false);
  const screenTex = canvasTex(512, 384, idle);
  let restoreTimer = 0;
  const redraw = (paint: (g: CanvasRenderingContext2D) => void) => {
    paint((screenTex.image as HTMLCanvasElement).getContext('2d')!);
    screenTex.needsUpdate = true;
  };
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
  const screenGeo = new THREE.PlaneGeometry(BOARD.w - 0.2, BOARD.y1 - BOARD.y0 - 0.2);
  for (let k = 0; k < 4; k++) {
    const side = new THREE.Group(); side.rotation.y = (k * Math.PI) / 2;
    const screen = new THREE.Mesh(screenGeo, screenMat); screen.name = 'tower-screen';
    screen.position.set(0, (BOARD.y0 + BOARD.y1) / 2, BOARD.w / 2 + 0.012);
    side.add(screen);
    root.add(side);
  }
  const mats: THREE.Material[] = [bodyMat, trimMat, edgeMat, screenMat];
  root.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m && !mats.includes(m) && !cloner.materials.includes(m)) mats.push(m); });
  return {
    box: new THREE.Box3(new THREE.Vector3(-TOWER_HALF, 0, -TOWER_HALF), new THREE.Vector3(TOWER_HALF, BOARD.y1, TOWER_HALF)),
    showMessage(line1, line2, gold, seconds) {
      redraw(draw(line1, line2, gold));
      clearTimeout(restoreTimer);
      restoreTimer = setTimeout(() => redraw(idle), seconds * 1000) as unknown as number;
    },
    setOpacity(opacity) {
      for (const m of mats) {
        if (m.transparent !== opacity < 1) { m.transparent = opacity < 1; m.needsUpdate = true; }
        m.opacity = opacity;
        m.depthWrite = opacity >= 1;
      }
      fadeMaterials(cloner.materials, opacity);
    },
  };
}

// 광장 광고판(설계 2026-11-01 §3): 기둥 위 양면 판 4개, 면은 ±z(걷기 카메라가 늘 북쪽을 봐서 남쪽 면이 보인다).
// 판마다 광고 자리 하나(shared/ads.json, 광고는 여기 4개에만) — 한 그림의 칸을 나눠 쓴다. 판 앞뒤 한 덩어리 + 기둥 한 덩어리
function addPlazaAds(scene: THREE.Scene) {
  const W = 2.4, H = 1.4, Y = 1.6;
  const faces = AD_BOARDS.flatMap(({ x, z, slot }) => [0, Math.PI].map((ry) => {
    const geo = new THREE.PlaneGeometry(W, H), uv = geo.getAttribute('uv') as THREE.BufferAttribute, cell = adSignCell(slot - 1);
    for (let k = 0; k < uv.count; k++) uv.setXY(k, cell.u + uv.getX(k) * cell.w, cell.v + uv.getY(k) * cell.h);
    return geo.translate(0, 0, 0.06).rotateY(ry).translate(x, Y, z);
  }));
  const boards = new THREE.Mesh(mergeGeometries(faces)!, new THREE.MeshBasicMaterial({ map: adSignsTex() }));
  boards.name = 'plaza-ads';
  scene.add(boards);
  scene.add(outlinedBoxes(AD_BOARDS.flatMap(({ x, z }) => [
    [W + 0.12, H + 0.12, 0.1, x, Y, z], [0.14, Y - H / 2, 0.14, x, (Y - H / 2) / 2, z],
  ] as Box[]), toon(0xfbf8ff)));
}

// 상자 여러 개를 한 덩어리로 + 외곽선 한 덩어리 — 외곽선은 상자마다 제 가운데에서 키운다
// (합친 도형을 part()로 감싸면 외곽선이 원점에서 커져 멀리 있는 상자 앞을 덮는다)
type Box = [number, number, number, number, number, number]; // 폭, 높이, 깊이, x, y, z
function outlinedBoxes(boxes: Box[], mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(mergeGeometries(boxes.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z)))!, mat);
  body.castShadow = true;
  g.add(body, new THREE.Mesh(mergeGeometries(boxes.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).scale(1.06, 1.06, 1.06).translate(x, y, z)))!, outlineMat));
  return g;
}

// 입구(남쪽 벽 가운데): 기둥 둘과 가로대를 한 덩어리로 — 걷기 카메라가 북쪽을 보므로 남쪽으로 걸어갈 때만 보인다
function addEntrance(scene: THREE.Scene) {
  const z = ROOM_HALF - 0.4;
  const g = outlinedBoxes([[0.4, 3, 0.4, -2.2, 1.5, z], [0.4, 3, 0.4, 2.2, 1.5, z], [4.8, 0.5, 0.4, 0, 2.9, z]], toon(0xff7ab6));
  g.name = 'entrance';
  scene.add(g);
}

// 글자가 폭을 넘으면 크기를 줄인다
function fitText(g: CanvasRenderingContext2D, text: string, size: number, weight: number, maxW: number) {
  const font = () => `${weight} ${size}px -apple-system, "Apple SD Gothic Neo", sans-serif`;
  g.font = font();
  while (g.measureText(text).width > maxW && size > 12) { size -= 4; g.font = font(); }
}
