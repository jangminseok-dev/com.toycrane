import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// 움직이지 않는 것들은 재질별로 한 덩어리로 합쳐 그리기 횟수를 줄인다 (시제품 bake).
// remap: 합친 덩어리에 쓸 재질을 바꿔 끼움(행마다 재질을 따로 둬서 그 행만 흐리게 할 때)
export function bakeByMaterial(root: THREE.Object3D, remap: (m: THREE.Material) => THREE.Material = (m) => m): Array<THREE.Mesh | THREE.LineSegments> {
  const buckets = new Map<THREE.Material, { line: boolean; geos: THREE.BufferGeometry[] }>();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const obj = o as THREE.Mesh | THREE.LineSegments;
    if (!(obj as THREE.Mesh).isMesh && !(obj as THREE.LineSegments).isLineSegments) return;
    const mat = obj.material as THREE.Material;
    if (!buckets.has(mat)) buckets.set(mat, { line: !!(obj as THREE.LineSegments).isLineSegments, geos: [] });
    buckets.get(mat)!.geos.push(obj.geometry.clone().applyMatrix4(obj.matrixWorld));
  });
  return mergeBuckets(buckets, remap);
}

// 재질별로 모은 (이미 월드 좌표로 옮긴) 도형들을 재질마다 한 덩어리로 합친다. 넘긴 도형은 정리한다
export function mergeBuckets(
  buckets: Map<THREE.Material, { line: boolean; geos: THREE.BufferGeometry[] }>, remap: (m: THREE.Material) => THREE.Material = (m) => m,
): Array<THREE.Mesh | THREE.LineSegments> {
  const out: Array<THREE.Mesh | THREE.LineSegments> = [];
  for (const [mat, { line, geos }] of buckets) {
    const list = geos.some((g) => !g.index) ? geos.map((g) => (g.index ? g.toNonIndexed() : g)) : geos;
    const merged = mergeGeometries(list);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    out.push(line ? new THREE.LineSegments(merged, remap(mat)) : new THREE.Mesh(merged, remap(mat)));
  }
  return out;
}

// 행 전용 재질 복제기: 같은 원본은 한 번만 복제하고, 흐리기에 쓸 원래 투명도를 기억해 둔다
export function materialCloner(): { remap: (m: THREE.Material) => THREE.Material; materials: THREE.Material[] } {
  const clones = new Map<THREE.Material, THREE.Material>();
  const remap = (m: THREE.Material) => {
    let c = clones.get(m);
    if (!c) {
      c = m.clone();
      c.userData.baseOpacity = m.opacity;
      c.userData.baseTransparent = m.transparent;
      clones.set(m, c);
    }
    return c;
  };
  return { remap, get materials() { return [...clones.values()]; } };
}

// 복제된 재질들을 함께 흐리게(1이면 원래대로)
export function fadeMaterials(materials: THREE.Material[], opacity: number): void {
  for (const m of materials) {
    const baseOpacity = m.userData.baseOpacity ?? 1, baseTransparent = m.userData.baseTransparent ?? false;
    const transparent = baseTransparent || opacity < 1;
    if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
    m.opacity = baseOpacity * opacity;
    m.depthWrite = !transparent;
  }
}
