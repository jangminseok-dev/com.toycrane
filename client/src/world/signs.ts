import * as THREE from 'three';
import { PREP, STICKER, WALL_SIGN } from './copy';
import { canvasTex } from './toon';

// 간판·안내 카드·스티커·뒷판·번호판·벽 간판·준비 중 그림 (시제품 docs/reference/prototypes/spike-look-a.html의 그림을 따름).
// 글꼴은 ui/fonts.ts가 미리 불러 둔 Jua(간판)·Gaegu(손글씨)이고, 없으면 시스템 글꼴로 그린다
const SIGN_FONT = '"Jua", "Apple SD Gothic Neo", -apple-system, sans-serif';
const HAND_FONT = '"Gaegu", "Apple SD Gothic Neo", -apple-system, sans-serif';
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
    fit(g, text, (s) => `700 ${s}px ${HAND_FONT}`, 92, 250);
    g.fillStyle = css(fg); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 160, 118);
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
export function wallSignTex(): THREE.CanvasTexture {
  return canvasTex(1024, 512, (g) => {
    g.fillStyle = '#fbf8ff'; g.fillRect(0, 0, 1024, 512);
    ['#ff3b5c', '#ff9f1c', '#ffd84d', '#22b36b', '#2f7cf6', '#8b5cf6'].forEach((c, i) => { g.fillStyle = c; g.fillRect(0, 380 + i * 14, 1024, 14); });
    const rnd = seeded(7);
    for (let i = 0; i < 24; i++) star(g, rnd() * 1024, rnd() * 340, 8 + rnd() * 16, ['#ffd84d', '#ff6fb5', '#5ec8ff'][i % 3]);
    g.font = `170px ${SIGN_FONT}`; outlined(g, WALL_SIGN[0], 512, 150, '#ffffff', 26, '#ff4f9a');
    g.font = `96px ${SIGN_FONT}`; g.fillStyle = '#4a3a8c'; g.fillText(WALL_SIGN[1], 512, 290);
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
