import * as THREE from 'three';
import { canvasTex, toonWith } from './toon';

// 인형 무늬·희귀 재질. 처음 쓸 때 한 번만 만든다 (시제품 docs/reference/prototypes/spike-arcade-big-v3.html 227~285행)
const once = <T>(make: () => T) => { let v: T | undefined; return () => (v ??= make()); };

const starTex = once(() => canvasTex(256, 256, (g) => {
  g.fillStyle = '#b9a4ff'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#fff6b0';
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 4 + Math.random() * 8;
    g.beginPath();
    for (let j = 0; j < 10; j++) {
      const a = (j * Math.PI) / 5 - Math.PI / 2, rr = j % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
  }
}));
const rainbowTex = once(() => canvasTex(64, 256, (g) => {
  ['#ff6b8b', '#ffa94d', '#ffe066', '#8fdc8a', '#4fd8ff', '#a77bff'].forEach((c, i, a) => { g.fillStyle = c; g.fillRect(0, (i * 256) / a.length, 64, 256 / a.length + 1); });
}));
const pearlTex = once(() => canvasTex(256, 256, (g) => {
  const grd = g.createLinearGradient(0, 0, 256, 256);
  ['#fdf6ff', '#ffd9ef', '#d9f2ff', '#efe0ff', '#fff3d9'].forEach((c, i, a) => grd.addColorStop(i / (a.length - 1), c));
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
}));
// 다람쥐 무늬: 구 UV 기준 x=64가 앞, x=192가 등. 등에 진한 줄·밝은 줄, 얼굴 아래·배는 밝게
const squirrelTex = once(() => canvasTex(256, 128, (g) => {
  g.fillStyle = '#c98a52'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#f6e3c8'; g.beginPath(); g.ellipse(64, 80, 46, 40, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2dcbc'; for (const dx of [-14, 14]) g.fillRect(192 + dx - 3, 6, 6, 100);
  g.fillStyle = '#5a3a2a'; g.fillRect(188, 0, 8, 112); for (const dx of [-26, 26]) g.fillRect(192 + dx - 3, 12, 6, 90);
  g.fillRect(61, 0, 6, 20);
}));

export const GOLD = once(() => toonWith({ color: 0xffd36b, emissive: 0x7a5200, emissiveIntensity: 0.35 }));
export const squirrelMat = once(() => toonWith({ color: 0xffffff, map: squirrelTex() }));
// 희귀 인형 몸 재질
export const rareMat: Record<string, () => THREE.Material> = {
  starbunny: once(() => toonWith({ color: 0xffffff, map: starTex(), emissive: 0x6b4bd6, emissiveIntensity: 0.22 })),
  goldfox: GOLD,
  pearlpenguin: once(() => toonWith({ color: 0xffffff, map: pearlTex(), emissive: 0x8a6bd6, emissiveIntensity: 0.18 })),
  rainbowdino: once(() => toonWith({ color: 0xffffff, map: rainbowTex(), emissive: 0x553366, emissiveIntensity: 0.2 })),
};

// 굵기가 변하는 관 (다람쥐 꼬리처럼 한 덩어리로 휘는 모양). extra만큼 굵게 만들면 외곽선용
function taperedTube(points: [number, number, number][], radii: number[], extra = 0, tubular = 24, radial = 12): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((q) => new THREE.Vector3(...q)));
  const geo = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular, f = t * (radii.length - 1), k = Math.min(Math.floor(f), radii.length - 2);
    const r = radii[k] + (radii[k + 1] - radii[k]) * (f - k) + extra;
    curve.getPointAt(t, c);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}
const TAIL_PTS: [number, number, number][] = [[0, 0.22, -0.2], [0.04, 0.32, -0.46], [0.1, 0.62, -0.6], [0.16, 0.95, -0.55], [0.21, 1.15, -0.42], [0.24, 1.2, -0.24]];
const TAIL_R = [0.07, 0.14, 0.18, 0.18, 0.14, 0.05];
export const squirrelTail = once(() => ({
  hi: taperedTube(TAIL_PTS, TAIL_R), hiLine: taperedTube(TAIL_PTS, TAIL_R, 0.022, 24, 12), lo: taperedTube(TAIL_PTS, TAIL_R, 0, 10, 6),
}));
