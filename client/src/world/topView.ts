import * as THREE from 'three';
import type { Vec2 } from '../game/movement';
import { MACHINE_SPEC } from '../data/storeLayout';
import { DOLL_FLOOR, HOLE, PLAY_BOX } from './machine';

// 위에서 본 화면 (설계 2026-10-31 §3.9): 한 판 하는 동안 그 기계 유리 칸 뒷판에 작은 모니터를 달고,
// 기계 안을 위에서 내려다본 실시간 화면을 띄운다 — 어떤 인형 위에 집게가 있는지 앞·뒤가 헷갈리지 않게.
// 가볍게: 그 층(TOP_LAYER)에 올린 것(기계 속 인형 무더기 + 이 화면 전용 겨냥 십자·상품 구멍 표시)만 펠트 색 바탕에 그린다
export const TOP_LAYER = 3;
const HALF_X = PLAY_BOX.x, HALF_Z = PLAY_BOX.z; // 펠트 반폭
const RT_W = 256, RT_H = 224;
const CAM_Y = 2.6, SEE_DOWN_TO = DOLL_FLOOR - 0.07; // 펠트 조금 아래까지만 — 구멍에 빠져 받는 상자에 있는 인형은 안 보이게

// 기계 안을 바로 위에서 보는 직교 카메라 — 화면 위쪽이 기계 안쪽(-z), 오른쪽이 +x (기계 앞에서 보는 것과 같은 방향)
export function topViewCamera(anchor: THREE.Object3D): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(-HALF_X, HALF_X, HALF_Z, -HALF_Z, 0.05, CAM_Y - SEE_DOWN_TO);
  anchor.updateMatrixWorld(true);
  cam.position.copy(anchor.localToWorld(new THREE.Vector3(0, CAM_Y, 0)));
  cam.up.set(0, 0, -1).applyQuaternion(anchor.getWorldQuaternion(new THREE.Quaternion()));
  cam.lookAt(anchor.localToWorld(new THREE.Vector3(0, 0, 0)));
  cam.updateMatrixWorld(true);
  cam.layers.set(TOP_LAYER);
  return cam;
}

const onTopOnly = (o: THREE.Object3D) => { o.traverse((c) => c.layers.set(TOP_LAYER)); return o; };

export type TopView = { update(claw: Vec2): void; dispose(): void };

export function buildTopView(renderer: THREE.WebGLRenderer, scene: THREE.Scene, anchor: THREE.Object3D, felt: number): TopView {
  // three.js는 카메라 층으로 빛도 거른다 — 매장 빛을 이 층에도 켜야 인형이 검은 그림자로 나오지 않는다
  scene.traverse((o) => { if ((o as THREE.Light).isLight) o.layers.enable(TOP_LAYER); });
  const rt = new THREE.WebGLRenderTarget(RT_W, RT_H);
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const cam = topViewCamera(anchor);
  const feltColor = new THREE.Color(felt);
  // 이 화면에만 보이는 것: 집게 자리 겨냥 십자, 상품 구멍
  const pink = new THREE.MeshBasicMaterial({ color: 0xff2f7f });
  const reticle = new THREE.Group();
  reticle.add(new THREE.Mesh(new THREE.RingGeometry(0.05, 0.068, 32).rotateX(-Math.PI / 2), pink));
  for (const r of [0, Math.PI / 2]) reticle.add(new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.012).rotateX(-Math.PI / 2).rotateY(r), pink));
  const [hx, hz] = MACHINE_SPEC.hole;
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(HOLE.size - 0.04, HOLE.size - 0.04).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2a2233 })); // 턱 안쪽 구멍
  hole.position.set(hx, 0.9, hz);
  for (const o of [reticle, hole]) anchor.add(onTopOnly(o));
  // 뒷판 위쪽의 모니터: 검은 테두리 + 화면 (인형 머리보다 위)
  const screen = new THREE.Group(); screen.name = 'top-view';
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.6, 0.02), new THREE.MeshBasicMaterial({ color: 0x241d33 }));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.54), new THREE.MeshBasicMaterial({ map: rt.texture }));
  glass.position.z = 0.011;
  screen.add(bezel, glass);
  screen.position.set(0, 1.56, -0.455);
  anchor.add(screen);
  let frame = 0;
  const prevClear = new THREE.Color();
  return {
    update(claw) {
      reticle.position.set(claw.x, 1.5, claw.z);
      if (frame++ % 2) return; // 화면은 초당 30번이면 충분
      const prevTarget = renderer.getRenderTarget(), prevBg = scene.background, auto = renderer.shadowMap.autoUpdate;
      renderer.getClearColor(prevClear);
      scene.background = feltColor; renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      renderer.setRenderTarget(prevTarget);
      scene.background = prevBg; renderer.shadowMap.autoUpdate = auto;
      renderer.setClearColor(prevClear);
    },
    dispose() {
      for (const o of [reticle, hole, screen]) {
        anchor.remove(o);
        o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && m.geometry !== undefined) m.geometry.dispose(); });
      }
      rt.dispose();
    },
  };
}
