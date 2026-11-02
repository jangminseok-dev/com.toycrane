import * as THREE from 'three';
import { AD_SLOTS, AD_TOWER, type AdSlot } from './ads';
import { PREP, RARE_TAG, STICKER, WALL_SIGN } from './copy';
import { canvasTex } from './toon';

// 간판·안내 카드·스티커·뒷판·번호판·벽 간판·준비 중 그림 (시제품 docs/reference/prototypes/spike-look-a.html의 그림을 따름).
// 글꼴은 ui/fonts.ts가 미리 불러 둔 Jua(간판)이고, 없으면 시스템 글꼴로 그린다
const SIGN_FONT = '"Jua", "Apple SD Gothic Neo", -apple-system, sans-serif';
const css = (c: number) => '#' + new THREE.Color(c).getHexString();

// 같은 그림이 매번 같게(별·무늬 자리) 나오도록 고정된 난수
function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
function rounded(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  g.closePath(); g.fillStyle = fill; g.fill();
}
// 글자가 폭을 넘으면 크기를 줄인다 — 고른 크기를 돌려준다
function fit(g: CanvasRenderingContext2D, text: string, font: (size: number) => string, size: number, maxW: number): number {
  g.font = font(size);
  while (g.measureText(text).width > maxW && size > 8) { size -= 4; g.font = font(size); }
  return size;
}
function outlined(g: CanvasRenderingContext2D, text: string, x: number, y: number, stroke: string, width: number, fill: string) {
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = width; g.strokeStyle = stroke; g.strokeText(text, x, y);
  g.fillStyle = fill; g.fillText(text, x, y);
}

// 기계 위 간판: 위는 밝고 아래는 기계 색인 그라데이션 + 흰 별 + 흰 둥근 테두리 + 둥근 글씨
export function signTex(text: string, color: number): THREE.CanvasTexture {
  // 기계마다 하나라 35장 — 1024×320로 그린 그림을 반 크기 캔버스에 담는다 (휴대폰 메모리)
  return canvasTex(512, 160, (g) => {
    g.scale(0.5, 0.5);
    const c = new THREE.Color(color), light = c.clone().lerp(new THREE.Color(0xffffff), 0.35);
    const grd = g.createLinearGradient(0, 0, 0, 320); grd.addColorStop(0, css(light.getHex())); grd.addColorStop(1, css(color));
    g.fillStyle = grd; g.fillRect(0, 0, 1024, 320);
    const rnd = seeded(text.length * 131 + color);
    for (let i = 0; i < 30; i++) star(g, rnd() * 1024, rnd() * 320, 6 + rnd() * 14, 'rgba(255,255,255,.35)');
    g.lineWidth = 10; g.strokeStyle = 'rgba(255,255,255,.95)'; rounded(g, 20, 20, 984, 280, 44); g.stroke();
    const size = fit(g, text, (s) => `${s}px ${SIGN_FONT}`, 160, 884);
    outlined(g, text, 512, 170, 'rgba(80,20,60,.5)', size * 0.15, '#ffffff');
  });
}

// 유리 안쪽 손글씨 안내 카드: 둥근 카드(밖은 투명) + 점선 테두리 + 별 두 개
export function popTex(text: string, bg: number, fg: number): THREE.CanvasTexture {
  return canvasTex(320, 220, (g) => {
    g.fillStyle = css(bg); rounded(g, 8, 8, 304, 204, 26); g.fill();
    g.setLineDash([14, 9]); g.lineWidth = 5; g.strokeStyle = css(fg); rounded(g, 24, 24, 272, 172, 16); g.stroke(); g.setLineDash([]);
    fit(g, text, (s) => `${s}px ${SIGN_FONT}`, 64, 240); // 간판 글꼴로 가운데 단정하게
    g.fillStyle = css(fg); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 160, 114);
    star(g, 48, 50, 15, css(fg)); star(g, 274, 174, 11, css(fg));
  });
}

// 코인 투입구 위 스티커 "1회 🪙1"
export function stickerTex(): THREE.CanvasTexture {
  return canvasTex(256, 128, (g) => {
    g.fillStyle = '#ffffff'; rounded(g, 6, 6, 244, 116, 18); g.fill();
    g.lineWidth = 6; g.strokeStyle = '#ff3b5c'; rounded(g, 10, 10, 236, 108, 14); g.stroke();
    g.font = `60px ${SIGN_FONT}`; g.fillStyle = '#ff3b5c'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(STICKER, 128, 68);
  });
}

// 유리 칸 뒷판: 파스텔 하늘 + 하트·별·점 무늬 + 구름
export function backArtTex(c1: number, c2: number): THREE.CanvasTexture {
  return canvasTex(512, 512, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 512); grd.addColorStop(0, css(c1)); grd.addColorStop(1, css(c2));
    g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '34px sans-serif';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) g.fillText(['♥', '★', '●'][(x + y) % 3], x * 64 + (y % 2) * 32 + 8, y * 64 + 44);
    g.fillStyle = 'rgba(255,255,255,.9)';
    for (const [cx, cy, s] of [[120, 120, 1], [380, 200, 0.8]]) {
      g.beginPath(); g.arc(cx, cy, 40 * s, 0, 7); g.arc(cx + 45 * s, cy - 15 * s, 50 * s, 0, 7); g.arc(cx + 95 * s, cy, 38 * s, 0, 7); g.fill();
    }
  });
}

// 간판 위 번호판(A-1 …): 남색 둥근 판에 흰 글씨
export function plateTex(id: string): THREE.CanvasTexture {
  return canvasTex(256, 110, (g) => {
    g.fillStyle = '#26214a'; rounded(g, 4, 4, 248, 102, 20); g.fill();
    g.font = `78px ${SIGN_FONT}`; g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(id, 128, 59);
  });
}

// 벽 간판 "toycrane 게임센터": 흰 바탕 + 무지개 띠 + 별
// 광고 자리 4칸을 한 그림에 (가로 2칸 × 세로 2칸, 칸마다 512×256): 위에 작게 'toycrane', 가운데 크게 광고 문구(또는 그림).
// i번째 자리(0부터, 광고 id − 1)의 UV 칸은 adSignCell(i) — 광장 광고판 4개 (큰 홀 2026-11-01 §3, 광고는 광장에만)
export const AD_COLS = 2, AD_ROWS = 2;
export function adSignCell(i: number): { u: number; v: number; w: number; h: number } {
  return { u: (i % AD_COLS) / AD_COLS, v: 1 - (Math.floor(i / AD_COLS) + 1) / AD_ROWS, w: 1 / AD_COLS, h: 1 / AD_ROWS };
}
export function adSignsTex(): THREE.CanvasTexture {
  const colors = ['#ff4f9a', '#2f7cf6', '#22b36b', '#ff9f1c', '#8b5cf6'];
  const tex = canvasTex(512 * AD_COLS, 256 * AD_ROWS, (g) => {
    AD_SLOTS.forEach(({ text, sub }, i) => {
      const x = (i % AD_COLS) * 512, y = Math.floor(i / AD_COLS) * 256, color = colors[i % colors.length];
      g.fillStyle = '#fbf8ff'; g.fillRect(x, y, 512, 256);
      g.lineWidth = 10; g.strokeStyle = color; rounded(g, x + 10, y + 10, 492, 236, 26); g.stroke();
      g.font = `44px ${SIGN_FONT}`; g.fillStyle = '#ff4f9a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(WALL_SIGN[0], x + 256, y + 62);
      const size = fit(g, text, (sz) => `${sz}px ${SIGN_FONT}`, sub ? 80 : 92, 440);
      outlined(g, text, x + 256, y + (sub ? 140 : 158), '#ffffff', size * 0.14, color);
      if (sub) { fit(g, sub, (sz) => `${sz}px ${SIGN_FONT}`, 40, 420); g.fillStyle = color; g.fillText(sub, x + 256, y + 208); } // 작은 줄(누르면 열리는 곳)
    });
  });
  loadAdImages(tex, AD_SLOTS, (i) => [(i % AD_COLS) * 512, Math.floor(i / AD_COLS) * 256, 512, 256]);
  return tex;
}

// 그림 광고: 불러온 뒤 그 칸(x, y, 폭, 높이)을 그림으로 덮는다 (노드 시험에는 Image가 없다)
function loadAdImages(tex: THREE.CanvasTexture, slots: AdSlot[], cell: (i: number) => [number, number, number, number]) {
  if (typeof Image === 'undefined') return;
  slots.forEach(({ image }, i) => {
    if (!image) return;
    const img = new Image();
    img.onload = () => {
      (tex.image as HTMLCanvasElement).getContext('2d')!.drawImage(img, ...cell(i));
      tex.needsUpdate = true;
    };
    img.src = image;
  });
}

// 진열탑 전광판 띠(사용자 2026-11-01): 광고 다섯 자리(5~9)를 가로로 이어 붙인 한 장 — 칸마다 512×240, 어두운 점 전광판에 빛나는 글.
// 한 번에 한 칸 너비만 보이게 반복(repeat 1/칸 수)으로 두고, 진열탑이 offset을 밀어 오른쪽에서 왼쪽으로 흘린다
export const TICKER_W = 512, TICKER_H = 240;
export function adTickerTex(): THREE.CanvasTexture {
  const neon = ['#ff9fe8', '#7fe3ff', '#ffe28a', '#a8ffb5', '#c9a8ff'], n = AD_TOWER.length, w = TICKER_W * n;
  const tex = canvasTex(w, TICKER_H, (g) => {
    g.fillStyle = '#0d0a14'; g.fillRect(0, 0, w, TICKER_H);
    g.fillStyle = 'rgba(255,255,255,.05)';
    for (let y = 4; y < TICKER_H; y += 8) for (let x = 4; x < w; x += 8) g.fillRect(x, y, 3, 3);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    AD_TOWER.forEach(({ text, sub }, i) => {
      const cx = i * TICKER_W + TICKER_W / 2, color = neon[i % neon.length];
      g.shadowBlur = 24; g.shadowColor = color; g.fillStyle = color;
      fit(g, text, (sz) => `${sz}px ${SIGN_FONT}`, 96, 440); g.fillText(text, cx, 104);
      g.shadowColor = '#4fd8ff'; g.fillStyle = '#ffffff'; g.font = `34px ${SIGN_FONT}`; g.fillText(sub ?? WALL_SIGN[0], cx, 182); // 작은 줄(없으면 toycrane)
    });
    g.shadowBlur = 0;
  }, [1 / n, 1]);
  loadAdImages(tex, AD_TOWER, (i) => [i * TICKER_W, 0, TICKER_W, TICKER_H]);
  return tex;
}

// 희귀가 든 기계 위 이름표: 위 절반 분홍 '★ 희귀', 아래 절반 금색 '★★ 황금' (교환소 개편 설계 §4.7.1)
export function rareTagTex(): THREE.CanvasTexture {
  return canvasTex(512, 256, (g) => {
    ([[RARE_TAG.rare, '#ff5fa2', '#ffe3f0', 0], [RARE_TAG.gold, '#c98a1c', '#fff3c4', 128]] as const).forEach(([text, edge, fill, y]) => {
      g.fillStyle = fill; rounded(g, 8, y + 10, 496, 108, 54); g.fill();
      g.lineWidth = 8; g.strokeStyle = edge; rounded(g, 8, y + 10, 496, 108, 54); g.stroke();
      g.font = `72px ${SIGN_FONT}`; outlined(g, text, 256, y + 66, '#ffffff', 12, edge);
    });
  });
}

// 네 갈래 별 반짝이 (흰색 — 인스턴스 색으로 분홍·금빛)
export function twinkleTex(): THREE.CanvasTexture {
  return canvasTex(128, 128, (g) => {
    const glow = g.createRadialGradient(64, 64, 0, 64, 64, 60);
    glow.addColorStop(0, 'rgba(255,255,255,.9)'); glow.addColorStop(0.25, 'rgba(255,255,255,.35)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#ffffff'; g.beginPath();
    for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4 - Math.PI / 2, r = k % 2 ? 9 : 58; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
    g.closePath(); g.fill();
  });
}

// 빈 구역 장식의 "준비 중" 안내판: 노란 판 + 줄무늬 테두리
export function prepTex(): THREE.CanvasTexture {
  return canvasTex(512, 256, (g) => {
    g.fillStyle = '#fff3b0'; rounded(g, 6, 6, 500, 244, 28); g.fill();
    g.save(); rounded(g, 6, 6, 500, 244, 28); g.clip();
    g.fillStyle = '#ffcc33'; for (let k = -256; k < 512; k += 48) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 24, 0); g.lineTo(k + 24 + 30, 30); g.lineTo(k + 30, 30); g.fill(); }
    g.restore();
    g.font = `120px ${SIGN_FONT}`; outlined(g, PREP, 256, 150, '#ffffff', 16, '#5a3a1a');
  });
}

// 피규어 버튼 윗면 글씨(9단계): 흰 글씨와 그 아래 흰 화살표(right ▶ 오른쪽, up ▲ 기계 안쪽), 버튼 색의 진한 테두리. 밖은 투명
export function buttonLabelTex(text: string, arrow: 'right' | 'up', ink: string): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    g.font = `62px ${SIGN_FONT}`; // '오른쪽' 세 글자도 윗면 안에 (가장자리 20% 남짓 비움)
    outlined(g, text, 128, 108, ink, 14, '#ffffff');
    g.beginPath();
    if (arrow === 'right') { g.moveTo(108, 150); g.lineTo(108, 196); g.lineTo(150, 173); } else { g.moveTo(104, 194); g.lineTo(152, 194); g.lineTo(128, 152); }
    g.closePath();
    g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = ink; g.stroke();
    g.fillStyle = '#ffffff'; g.fill();
  });
}

// 하강 버튼 윗면 글씨: 흰 '잡기'와 그 아래 흰 화살표(▼), 진한 빨강 테두리. 밖은 투명
export function dropLabelTex(text: string): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    g.font = `76px ${SIGN_FONT}`; // 윗면 안에 넉넉히 (가장자리 20% 이상 비움)
    outlined(g, text, 128, 108, '#8a0f2a', 14, '#ffffff');
    g.beginPath(); g.moveTo(100, 152); g.lineTo(156, 152); g.lineTo(128, 194); g.closePath();
    g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = '#8a0f2a'; g.stroke();
    g.fillStyle = '#ffffff'; g.fill();
  });
}
