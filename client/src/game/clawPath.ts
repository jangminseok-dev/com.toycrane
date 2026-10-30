import type { Vec2 } from './movement';

const SETTLE = 0.6; // 내려가는 시간의 앞 60% 동안 옮겨 간다
const WOBBLE = 0.025;

// 집게가 내려가며 흔들려 옮겨 가는 길: 노린 자리(from)에서 서버가 정한 실제 자리(to)로, 옆으로 줄어드는 흔들림을 섞어서
export function clawPath(from: Vec2, to: Vec2, k: number): Vec2 {
  const t = Math.min(1, k / SETTLE), e = t * t * (3 - 2 * t);
  const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz);
  const [px, pz] = len > 1e-4 ? [-dz / len, dx / len] : [1, 0]; // 옆 방향 (제자리면 좌우로)
  const wob = Math.sin(t * Math.PI * 3) * (1 - t) * WOBBLE;
  return { x: from.x + dx * e + px * wob, z: from.z + dz * e + pz * wob };
}
