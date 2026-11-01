import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DOLLS } from '../data/catalog';
import { PLAIN } from '../world/dolls';
import { makePlush } from '../world/plush';
import { CEL } from '../world/plush/cel';
import { PLUSH_OUTLINE } from '../world/plush/kit';

// 피규어 생김새 시안 (버리는 시험 페이지, 개발 서버 전용): 우리 인형 빌더 그대로에서 천 주름 그늘만 빼고 재질만 바꿔 받침대에 세운다.
// A 만화 반짝이(셀 음영 + 외곽선 + 반짝 하이라이트), B 반짝이 플라스틱(외곽선 없음, 코팅), C 무광 비닐(외곽선 + 매트). ?only=a|b|c 로 한 줄만 크게
const q = new URLSearchParams(location.search), only = q.get('only');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf6ebee);
const pmrem = new THREE.PMREMGenerator(renderer);
const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 80);

// 인형 도감과 같은 조명
scene.add(new THREE.HemisphereLight(0xfffaff, 0xe2cfd8, 0.9));
const key = new THREE.DirectionalLight(0xfff0e0, 2.6); key.position.set(2.5, 5, 4); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 8; key.shadow.bias = -0.0004;
Object.assign(key.shadow.camera, { left: -8, bottom: -8, right: 8, top: 8 }); scene.add(key);
const fill = new THREE.DirectionalLight(0xeee6ff, 0.5); fill.position.set(-4, 2.5, 3); scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 1.3); rim.position.set(-2, 4, -5); scene.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshStandardMaterial({ color: 0xf1e3e8, roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

// A: 셀 음영에 빛 방향 반짝임(단계 하나)과 가장자리 밝힘. ?spec=세기(기본 0.4) ?size=작을수록 큰 점(기본 0.985) — 게임처럼 해(가장 센 빛) 하나에서만
const SPEC = Number(q.get('spec') ?? 0.4).toFixed(3), SIZE = Number(q.get('size') ?? 0.985).toFixed(4);
const shinyToon = THREE.ShaderChunk.lights_toon_pars_fragment.replace(
  'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
  `reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
  float spec = smoothstep( ${SIZE}, ${SIZE} + 0.005, dot( geometryNormal, normalize( directLight.direction + geometryViewDir ) ) );
  reflectedLight.directDiffuse += directLight.color * spec * ${SPEC} * step( 2.0, directLight.color.r );`);
const RIM = `
  float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
  outgoingLight += diffuseColor.rgb * 0.22 * smoothstep(0.35, 0.5, rimF);
  #include <opaque_fragment>`;
type Style = 'a' | 'b' | 'c';
function restyle(m: THREE.Material, style: Style): THREE.Material {
  if (!(m as THREE.MeshToonMaterial).isMeshToonMaterial || !m.userData.plush) return m; // 얼굴 그림·외곽선은 그대로
  const src = m as THREE.MeshToonMaterial;
  if (style === 'a') {
    const t = new THREE.MeshToonMaterial({ color: src.color, map: src.map, gradientMap: CEL });
    t.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_toon_pars_fragment>', shinyToon).replace('#include <opaque_fragment>', RIM);
    };
    t.customProgramCacheKey = () => 'figure-a';
    return t;
  }
  if (style === 'b') return new THREE.MeshPhysicalMaterial({ color: src.color, map: src.map, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08, envMap: env, envMapIntensity: 0.8 });
  return new THREE.MeshStandardMaterial({ color: src.color, map: src.map, roughness: 0.62, envMap: env, envMapIntensity: 0.35 });
}

const labels: { el: HTMLDivElement; at: THREE.Vector3 }[] = [];
const label = (text: string, at: THREE.Vector3, cls = '') => {
  const el = document.createElement('div'); el.textContent = text; if (cls) el.className = cls;
  document.getElementById('labels')!.append(el); labels.push({ el, at });
};
const BASES = [0xffc6dc, 0xbdeedd, 0xd9c8ff, 0xffe2a8];
function figure(id: string, style: Style, x: number, z: number, i: number): void {
  const p = makePlush(id, { ...PLAIN, face: 1 }, false);
  if (!p) return;
  const g = p.group;
  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.material === PLUSH_OUTLINE) { if (style === 'b') mesh.visible = false; return; }
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => restyle(m, style)) : restyle(mesh.material, style);
    mesh.castShadow = true;
  });
  // 둥근 받침대(투명 아크릴 테 + 색 받침)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.08, 48), new THREE.MeshPhysicalMaterial({ color: BASES[i % 4], roughness: 0.25, clearcoat: 1, envMap: env, envMapIntensity: 0.6 }));
  base.position.set(x, 0.04, z); base.castShadow = base.receiveShadow = true; scene.add(base);
  g.position.set(x, 0.08, z); scene.add(g);
  label(DOLLS[id].name, new THREE.Vector3(x, -0.02, z + 0.5));
}

const KINDS = ['bunny', 'bear', 'cat', 'penguin', 'dino'];
const ROWS: [Style, string][] = [['a', 'A 만화 반짝이'], ['b', 'B 반짝이 플라스틱'], ['c', 'C 무광 비닐']];
const rows = only ? ROWS.filter(([s]) => s === only) : ROWS;
rows.forEach(([style, name], r) => {
  const z = (r - (rows.length - 1) / 2) * 2.0;
  KINDS.forEach((id, i) => figure(id, style, (i - (KINDS.length - 1) / 2) * 1.25, z, i));
  if (!only) label(name, new THREE.Vector3(-(KINDS.length / 2) * 1.25 - 0.6, 0.5, z), 'row');
});

const box = new THREE.Box3();
scene.updateMatrixWorld(true);
scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== floor) box.expandByObject(o); });
const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
const dist = Math.max(size.y / (2 * t), (size.x + 1.6) / (2 * t * camera.aspect)) * 1.12 + size.z / 2;
camera.position.set(c.x - 0.4, c.y + dist * (only ? 0.18 : 0.62), c.z + dist); camera.lookAt(c.x - 0.4, c.y, c.z);

const v = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  for (const l of labels) {
    v.copy(l.at).project(camera);
    l.el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`; l.el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
  }
});
