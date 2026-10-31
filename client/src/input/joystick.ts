import type { Vec2 } from '../game/movement';
import { backdropBlur } from '../ui/glass';

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
// 쉬는 자리: 왼쪽 아래(아이폰 홈 막대·가장자리 안전 영역 안쪽)
const REST_LEFT = `calc(env(safe-area-inset-left) + ${RADIUS + 28}px)`;
const REST_TOP = `calc(100% - env(safe-area-inset-bottom) - ${RADIUS + 36}px)`;
const SPRING = 'cubic-bezier(.3,1.5,.5,1)';
// 아이폰 리퀴드 글라스 느낌: 뒤를 흐리게 비추는 반투명 유리 + 위쪽 반사광

// 터치 기기: 매장 화면 왼쪽 아래에 조이스틱이 늘 보인다. 왼쪽 아래 어디를 눌러도 그 자리로 와서 끌리고, 놓으면 제자리로 돌아간다.
// 캔버스에만 거는 이유: 입장 카드 같은 화면 위 버튼의 탭을 가로채지 않게(최종 리뷰 #2)
const touchDevice = () => navigator.maxTouchPoints > 0 || 'ontouchstart' in window;

export function installJoystick(touchTarget: HTMLElement, layer: HTMLElement = document.body): { read(): Vec2; setEnabled(on: boolean): void } {
  const base = document.createElement('div');
  const knob = document.createElement('div');
  base.id = 'joystick';
  Object.assign(base.style, {
    position: 'fixed', width: `${RADIUS * 2}px`, height: `${RADIUS * 2}px`, marginLeft: `${-RADIUS}px`, marginTop: `${-RADIUS}px`,
    borderRadius: '50%', pointerEvents: 'none', zIndex: '10',
    display: touchDevice() ? 'block' : 'none',
    background: 'radial-gradient(120% 120% at 50% 0%, rgba(255,255,255,.28), rgba(255,255,255,.06) 60%, rgba(255,255,255,.1))',
    border: '1px solid rgba(255,255,255,.38)',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,.6), inset 0 -10px 20px rgba(255,255,255,.05), 0 12px 32px rgba(0,0,0,.35)',
  });
  backdropBlur(base, 'blur(14px) saturate(180%)');
  Object.assign(knob.style, {
    position: 'absolute', left: `${RADIUS - 22}px`, top: `${RADIUS - 22}px`, width: '44px', height: '44px', borderRadius: '50%',
    background: 'linear-gradient(180deg, rgba(255,255,255,.85), rgba(255,214,243,.45))',
    border: '1px solid rgba(255,255,255,.8)',
    boxShadow: '0 6px 16px rgba(0,0,0,.28), inset 0 1px 2px rgba(255,255,255,.95), inset 0 -6px 10px rgba(255,159,232,.35)',
  });
  base.appendChild(knob);
  layer.appendChild(base);

  const toRest = () => {
    Object.assign(base.style, { left: REST_LEFT, top: REST_TOP, opacity: '.85', transition: `left .32s ${SPRING}, top .32s ${SPRING}, opacity .2s` });
    Object.assign(knob.style, { transform: '', transition: `transform .28s ${SPRING}` });
  };
  toRest();

  let touchId: number | null = null, enabled = true;
  let start: Vec2 = { x: 0, z: 0 };
  let vec: Vec2 = { x: 0, z: 0 };
  const point = (t: Touch): Vec2 => ({ x: t.clientX, z: t.clientY });

  touchTarget.addEventListener('touchstart', (e) => {
    for (const t of Array.from(e.changedTouches)) {
      if (!enabled || touchId !== null || t.clientX > innerWidth / 2 || t.clientY < innerHeight / 2) continue;
      touchId = t.identifier; start = point(t); vec = { x: 0, z: 0 };
      Object.assign(base.style, { left: `${start.x}px`, top: `${start.z}px`, opacity: '1', transition: 'opacity .15s' });
      Object.assign(knob.style, { transform: 'scale(1.06)', transition: 'none' });
      e.preventDefault();
    }
  }, { passive: false });
  touchTarget.addEventListener('touchmove', (e) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== touchId) continue;
      vec = joystickVector(start, point(t), RADIUS);
      knob.style.transform = `translate(${vec.x * RADIUS}px, ${vec.z * RADIUS}px) scale(1.06)`;
      e.preventDefault();
    }
  }, { passive: false });
  const end = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== touchId) continue;
      touchId = null; vec = { x: 0, z: 0 };
      toRest();
    }
  };
  touchTarget.addEventListener('touchend', end);
  touchTarget.addEventListener('touchcancel', end);
  return {
    read: () => vec,
    // 기계 앞(집게는 기계 버튼으로)에서는 걷기 조이스틱을 숨기고 끈다
    setEnabled(on) {
      if (on === enabled) return;
      enabled = on;
      if (!on) { touchId = null; vec = { x: 0, z: 0 }; toRest(); }
      base.style.display = on && touchDevice() ? 'block' : 'none';
    },
  };
}
