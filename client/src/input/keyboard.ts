import type { Vec2 } from '../game/movement';

const pressed = new Set<string>();
let installed = false;

const AXES: Record<string, Vec2> = {
  KeyW: { x: 0, z: -1 }, ArrowUp: { x: 0, z: -1 },
  KeyS: { x: 0, z: 1 }, ArrowDown: { x: 0, z: 1 },
  KeyA: { x: -1, z: 0 }, ArrowLeft: { x: -1, z: 0 },
  KeyD: { x: 1, z: 0 }, ArrowRight: { x: 1, z: 0 },
};

// WASD·방향키 → 방향(화면 위쪽 = -z), 대각선은 길이 1로
export function readKeyboard(): Vec2 {
  if (!installed) {
    installed = true;
    addEventListener('keydown', (e) => { if (AXES[e.code]) { pressed.add(e.code); e.preventDefault(); } });
    addEventListener('keyup', (e) => pressed.delete(e.code));
    addEventListener('blur', () => pressed.clear());
  }
  let x = 0, z = 0;
  for (const code of pressed) { x += AXES[code].x; z += AXES[code].z; }
  const len = Math.hypot(x, z);
  return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
}
