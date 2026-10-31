import * as THREE from 'three';

const ray = new THREE.Ray();
const hit = new THREE.Vector3();

// 카메라(eye)에서 내 캐릭터(target)까지 시선이 상자에 막히는지 — 나보다 먼 곳의 상자는 세지 않는다
export function blocksView(eye: THREE.Vector3, target: THREE.Vector3, box: THREE.Box3): boolean {
  ray.origin.copy(eye);
  ray.direction.subVectors(target, eye).normalize();
  const p = ray.intersectBox(box, hit);
  return p !== null && eye.distanceTo(p) < eye.distanceTo(target);
}

// 내 캐릭터를 가릴 수 있는 것(탑·기계 행·교환소): 상자와 투명도 조절
export interface Occluder {
  box: THREE.Box3;
  setOpacity(opacity: number): void;
}

const FADED = 0.25;

// 카메라→내 머리(1.2m)·몸통(0.4m) 시선을 가리는 가림막만 흐리게, 나머지는 원래대로 (각각 부드럽게)
export class OcclusionFader {
  private opacity: number[];
  private head = new THREE.Vector3();
  private body = new THREE.Vector3();

  constructor(private occluders: Occluder[]) {
    this.opacity = occluders.map(() => 1);
  }

  update(dt: number, eye: THREE.Vector3, at: { x: number; z: number }): void {
    this.head.set(at.x, 1.2, at.z); this.body.set(at.x, 0.4, at.z);
    this.occluders.forEach((o, i) => this.ease(i, blocksView(eye, this.head, o.box) || blocksView(eye, this.body, o.box) ? FADED : 1, dt));
  }

  // 기계 앞 화면(한 판 중)에서는 모두 원래대로 — 걸어오다 흐려진 내 기계 줄이 반투명하게 남지 않게
  clear(dt: number): void {
    this.occluders.forEach((_, i) => this.ease(i, 1, dt));
  }

  private ease(i: number, goal: number, dt: number): void {
    let v = this.opacity[i] + (goal - this.opacity[i]) * Math.min(1, dt * 8);
    if (Math.abs(goal - v) < 0.01) v = goal;
    this.occluders[i].setOpacity(v);
    this.opacity[i] = v;
  }
}
