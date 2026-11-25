// 가방 인형 크게 보기(설계 2026-11-24 bag-viewer-new): 가방 칸을 누르면 가운데 카드에 인형을 크게 — 좌우로 끌면 360도, 위아래로 조금 기울고,
// 두 손가락·휠로 2배까지 키운다. 손대기 전엔 천천히 저절로 돈다. 카드 안 작은 캔버스에 따로 그리고 닫을 때 렌더러를 버린다(휴대폰 메모리)
import * as THREE from 'three';
import { UI } from '../world/copy';
import { PLAIN, makeDoll } from '../world/dolls';
import { CARTOON_FONT, FILL, INK } from './cartoon';
import { installNoSelect } from './noSelect';
import { thumbnailSoon } from '../world/thumbs';

const PITCH = (20 * Math.PI) / 180, AUTO = 0.6, DRAG = 0.01;

export class ViewerSpin {
  yaw = 0; pitch = 0; zoom = 1;
  private touched = false;
  drag(dx: number, dy: number): void { this.touched = true; this.yaw += dx * DRAG; this.pitch = Math.min(PITCH, Math.max(-PITCH, this.pitch + dy * DRAG)); }
  pinch(scale: number): void { this.touched = true; this.zoom = Math.min(2, Math.max(1, this.zoom * scale)); }
  wheel(dy: number): void { this.pinch(Math.exp(-dy * 0.0015)); }
  tick(dt: number): void { if (!this.touched) this.yaw += AUTO * dt; }
}

export type RendererLike = { render(scene: THREE.Scene, camera: THREE.Camera): void; setSize(w: number, h: number, style?: boolean): void; setPixelRatio(r: number): void; dispose(): void; forceContextLoss(): void };
type Spinner = { obj: THREE.Object3D; speed: number };

// 인형 한 개를 그리는 작은 무대 — 가방 작은 그림과 같은 모습(기본 체형·표정, 칸의 색·희귀), 희귀 장식은 돈다
export class DollStage {
  readonly spin = new ViewerSpin();
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
  private pivot = new THREE.Group();
  private doll: THREE.Group | null;
  private spinners: Spinner[] = [];
  private t = 0;
  private dist = 1;

  constructor(private renderer: RendererLike, look: { doll: string; color: number; rare: string }) {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xeee6f2, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(1, 2, 3); this.scene.add(sun);
    this.doll = makeDoll(look.doll, { ...PLAIN, color: look.color, rare: look.rare });
    if (this.doll) {
      const box = new THREE.Box3().setFromObject(this.doll), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
      this.doll.position.sub(c); // 가운데를 축에 — 돌려도 화면 가운데에 있게
      this.pivot.add(this.doll);
      this.spinners = (this.doll.userData.spin as Spinner[] | undefined) ?? [];
      this.dist = (Math.max(size.x, size.y, size.z) / (2 * Math.tan((this.camera.fov * Math.PI) / 360))) * 1.25;
    }
    this.scene.add(this.pivot);
  }

  hasDoll(): boolean { return !!this.doll; }

  resize(px: number): void { this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2)); this.renderer.setSize(px, px, false); }

  frame(dt: number): void {
    this.t += dt;
    this.spin.tick(dt);
    this.pivot.rotation.set(this.spin.pitch, this.spin.yaw, 0, 'XYZ');
    for (const s of this.spinners) s.obj.rotation.y = this.t * s.speed;
    this.camera.position.set(0, 0, this.dist / this.spin.zoom); this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  // 렌더러(이 캔버스의 GPU 문맥)를 버린다. 인형 형상·재질은 게임 화면과 함께 쓰는 것이 있어 버리지 않고 장면에서만 뺀다
  dispose(): void {
    if (this.doll) this.pivot.remove(this.doll);
    this.doll = null;
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

const date = (sec: number) => { const d = new Date(sec * 1000); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
let open: { shade: HTMLDivElement; stage: DollStage | null; raf: number } | null = null;

export function closeDollViewer(): void {
  if (!open) return;
  cancelAnimationFrame(open.raf);
  open.stage?.dispose();
  open.shade.remove();
  open = null;
}

export function openDollViewer(cell: { doll: string; color: number; rare: string; name: string; count: number; mark: string; firstAt: number }): void {
  closeDollViewer();
  const shade = document.createElement('div');
  Object.assign(shade.style, { position: 'fixed', inset: '0', zIndex: '31', background: 'rgba(20,10,30,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' });
  shade.addEventListener('click', (e) => { if (e.target === shade) closeDollViewer(); }); // 바깥을 누르면 크게 보기만 닫는다(가방은 남음)
  installNoSelect(shade);
  const card = document.createElement('div');
  Object.assign(card.style, {
    width: 'min(92vw, 520px)', padding: '16px 16px 14px', borderRadius: '26px', boxSizing: 'border-box', textAlign: 'center', color: INK,
    font: `400 16px ${CARTOON_FONT}`, background: FILL.white, border: `3px solid ${INK}`, boxShadow: `0 6px 0 ${INK}`,
  });
  const title = document.createElement('div'); title.textContent = cell.mark ? `${cell.mark} ${cell.name}` : cell.name;
  Object.assign(title.style, { font: `400 24px ${CARTOON_FONT}`, marginBottom: '8px', color: cell.mark === '★★' ? '#c98a00' : cell.mark ? '#9a4dff' : INK });
  const box = document.createElement('div');
  Object.assign(box.style, { width: '100%', aspectRatio: '1 / 1', borderRadius: '18px', background: 'linear-gradient(180deg, #fff6fb, #f1e8ff)', touchAction: 'none', cursor: 'grab', overflow: 'hidden' });
  const info = document.createElement('div'); info.textContent = `×${cell.count}  ${UI.firstGot(date(cell.firstAt))}`;
  Object.assign(info.style, { marginTop: '8px', opacity: '.8' });
  const close = document.createElement('button'); close.textContent = UI.cancel;
  Object.assign(close.style, { margin: '10px auto 0', padding: '8px 26px', borderRadius: '999px', cursor: 'pointer', font: `400 16px ${CARTOON_FONT}`, color: INK, background: FILL.pink, border: `3px solid ${INK}`, boxShadow: `0 3px 0 ${INK}` });
  close.addEventListener('click', closeDollViewer);
  card.append(title, box, info, close);
  shade.append(card);
  document.body.append(shade);

  let stage: DollStage | null = null;
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    stage = new DollStage(renderer, cell);
    box.append(renderer.domElement);
    Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' });
  } catch { // WebGL이 없으면 가방 작은 그림을 크게
    const pic = thumbnailSoon(cell.doll, cell.color, cell.rare, () => {});
    if (pic) { const img = document.createElement('img'); img.src = pic.toDataURL(); Object.assign(img.style, { width: '100%', height: '100%' }); box.append(img); }
  }
  open = { shade, stage, raf: 0 };
  if (!stage) return;
  const s = stage;
  s.resize(box.clientWidth || 320);
  // 끌기(한 손가락·마우스)와 벌리기(두 손가락)
  const pts = new Map<number, { x: number; y: number }>();
  let pinchFrom = 0;
  box.addEventListener('pointerdown', (e) => { box.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinchFrom = 0; });
  box.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    if (pts.size === 1) s.spin.drag(e.clientX - p.x, e.clientY - p.y);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchFrom) s.spin.pinch(d / pinchFrom);
      pinchFrom = d;
    }
  });
  const up = (e: PointerEvent) => { pts.delete(e.pointerId); pinchFrom = 0; };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  box.addEventListener('wheel', (e) => { e.preventDefault(); s.spin.wheel(e.deltaY); }, { passive: false });
  let last = performance.now();
  const loop = (now: number) => {
    if (!open || open.stage !== s) return;
    s.frame(Math.min(0.05, (now - last) / 1000)); last = now;
    open.raf = requestAnimationFrame(loop);
  };
  open.raf = requestAnimationFrame(loop);
}
