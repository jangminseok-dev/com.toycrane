import * as THREE from 'three';
import { HUB_HALF, ROOM_HALF, ROOM_HEIGHT, SPAWN_RADIUS, TOWER_HALF } from './layout';
import { canvasTex, outlineMat, part, toon } from './toon';

// 매장 겉모습: 회색 대리석 바닥 · 어두운 보라 벽 · 천장 분홍 네온 · 구역 바닥 색 · 허브 4면 전광판 탑 · 스폰 링
// (분위기 고증: 설계 §4.2, 시제품 docs/reference/prototypes/spike-arcade-big-v3.html)
// 탑이 내 캐릭터를 가릴 때 흐리게 하려고 탑 상자와 투명도 조절을 돌려준다
export type HubTower = { box: THREE.Box3; setOpacity(opacity: number): void };

export function buildStore(scene: THREE.Scene): HubTower {
  scene.background = new THREE.Color(0x1c1526);
  addLights(scene);
  addFloor(scene);
  addWallsAndCeiling(scene);
  addZones(scene);
  return addHubTower(scene);
}

function addLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xf0d0ff, 0x553a6a, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 0.75);
  sun.position.set(0.6, 14, 1.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0005;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
  scene.add(sun);
  for (const [color, x, z, i] of [[0xff4fd0, -6.5, -6.5, 7], [0xff4fd0, 6.5, -6.5, 7], [0xff4fd0, -6.5, 6.5, 7], [0xff4fd0, 6.5, 6.5, 7], [0xfff0e6, 0, 0, 5]]) {
    const l = new THREE.PointLight(color, i, 0, 2);
    l.position.set(x, 3.1, z);
    scene.add(l);
  }
}

function addFloor(scene: THREE.Scene) {
  const size = ROOM_HALF * 2;
  const tex = canvasTex(1024, 1024, (g) => {
    g.fillStyle = '#9b97a4'; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * 1024, y = Math.random() * 1024, r = 80 + Math.random() * 220;
      const c = Math.random() < 0.5 ? '255,255,255' : '55,50,66';
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(${c},.07)`); grd.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // 결무늬: 같은 방향으로 길게 흐르는 곡선 (넓고 흐린 줄 위에 가는 줄)
    for (let i = 0; i < 9; i++) {
      const pts: [number, number][] = [[-100, Math.random() * 1024]];
      for (let j = 1; j <= 4; j++) pts.push([j * 300 - 100, pts[j - 1][1] + (Math.random() - 0.35) * 260]);
      for (const [w, a, blur] of [[7, 0.06, 4], [1.4, 0.18 + Math.random() * 0.15, 0.6]]) {
        g.filter = `blur(${blur}px)`;
        g.strokeStyle = `rgba(240,236,246,${a})`; g.lineWidth = w;
        g.beginPath(); g.moveTo(...pts[0]);
        for (let j = 1; j < pts.length; j++) {
          const [px, py] = pts[j - 1], [x, y] = pts[j];
          g.bezierCurveTo(px + 100, py + (Math.random() - 0.5) * 120, x - 100, y + (Math.random() - 0.5) * 120, x, y);
        }
        g.stroke();
      }
    }
    g.filter = 'none';
    g.strokeStyle = 'rgba(40,35,52,.16)'; g.lineWidth = 2; g.strokeRect(0, 0, 1024, 1024);
  }, [size / 2.4, size / 2.4]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.32, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
}

function addWallsAndCeiling(scene: THREE.Scene) {
  const size = ROOM_HALF * 2, h = ROOM_HEIGHT;
  const wallTex = () => canvasTex(128, 384, (g) => {
    g.fillStyle = '#271e38'; g.fillRect(0, 0, 128, 384);
    g.fillStyle = '#211931'; g.fillRect(0, 0, 4, 384); g.fillRect(64, 0, 4, 384);
    g.fillStyle = '#1a1427'; g.fillRect(0, 368, 128, 16);
  }, [size / 0.8, 1]);
  // 벽은 안쪽 면만 그려서 카메라가 방 밖으로 나가면 그쪽 벽이 저절로 사라진다
  for (const [x, z, ry] of [[0, -ROOM_HALF, 0], [0, ROOM_HALF, Math.PI], [-ROOM_HALF, 0, Math.PI / 2], [ROOM_HALF, 0, -Math.PI / 2]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(size, h), new THREE.MeshLambertMaterial({ map: wallTex() }));
    w.position.set(x, h / 2, z); w.rotation.y = ry; w.receiveShadow = true;
    scene.add(w);
  }
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ color: 0x1c1526 }));
  ceiling.rotation.x = Math.PI / 2; ceiling.position.y = h;
  scene.add(ceiling);
  const neon = new THREE.MeshBasicMaterial({ color: 0xff5fdc });
  const y = h - 0.05, edge = ROOM_HALF - 0.1;
  // 카메라가 천장보다 높이 따라가므로 가로지르는 줄은 두지 않고 벽 테두리만 두른다
  for (const z of [-edge, edge]) addBox(scene, [size - 0.2, 0.05, 0.05], [0, y, z], neon);
  for (const x of [-edge, edge]) addBox(scene, [0.05, 0.05, size - 0.2], [x, y, 0], neon);
}

function addZones(scene: THREE.Scene) {
  const tint = (color: number, opacity: number, w: number, d: number, x: number, z: number, y = 0.005) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
    scene.add(m);
  };
  // 큰인형 = 위쪽 띠, 미니·피규어 = 좌우 ㄴ자 (layout.zoneAt과 같은 모양)
  tint(0xff7ab6, 0.16, 26, 7.5, 0, -9.25);
  tint(0xb48cff, 0.18, 7.5, 18.5, -9.25, 3.75);
  tint(0xb48cff, 0.18, 5, 7.5, -3, 9.25);
  tint(0x4fd8ff, 0.14, 7.5, 18.5, 9.25, 3.75);
  tint(0x4fd8ff, 0.14, 5, 7.5, 3, 9.25);
  tint(0xffe08a, 0.08, HUB_HALF * 2, HUB_HALF * 2, 0, 0, 0.006);
  floorText(scene, '큰인형', 0, -9.25);
  floorText(scene, '미니', -9.25, 1);
  floorText(scene, '피규어', 9.25, 1);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(SPAWN_RADIUS - 0.1, SPAWN_RADIUS + 0.1, 72),
    new THREE.MeshBasicMaterial({ color: 0x6bffb0, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012;
  scene.add(ring);
}

function floorText(scene: THREE.Scene, text: string, x: number, z: number) {
  const tex = canvasTex(512, 128, (g) => {
    g.font = '900 88px -apple-system, "Apple SD Gothic Neo", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,.28)'; g.fillText(text, 256, 68);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.01, z);
  scene.add(m);
}

function addHubTower(scene: THREE.Scene): HubTower {
  const w = TOWER_HALF * 2, h = 2.8;
  // 탑만 흐려지게 공용 재질(툰·외곽선)을 복제해 쓴다
  const bodyMat = toon(0x2b2433).clone(), edgeMat = outlineMat.clone();
  const body = part(new THREE.BoxGeometry(w, h, w), bodyMat, [0, h / 2, 0], [1, 1, 1], [0, 0, 0], 1.02);
  body.traverse((o) => { if (o instanceof THREE.Mesh && o.material === outlineMat) o.material = edgeMat; });
  scene.add(body);
  const screenTex = canvasTex(512, 384, (g) => {
    g.fillStyle = '#0d0a14'; g.fillRect(0, 0, 512, 384);
    g.fillStyle = 'rgba(255,255,255,.05)';
    for (let y = 4; y < 384; y += 8) for (let x = 4; x < 512; x += 8) g.fillRect(x, y, 3, 3);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowBlur = 24; g.shadowColor = '#ff5fdc'; g.fillStyle = '#ff9fe8';
    g.font = '900 92px -apple-system, "Apple SD Gothic Neo", sans-serif'; g.fillText('toycrane', 256, 170);
    g.shadowColor = '#4fd8ff'; g.fillStyle = '#ffffff';
    g.font = '700 40px -apple-system, "Apple SD Gothic Neo", sans-serif'; g.fillText('어서 오세요', 256, 262);
  });
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
  const glow = new THREE.MeshBasicMaterial({ color: 0x4fd8ff });
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
    setOpacity(opacity) {
      for (const m of mats) {
        if (m.transparent !== opacity < 1) { m.transparent = opacity < 1; m.needsUpdate = true; }
        m.opacity = opacity;
        m.depthWrite = opacity >= 1;
      }
    },
  };
}

function addBox(scene: THREE.Scene, size: [number, number, number], pos: [number, number, number], mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  m.position.set(...pos);
  scene.add(m);
}
