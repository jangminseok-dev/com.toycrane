import * as THREE from 'three';
import { PLAIN, makeDoll } from './dolls';

// 작은 그림(설계 2026-11-02 고리 카드·가방 보기): 캐릭터·색·희귀 인형을 한 번 찍어 둔 128×128 캔버스(투명 바탕). 같은 것은 다시 찍지 않는다.
// WebGL이 없으면(노드 시험) null — 부르는 쪽이 글자 카드로 대신 그린다
const SIZE = 128;
const cache = new Map<string, HTMLCanvasElement | null>();
let shot: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } | null | undefined;

function studio() {
  if (shot !== undefined) return shot;
  try {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(SIZE, SIZE, false); renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xeee6f2, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(1, 2, 3); scene.add(sun);
    shot = { renderer, scene, camera: new THREE.PerspectiveCamera(30, 1, 0.01, 10) };
  } catch {
    shot = null;
  }
  return shot;
}

export function thumbnail(kind: string, color: number, rare: string): HTMLCanvasElement | null {
  const key = `${kind}|${color}|${rare}`;
  if (cache.has(key)) return cache.get(key)!;
  const s = studio(), doll = s ? makeDoll(kind, { ...PLAIN, color, rare }) : null;
  let out: HTMLCanvasElement | null = null;
  if (s && doll) {
    s.scene.add(doll);
    const box = new THREE.Box3().setFromObject(doll), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const d = Math.max(size.x, size.y) / (2 * Math.tan((s.camera.fov * Math.PI) / 360)) * 1.15;
    s.camera.position.set(c.x, c.y + size.y * 0.05, c.z + size.z / 2 + d); s.camera.lookAt(c);
    s.renderer.render(s.scene, s.camera);
    s.scene.remove(doll);
    out = document.createElement('canvas'); out.width = out.height = SIZE;
    out.getContext('2d')!.drawImage(s.renderer.domElement, 0, 0);
  }
  cache.set(key, out);
  return out;
}
