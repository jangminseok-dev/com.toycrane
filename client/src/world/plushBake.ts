import * as THREE from 'three';
import { mergeBuckets } from './bake';
import { PLUSH_VC, plushVCWithMap } from './plush/kit';

// 새 인형(plush)을 재질별로 한 덩어리씩 굽는다: 빛나지 않는 칠은 색을 꼭짓점 색(주름 그늘)에 곱해 PLUSH_VC 하나로 모아,
// 색이 여러 가지여도 그리기 호출이 늘지 않게 한다 (인형 리뉴얼 설계 §7). 기계 속 무더기와 광장 진열탑이 같이 쓴다
const tintable = (m: THREE.Material): m is THREE.MeshToonMaterial => m instanceof THREE.MeshToonMaterial && m.userData.plush === true && m.emissive.getHex() === 0;

// 합칠 수 있게 속성을 position·normal·uv·color 넷으로 맞춘다(외곽선·왕관처럼 uv·색이 없는 도형도)
export function uniform(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.getAttribute('position').count;
  for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(key)) g.deleteAttribute(key);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.getAttribute('color')) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return g;
}

// 조각마다 속성을 맞춘 뒤(uniform) 한 번에 합친다 — 재질별로 먼저 합치면 uv 없는 왕관과 uv 있는 몸이 한 재질(외곽선)에서 만나 합치기가 실패했다
export function bakePlush(root: THREE.Object3D, remap: (m: THREE.Material) => THREE.Material = (m) => m): Array<THREE.Mesh | THREE.LineSegments> {
  const buckets = new Map<THREE.Material, { line: boolean; geos: THREE.BufferGeometry[] }>();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    let mat = m.material as THREE.Material;
    const geo = uniform(m.geometry.clone().applyMatrix4(m.matrixWorld));
    if (tintable(mat)) {
      const c = mat.color, col = geo.getAttribute('color') as THREE.BufferAttribute;
      for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * c.r, col.getY(i) * c.g, col.getZ(i) * c.b);
      mat = mat.map ? plushVCWithMap(mat.map) : PLUSH_VC;
    }
    if (!buckets.has(mat)) buckets.set(mat, { line: false, geos: [] });
    buckets.get(mat)!.geos.push(geo);
  });
  return mergeBuckets(buckets, remap);
}
