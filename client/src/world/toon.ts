import * as THREE from 'three';

// 코드로 만드는 장난감 스타일: 3단 툰 음영 + 뒷면 외곽선
const gradientMap = new THREE.DataTexture(new Uint8Array([120, 195, 255]), 3, 1, THREE.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

const cache = new Map<number, THREE.MeshToonMaterial>();
export function toon(color: number): THREE.MeshToonMaterial {
  let m = cache.get(color);
  if (!m) cache.set(color, (m = new THREE.MeshToonMaterial({ color, gradientMap })));
  return m;
}

// 툰 음영에 재질 옵션(무늬·발광)을 더한 것 — 희귀 인형 재질용
export function toonWith(params: THREE.MeshToonMaterialParameters): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ ...params, gradientMap });
}

export const outlineMat = new THREE.MeshBasicMaterial({ color: 0x3b2a5a, side: THREE.BackSide });
export const SPH = new THREE.SphereGeometry(1, 32, 20);
// 같은 치수의 캡슐은 하나만 만들어 함께 쓴다 (아바타마다 새로 만들면 GPU 메모리가 샌다)
const capsules = new Map<string, THREE.CapsuleGeometry>();
export function cap(r: number, l: number): THREE.CapsuleGeometry {
  const key = `${r}:${l}`;
  let g = capsules.get(key);
  if (!g) capsules.set(key, (g = new THREE.CapsuleGeometry(r, l, 8, 16)));
  return g;
}

type V3 = [number, number, number];
export function part(geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3 = [0, 0, 0], scl: V3 = [1, 1, 1], rot: V3 = [0, 0, 0], outline = 1.06): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos); m.scale.set(...scl); m.rotation.set(...rot);
  m.castShadow = true;
  if (outline) { const o = new THREE.Mesh(geo, outlineMat); o.scale.setScalar(outline); m.add(o); }
  return m;
}

export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
