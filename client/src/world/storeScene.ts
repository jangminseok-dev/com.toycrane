import * as THREE from 'three';
import { HUB_HALF, ROOM_HALF, ROOM_HEIGHT, SPAWN_RADIUS, TOWER_HALF } from './layout';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { adSignCell, adSignsTex } from './signs';
import { canvasTex, outlineMat, part, toon, toonWith } from './toon';

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
  return addHubTower(scene);
}

function addLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xeee6f2, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(3, 14, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0005;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
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
    w.position.set(x, h / 2, z); w.rotation.y = ry; w.receiveShadow = true;
    scene.add(w);
  }
  // 벽 광고 간판 10장('광고문의1'~'광고문의10', 교환소 개편 설계 §4.6): 북쪽 4·동쪽 2·서쪽 2·남쪽 2, 한 그림의 칸을 나눠 써 메시 하나로
  const spots: [number, number, number][] = [ // x, z, 돌림(벽 안쪽을 봄)
    [-9, -ROOM_HALF + 0.02, 0], [-3, -ROOM_HALF + 0.02, 0], [3, -ROOM_HALF + 0.02, 0], [9, -ROOM_HALF + 0.02, 0],
    [ROOM_HALF - 0.02, -1, -Math.PI / 2], [ROOM_HALF - 0.02, 6, -Math.PI / 2], [-ROOM_HALF + 0.02, -1, Math.PI / 2], [-ROOM_HALF + 0.02, 6, Math.PI / 2],
    [-5, ROOM_HALF - 0.02, Math.PI], [5, ROOM_HALF - 0.02, Math.PI],
  ];
  const signs = mergeGeometries(spots.map(([x, z, ry], i) => {
    const geo = new THREE.PlaneGeometry(1.4, 0.7), uv = geo.getAttribute('uv') as THREE.BufferAttribute, cell = adSignCell(i);
    for (let k = 0; k < uv.count; k++) uv.setXY(k, cell.u + uv.getX(k) * cell.w, cell.v + uv.getY(k) * cell.h);
    return geo.rotateY(ry).translate(x, h - 0.42, z);
  }))!;
  const sign = new THREE.Mesh(signs, new THREE.MeshBasicMaterial({ map: adSignsTex() }));
  sign.name = 'wall-signs';
  scene.add(sign);
}

function addZones(scene: THREE.Scene) {
  const tint = (color: number, opacity: number, w: number, d: number, x: number, z: number, y = 0.005) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
    scene.add(m);
  };
  // 큰인형 = 위쪽 띠, 미니·피규어 = 좌우 ㄴ자 (layout.zoneAt과 같은 모양)
  tint(0xff7ab6, 0.08, 26, 7.5, 0, -9.25);
  tint(0xb48cff, 0.1, 7.5, 18.5, -9.25, 3.75);
  tint(0xb48cff, 0.1, 5, 7.5, -3, 9.25);
  tint(0x4fd8ff, 0.1, 7.5, 18.5, 9.25, 3.75);
  tint(0x4fd8ff, 0.1, 5, 7.5, 3, 9.25);
  tint(0xffe08a, 0.06, HUB_HALF * 2, HUB_HALF * 2, 0, 0, 0.006);
  floorText(scene, '큰인형', 0, -9.25);
  floorText(scene, '미니', -9.25, 1);
  floorText(scene, '피규어', 9.25, 1);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(SPAWN_RADIUS - 0.1, SPAWN_RADIUS + 0.1, 72),
    new THREE.MeshBasicMaterial({ color: 0xff7ab6, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012;
  scene.add(ring);
}

function floorText(scene: THREE.Scene, text: string, x: number, z: number) {
  const tex = canvasTex(512, 128, (g) => {
    g.font = '900 88px -apple-system, "Apple SD Gothic Neo", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(80,60,100,.25)'; g.fillText(text, 256, 68);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.01, z);
  scene.add(m);
}

function addHubTower(scene: THREE.Scene): HubTower {
  const w = TOWER_HALF * 2, h = 2.8;
  // 탑만 흐려지게 공용 재질(툰·외곽선)을 복제해 쓴다
  const bodyMat = toon(0xfbf8ff).clone(), edgeMat = outlineMat.clone();
  const body = part(new THREE.BoxGeometry(w, h, w), bodyMat, [0, h / 2, 0], [1, 1, 1], [0, 0, 0], 1.02);
  body.traverse((o) => { if (o instanceof THREE.Mesh && o.material === outlineMat) o.material = edgeMat; });
  scene.add(body);
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
  const glow = new THREE.MeshBasicMaterial({ color: 0xff6fb5 });
  for (let k = 0; k < 4; k++) {
    const side = new THREE.Group(); side.rotation.y = (k * Math.PI) / 2;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.25, 1.7), screenMat);
    screen.position.set(0, 1.85, TOWER_HALF + 0.012);
    side.add(screen);
    const band = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.04, 0.02), glow);
    band.position.set(0, 0.08, TOWER_HALF + 0.012);
    side.add(band);
    scene.add(side);
  }
  const mats = [bodyMat, edgeMat, screenMat, glow];
  return {
    box: new THREE.Box3(new THREE.Vector3(-TOWER_HALF, 0, -TOWER_HALF), new THREE.Vector3(TOWER_HALF, h, TOWER_HALF)),
    showMessage(line1, line2, gold, seconds) {
      redraw(draw(line1, line2, gold));
      clearTimeout(restoreTimer);
      restoreTimer = window.setTimeout(() => redraw(idle), seconds * 1000);
    },
    setOpacity(opacity) {
      for (const m of mats) {
        if (m.transparent !== opacity < 1) { m.transparent = opacity < 1; m.needsUpdate = true; }
        m.opacity = opacity;
        m.depthWrite = opacity >= 1;
      }
    },
  };
}

// 글자가 폭을 넘으면 크기를 줄인다
function fitText(g: CanvasRenderingContext2D, text: string, size: number, weight: number, maxW: number) {
  const font = () => `${weight} ${size}px -apple-system, "Apple SD Gothic Neo", sans-serif`;
  g.font = font();
  while (g.measureText(text).width > maxW && size > 12) { size -= 4; g.font = font(); }
}
