import type { Vec2 } from '../game/movement';

const DEAD_ZONE = 0.15;

// 화면 좌표(아래로 +)를 매장 방향(화면 아래 = +z)으로: 반경 15% 안은 0, 그 밖은 방향만(길이 1).
// 속도는 늘 3.2m/s — 서버와 다른 사람 화면도 같은 속도로 보므로 세기를 두면 튕겨 보인다
export function joystickVector(start: Vec2, current: Vec2, radius: number): Vec2 {
  const dx = current.x - start.x, dz = current.z - start.z;
  const dist = Math.hypot(dx, dz);
  if (dist / radius < DEAD_ZONE) return { x: 0, z: 0 };
  return { x: dx / dist, z: dz / dist };
}

const RADIUS = 56;

// 터치 기기: 매장 화면(캔버스)의 왼쪽 아래를 누르면 그 자리에 조이스틱 원이 생긴다.
// 캔버스에만 거는 이유: 입장 카드 같은 화면 위 버튼의 탭을 가로채지 않게(최종 리뷰 #2)
export function installJoystick(touchTarget: HTMLElement, layer: HTMLElement = document.body): { read(): Vec2 } {
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
  layer.appendChild(base);

  let touchId: number | null = null;
  let start: Vec2 = { x: 0, z: 0 };
  let vec: Vec2 = { x: 0, z: 0 };
  const point = (t: Touch): Vec2 => ({ x: t.clientX, z: t.clientY });

  touchTarget.addEventListener('touchstart', (e) => {
    for (const t of Array.from(e.changedTouches)) {
      if (touchId !== null || t.clientX > innerWidth / 2 || t.clientY < innerHeight / 2) continue;
      touchId = t.identifier; start = point(t); vec = { x: 0, z: 0 };
      Object.assign(base.style, { display: 'block', left: `${start.x}px`, top: `${start.z}px` });
      e.preventDefault();
    }
  }, { passive: false });
  touchTarget.addEventListener('touchmove', (e) => {
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
  touchTarget.addEventListener('touchend', end);
  touchTarget.addEventListener('touchcancel', end);
  return { read: () => vec };
}
