import * as THREE from 'three';

// 머리 위 이름표 (항상 카메라를 본다) — 카툰풍(사용자 2026-11-02 사진 265·266 '닉네임·조르는 중 잘 보이게'): 남색 테두리·납작 그림자·간판 글꼴,
// 흰 알약(이름) 또는 분홍 알약('조르는 중' 꼬리표). 글자는 알약 폭에 맞춰 줄인다
const INK = '#2c2470', FILL = { white: '#ffffff', pink: '#ff8fc8' } as const;
export function makeLabel(text: string, fill: keyof typeof FILL = 'white'): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = INK; g.beginPath(); g.roundRect(12, 26, 488, 92, 46); g.fill(); // 납작 그림자(아래로 8px)
  g.fillStyle = FILL[fill]; g.beginPath(); g.roundRect(12, 18, 488, 92, 46); g.fill();
  g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
  g.fillStyle = INK;
  g.font = '56px "Jua", "Apple SD Gothic Neo", -apple-system, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = g.measureText(text).width; if (w > 440) g.font = `${Math.floor((56 * 440) / w)}px "Jua", "Apple SD Gothic Neo", -apple-system, sans-serif`;
  g.fillText(text, 256, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false }));
  sp.scale.set(1.15, 0.2875, 1);
  return sp;
}

// 이름표는 사람마다 따로 만든 텍스처·재질이라, 사람이 나가면 직접 해제해야 GPU 메모리가 돌아온다
export function disposeLabel(sprite: THREE.Sprite): void {
  sprite.material.map?.dispose();
  sprite.material.dispose();
}
