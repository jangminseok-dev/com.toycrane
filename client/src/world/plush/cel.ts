import * as THREE from 'three';

// 새 인형의 셀 음영 (인형 리뉴얼 설계 §3). kit.ts와 faceAtlas.ts가 함께 쓰므로 따로 둔다(서로 import하면 순환)
// 어두운 단 165 · 밝은 단 255, 그 사이만 선형으로 살짝 번진다
export const CEL = new THREE.DataTexture(new Uint8Array([...Array(8).fill(165), ...Array(8).fill(255)]), 16, 1, THREE.RedFormat);
CEL.minFilter = CEL.magFilter = THREE.LinearFilter;
CEL.needsUpdate = true;

// 가장자리를 살짝 밝혀 몸통이 둥글게 떠 보이게
const RIM = `
  float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
  outgoingLight += diffuseColor.rgb * 0.22 * smoothstep(0.35, 0.5, rimF);
  #include <opaque_fragment>`;
// vc = 꼭짓점 색(주름 그늘)을 쓰는가 — 꼭짓점 색이 없는 도형(왕관 같은 기본 도형)에 켜면 검게 나온다
export function cel(params: THREE.MeshToonMaterialParameters, vc = true): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ ...params, gradientMap: CEL, vertexColors: vc }); // 꼭짓점 색 = 미리 구운 주름 그늘(무더기에서는 그늘 × 색)
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', RIM); };
  m.customProgramCacheKey = () => 'plush-cel';
  m.userData.plush = true;
  return m;
}
