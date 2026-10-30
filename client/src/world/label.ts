import * as THREE from 'three';

// 머리 위 이름표 (항상 카메라를 본다)
export function makeLabel(text: string): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.beginPath(); g.roundRect(10, 22, 492, 84, 42); g.fill();
  g.fillStyle = '#3b2a5a';
  g.font = 'bold 48px -apple-system, "Apple SD Gothic Neo", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false }));
  sp.scale.set(1.0, 0.25, 1);
  return sp;
}
