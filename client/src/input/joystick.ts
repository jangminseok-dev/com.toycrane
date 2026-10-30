import type { Vec2 } from '../game/movement';

const DEAD_ZONE = 0.15;

// 화면 좌표(아래로 +)를 매장 방향(화면 아래 = +z)으로: 반경 밖은 길이 1, 반경 15% 안은 0
export function joystickVector(start: Vec2, current: Vec2, radius: number): Vec2 {
  const dx = current.x - start.x, dz = current.z - start.z;
  const len = Math.hypot(dx, dz) / radius;
  if (len < DEAD_ZONE) return { x: 0, z: 0 };
  const k = Math.min(len, 1) / len;
  return { x: (dx / radius) * k, z: (dz / radius) * k };
}

const RADIUS = 56;

// 터치 기기: 화면 왼쪽 아래 절반을 누르면 그 자리에 조이스틱 원이 생긴다
export function installJoystick(container: HTMLElement): { read(): Vec2 } {
  const base = document.createElement('div');
  const knob = document.createElement('div');
  Object.assign(base.style, {
    position: 'fixed', width: `${RADIUS * 2}px`, height: `${RADIUS * 2}px`, marginLeft: `${-RADIUS}px`, marginTop: `${-RADIUS}px`,
    borderRadius: '50%', background: 'rgba(255,255,255,.12)', border: '2px solid rgba(255,255,255,.35)', display: 'none', pointerEvents: 'none', zIndex: '10',
  });
  Object.assign(knob.style, {
    position: 'absolute', left: `${RADIUS - 22}px`, top: `${RADIUS - 22}px`, width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,159,232,.85)',
  });
  base.appendChild(knob);
  container.appendChild(base);

  let touchId: number | null = null;
  let start: Vec2 = { x: 0, z: 0 };
  let vec: Vec2 = { x: 0, z: 0 };
  const point = (t: Touch): Vec2 => ({ x: t.clientX, z: t.clientY });

  container.addEventListener('touchstart', (e) => {
    for (const t of Array.from(e.changedTouches)) {
      if (touchId !== null || t.clientX > innerWidth / 2 || t.clientY < innerHeight / 2) continue;
      touchId = t.identifier; start = point(t); vec = { x: 0, z: 0 };
      Object.assign(base.style, { display: 'block', left: `${start.x}px`, top: `${start.z}px` });
      e.preventDefault();
    }
  }, { passive: false });
  container.addEventListener('touchmove', (e) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== touchId) continue;
      vec = joystickVector(start, point(t), RADIUS);
      knob.style.transform = `translate(${vec.x * RADIUS}px, ${vec.z * RADIUS}px)`;
      e.preventDefault();
    }
  }, { passive: false });
  const end = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== touchId) continue;
      touchId = null; vec = { x: 0, z: 0 };
      base.style.display = 'none'; knob.style.transform = '';
    }
  };
  container.addEventListener('touchend', end);
  container.addEventListener('touchcancel', end);
  return { read: () => vec };
}
