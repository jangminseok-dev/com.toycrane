import * as THREE from 'three';
import { expect, test } from 'vitest';
import { disposeLabel } from './label';
import { cap } from './toon';

// 사람이 들고 날 때마다 새 GPU 자원을 만들면 휴대폰에서 WebGL이 죽는다 (최종 리뷰 #6)
test('capsule geometry is shared, not rebuilt per avatar', () => {
  expect(cap(0.045, 0.06)).toBe(cap(0.045, 0.06));
});

test('disposeLabel frees the label texture and material', () => {
  const map = new THREE.Texture();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map }));
  const freed: string[] = [];
  map.addEventListener('dispose', () => freed.push('texture'));
  sprite.material.addEventListener('dispose', () => freed.push('material'));
  disposeLabel(sprite);
  expect(freed.sort()).toEqual(['material', 'texture']);
});
