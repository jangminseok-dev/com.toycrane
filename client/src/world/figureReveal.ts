import * as THREE from 'three';
import { GOLD } from '../data/catalog';
import type { BoxKind } from '../data/figures';
import { FIGURE_REVEAL } from './copy';
import { blindBoxGeo, blindBoxMat } from './figureMachine';
import { makeFigure } from './figureModel';
import { canvasTex } from './toon';

// 상자 까기(9단계 설계 §3.5): 보는 사람 앞에 랜덤 상자가 톡 나타나 열리고, 피규어가 받침대째 올라와 제자리에서 좌우로 살짝 흔들린다.
// 일반은 효과 없이 평범하게. 희귀는 둘레 제자리 반짝임(파스텔 별) + '희귀!' 이름표, 황금은 금빛 반짝임 + '황금!' — 도는 작은 점은 쓰지 않는다.
// 열기 전 SHAKE초 동안 상자가 점점 세게 들썩이며 뜸을 들이고(사용자 2026-11-02 '결과가 너무 빨리 나와'), 열리는 순간 onOpen(터지는 효과·소리)
const POP = 0.4, SHAKE = 1.2, OPEN = 0.5, RISE = 0.6, HOLD = 1.9, FADE = 0.3, TOTAL = POP + SHAKE + OPEN + RISE + HOLD + FADE;
const OPEN_AT = POP + SHAKE; // 열리기 시작하는 때
const FIGURE_SCALE = 0.2, BOX_SCALE = 1.0; // 큰 상자(설계 §8)는 그대로 — 예전 작은 상자(22cm)는 1.5배로 보였다
const FONT = '"Jua", "Apple SD Gothic Neo", -apple-system, sans-serif';
const smooth = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

function label(text: string, gold: boolean): THREE.Sprite {
  const tex = canvasTex(256, 96, (g) => {
    g.fillStyle = gold ? '#ffd36b' : '#ffffff'; g.beginPath(); g.roundRect(6, 6, 244, 84, 42); g.fill();
    g.lineWidth = 6; g.strokeStyle = gold ? '#b8860b' : '#ff6fb5'; g.stroke();
    g.font = `56px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = gold ? '#7a4a00' : '#ff4f9a'; g.fillText(text, 128, 52);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set(0.24, 0.09, 1); s.renderOrder = 10;
  return s;
}

const starTex = (color: string) => canvasTex(64, 64, (g) => {
  g.fillStyle = color; g.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 11 : 30; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
  g.closePath(); g.fill();
});

export function playReveal(scene: THREE.Scene, at: THREE.Vector3, toward: THREE.Vector3, kind: string, rare: string, done: () => void, box: BoxKind = 'long', onOpen?: () => void): { update(dt: number): boolean } {
  const root = new THREE.Group(); root.position.copy(at);
  root.lookAt(toward.x, at.y, toward.z); // 앞(+z)이 보는 사람 쪽
  scene.add(root);
  const boxMesh = new THREE.Mesh(blindBoxGeo(box), blindBoxMat(box));
  boxMesh.name = 'reveal-box'; boxMesh.rotation.x = Math.PI / 2; boxMesh.position.y = 0.2; boxMesh.scale.setScalar(0); // 세워서 그림 면이 앞
  root.add(boxMesh);
  const fig = makeFigure(kind, rare);
  fig.scale.setScalar(FIGURE_SCALE); fig.visible = false;
  root.add(fig);
  let effect: THREE.Group | null = null;
  const stars: { s: THREE.Sprite; phase: number }[] = [];
  if (rare) {
    const gold = rare === GOLD.id;
    effect = new THREE.Group(); effect.name = 'figure-effect'; effect.visible = false;
    const colors = gold ? ['#ffd36b', '#fff1a8'] : ['#ff9fe8', '#7fe3ff', '#ffe28a', '#a8ffb5', '#c9a8ff'];
    [[-0.17, 0.12], [0.18, 0.2], [-0.14, 0.32], [0.16, 0.06], [0.02, 0.38], [-0.2, 0.22]].forEach(([x, y], k) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex(colors[k % colors.length]), transparent: true, depthWrite: false }));
      s.position.set(x, y, 0.05); effect!.add(s); stars.push({ s, phase: k * 1.7 });
    });
    const l = label(gold ? FIGURE_REVEAL.gold : FIGURE_REVEAL.rare, gold);
    l.position.set(0, 0.4, 0.05); effect.add(l);
    root.add(effect);
  }
  let t = 0, ended = false, opened = false;
  return {
    update(dt) {
      if (ended) return false;
      t += dt;
      boxMesh.scale.setScalar(BOX_SCALE * smooth(t / POP) * (1 - smooth((t - OPEN_AT - OPEN) / RISE)));
      if (t > POP && t < OPEN_AT) { // 뜸 들이기: 점점 세게 좌우로 들썩이며 살짝 뛴다
        const k = (t - POP) / SHAKE;
        boxMesh.rotation.z = (0.05 + 0.1 * k) * Math.sin(t * 26);
        boxMesh.position.y = 0.2 + 0.015 * k * Math.abs(Math.sin(t * 13));
      } else if (t >= OPEN_AT) {
        if (!opened) { opened = true; boxMesh.position.y = 0.2; onOpen?.(); }
        boxMesh.rotation.z = smooth((t - OPEN_AT) / OPEN) * 0.25 * Math.sin(t * 20) * (1 - smooth((t - OPEN_AT) / OPEN)); // 열리며 살짝 들썩
      }
      if (t > OPEN_AT + OPEN * 0.5) {
        fig.visible = true;
        const r = smooth((t - OPEN_AT - OPEN * 0.5) / RISE);
        fig.position.y = 0.02 + r * 0.06;
        fig.rotation.y = 0.45 * Math.sin((t - OPEN_AT) * 1.6); // 얼굴이 보이게 제자리에서 좌우로 살짝
      }
      if (effect && t > OPEN_AT + OPEN) {
        effect.visible = true;
        for (const { s, phase } of stars) { const k = 0.5 + 0.5 * Math.sin(t * 5 + phase); s.scale.setScalar(0.05 + 0.04 * k); (s.material as THREE.SpriteMaterial).opacity = 0.4 + 0.6 * k; }
      }
      if (t > TOTAL - FADE) root.scale.setScalar(1 - smooth((t - (TOTAL - FADE)) / FADE));
      if (t >= TOTAL) { ended = true; scene.remove(root); done(); return false; }
      return true;
    },
  };
}
