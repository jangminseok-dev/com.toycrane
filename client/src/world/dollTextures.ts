import * as THREE from 'three';
import { canvasTex, toonWith } from './toon';

// 인형 무늬·희귀 재질. 처음 쓸 때 한 번만 만든다 (시제품 docs/reference/prototypes/spike-arcade-big-v3.html 227~285행).
// 희귀 = 특수효과 8가지(별빛·진주·무지개·은하·벚꽃·크리스탈·오로라·솜사탕), 매우 희귀 = 진짜 금 (설계 2026-10-31 인형 채우기 §4.2)
const once = <T>(make: () => T) => { let v: T | undefined; return () => (v ??= make()); };
const keyed = <T>(make: (key: string) => T) => { const m = new Map<string, T>(); return (key: string) => { if (!m.has(key)) m.set(key, make(key)); return m.get(key)!; }; };
const dots = (g: CanvasRenderingContext2D, n: number, color: string, r0: number, r1: number) => {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) { g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, r0 + Math.random() * (r1 - r0), 0, Math.PI * 2); g.fill(); }
};

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
// 은하: 짙은 남색에 작은 별이 흐르는 밤하늘
const galaxyTex = once(() => canvasTex(256, 256, (g) => {
  const grd = g.createLinearGradient(0, 0, 256, 256);
  ['#1b1f5c', '#3a2a7a', '#1d3a7a', '#2a1a5a'].forEach((c, i, a) => grd.addColorStop(i / (a.length - 1), c));
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  dots(g, 90, '#ffffff', 0.8, 2); dots(g, 14, '#ffe9a8', 2, 3.5); dots(g, 10, 'rgba(160,140,255,.5)', 10, 22);
}));
// 벚꽃: 연분홍 몸에 꽃잎
const sakuraTex = once(() => canvasTex(256, 256, (g) => {
  g.fillStyle = '#ffe1ec'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 7 + Math.random() * 6;
    g.fillStyle = i % 3 ? '#ffb3cc' : '#ff9cbd';
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.55, r * 0.35, a, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#fff3a8'; g.beginPath(); g.arc(x, y, r * 0.22, 0, Math.PI * 2); g.fill();
  }
}));
// 크리스탈: 맑은 하늘색 면이 각지게 반짝인다
const crystalTex = once(() => canvasTex(256, 256, (g) => {
  g.fillStyle = '#d8f6ff'; g.fillRect(0, 0, 256, 256);
  const shades = ['#bfeeff', '#eafcff', '#a8e4ff', '#f4feff', '#c9f0ff'];
  for (let i = 0; i < 40; i++) {
    g.fillStyle = shades[i % shades.length];
    const x = Math.random() * 256, y = Math.random() * 256, r = 18 + Math.random() * 26;
    g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.8, y + r * 0.2); g.lineTo(x - r * 0.5, y + r * 0.7); g.closePath(); g.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2;
  for (let i = 0; i < 18; i++) { const x = Math.random() * 256, y = Math.random() * 256; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.moveTo(x, y - 6); g.lineTo(x, y + 6); g.stroke(); }
}));
// 오로라: 초록·보라 빛 띠가 일렁인다
const auroraTex = once(() => canvasTex(64, 256, (g) => {
  const grd = g.createLinearGradient(0, 0, 0, 256);
  ['#7af0c0', '#5fd8e8', '#9a7aff', '#d78aff', '#7af0c0'].forEach((c, i, a) => grd.addColorStop(i / (a.length - 1), c));
  g.fillStyle = grd; g.fillRect(0, 0, 64, 256);
}));
// 솜사탕: 분홍·하늘 파스텔이 섞인 몽글몽글
const cottonTex = once(() => canvasTex(256, 256, (g) => {
  g.fillStyle = '#ffd6ec'; g.fillRect(0, 0, 256, 256);
  dots(g, 26, 'rgba(176,222,255,.85)', 16, 34); dots(g, 18, 'rgba(255,236,250,.9)', 10, 24);
}));
// 진짜 금: 둥근 금 구슬을 그린 matcap — 매끈한 금속 광택과 밝은 하이라이트 (실제 반사·빛 번짐 없이)
const goldMatcap = once(() => canvasTex(256, 256, (g) => {
  const grd = g.createRadialGradient(100, 92, 6, 128, 128, 128);
  [[0, '#fffbe8'], [0.18, '#ffe9a0'], [0.42, '#f5c242'], [0.7, '#c98a1c'], [0.9, '#7a4e0c'], [1, '#4a2e06']].forEach(([t, c]) => grd.addColorStop(t as number, c as string));
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(92, 78, 26, 14, -0.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,240,190,.5)'; g.beginPath(); g.ellipse(170, 190, 30, 10, -0.7, 0, Math.PI * 2); g.fill();
}));
// 다람쥐 무늬: 구 UV 기준 x=64가 앞, x=192가 등. 등에 진한 줄·밝은 줄, 얼굴 아래·배는 밝게.
// 무채색 한 장에 몸 색을 곱한다 — 기계 속 무더기에서는 그 색을 꼭짓점 색으로 옮겨 색이 달라도 재질 하나로 합친다
const squirrelTex = once(() => canvasTex(256, 128, (g) => {
  g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(64, 80, 46, 40, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f6f6f6'; for (const dx of [-14, 14]) g.fillRect(192 + dx - 3, 6, 6, 100);
  g.fillStyle = '#5a5a5a'; g.fillRect(188, 0, 8, 112); for (const dx of [-26, 26]) g.fillRect(192 + dx - 3, 12, 6, 90);
  g.fillRect(61, 0, 6, 20);
}));

// 금색 장식(왕관·유니콘 뿔) — 툰 칠
export const goldToon = once(() => toonWith({ color: 0xffd36b, emissive: 0x7a5200, emissiveIntensity: 0.35 }));
// 진짜 금으로 만든 인형(매우 희귀)의 온몸
export const goldMaterial = once(() => new THREE.MeshMatcapMaterial({ matcap: goldMatcap() }));
export const squirrelMat = keyed((base) => toonWith({ color: new THREE.Color(base).getHex(), map: squirrelTex() }));
// 특수효과(희귀) 몸 재질 — 은은하게 빛나는 무늬
const EFFECT_LOOKS: Record<string, { tex: () => THREE.Texture; glow: number; strength: number; spark: number }> = {
  star: { tex: starTex, glow: 0x6b4bd6, strength: 0.22, spark: 0xffe27a },
  pearl: { tex: pearlTex, glow: 0x8a6bd6, strength: 0.18, spark: 0xfff0fa },
  rainbow: { tex: rainbowTex, glow: 0x553366, strength: 0.2, spark: 0xff9fd8 },
  galaxy: { tex: galaxyTex, glow: 0x3a3aa8, strength: 0.25, spark: 0xc8d0ff },
  sakura: { tex: sakuraTex, glow: 0xd66b9a, strength: 0.15, spark: 0xffb7d5 },
  crystal: { tex: crystalTex, glow: 0x6bc8ff, strength: 0.3, spark: 0xcff6ff },
  aurora: { tex: auroraTex, glow: 0x5ad6a8, strength: 0.28, spark: 0x9fffd8 },
  cotton: { tex: cottonTex, glow: 0xd68ac0, strength: 0.15, spark: 0xffc8ef },
};
// 새 인형(plush)이 셀 음영 재질로 다시 만들 때 쓰는 무늬·빛 값
export function effectLook(effect: string): { map: THREE.Texture; glow: number; strength: number } {
  const e = EFFECT_LOOKS[effect] ?? EFFECT_LOOKS.star;
  return { map: e.tex(), glow: e.glow, strength: e.strength };
}
export const effectMaterial = keyed((effect) => {
  const e = EFFECT_LOOKS[effect] ?? EFFECT_LOOKS.star;
  return toonWith({ color: 0xffffff, map: e.tex(), emissive: e.glow, emissiveIntensity: e.strength });
});
// 둘레에서 도는 반짝이 색 (황금은 금빛)
export const sparkMaterial = keyed((rare) => new THREE.MeshBasicMaterial({ color: rare === 'gold' ? 0xffd75a : (EFFECT_LOOKS[rare] ?? EFFECT_LOOKS.star).spark }));

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
