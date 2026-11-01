import * as THREE from 'three';
import { PLAIN, makeDoll } from './dolls';

// 작은 그림(설계 2026-11-02 고리 카드·가방 보기): 캐릭터·색·희귀 인형을 한 번 찍어 둔 128×128 캔버스(투명 바탕). 같은 것은 다시 찍지 않는다.
// WebGL이 없으면(노드 시험) null — 부르는 쪽이 글자 카드로 대신 그린다.
// 찍기는 프레임마다 몇 ms 안에서 몇 장씩(pumpThumbnails) — 입장 때 100장 가까이를 한 번에 찍어 PC가 6초 멈췄다(최종 리뷰 I2). 그 전엔 대신 그림
const SIZE = 128;
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

// 늦게 만드는 것들: get은 만들어 둔 것을 바로 주거나(없으면 undefined) 줄을 세우고, pump가 시간 안에서 만들어 기다리던 쪽에 알린다
export class Later<T> {
  private made = new Map<string, T>();
  private queue = new Map<string, (() => void)[]>();
  constructor(private make: (key: string) => T, private clock: () => number = () => performance.now()) {}

  get(key: string, onReady: () => void): T | undefined {
    if (this.made.has(key)) return this.made.get(key);
    const waiting = this.queue.get(key) ?? [];
    waiting.push(onReady); this.queue.set(key, waiting);
    return undefined;
  }

  pump(budgetMs: number): void {
    const start = this.clock();
    for (const [key, waiting] of this.queue) {
      this.made.set(key, this.make(key)); this.queue.delete(key);
      for (const w of waiting) w();
      if (this.clock() - start >= budgetMs) return;
    }
  }
}

const pictures = new Later((key) => { const [kind, color, rare] = key.split('|'); return shoot(kind, Number(color), rare); });
// 찍어 둔 그림(WebGL이 없으면 null), 아직이면 undefined — 찍히면 onReady
export const thumbnailSoon = (kind: string, color: number, rare: string, onReady: () => void): HTMLCanvasElement | null | undefined => pictures.get(`${kind}|${color}|${rare}`, onReady);
export const pumpThumbnails = (budgetMs: number): void => pictures.pump(budgetMs);

// 128px엔 면을 낮춘 인형(lite)으로 충분
function shoot(kind: string, color: number, rare: string): HTMLCanvasElement | null {
  const s = studio(), doll = s ? makeDoll(kind, { ...PLAIN, color, rare }, true) : null;
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
  return out;
}
