import * as THREE from 'three';

// 남은 시간 표시판(사용자 2026-11-02 사진 237·238 '타이머를 기계에'): 화면 위 시간 알약 대신 하는 기계 조작대 위에 검은 판 + 빛나는 숫자.
// 기계 좌표(조작대 윗면 자리)에 카메라 쪽으로 비스듬히 세운다 — 인형·미는 뽑기는 레버와 잡기 버튼 사이, 피규어·고리는 버튼 ① 왼쪽
export const DOLL_TIMER_AT = [-0.02, 0.945, 0.66] as const;
export const BOX_TIMER_AT = [-0.16, 0.945, 0.66] as const;
const W = 0.15, H = 0.08, TILT = 0.75, PX = 192, PY = 102;
const PLANE = new THREE.PlaneGeometry(W, H);

export type MachineTimer = { set(seconds: number): void; dispose(): void };

export function buildMachineTimer(anchor: THREE.Object3D, at: readonly [number, number, number]): MachineTimer {
  const canvas = document.createElement('canvas'); canvas.width = PX; canvas.height = PY;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const mesh = new THREE.Mesh(PLANE, mat);
  mesh.name = 'machine-timer';
  mesh.position.set(...at); mesh.rotation.x = -TILT; // 윗면이 뒤로 눕고 앞(카메라)을 본다
  anchor.add(mesh);
  const draw = (text: string) => {
    const g = canvas.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, PX, PY);
    g.fillStyle = '#1d1430'; g.strokeStyle = '#ff7ab6'; g.lineWidth = 6;
    g.beginPath(); g.roundRect?.(4, 4, PX - 8, PY - 8, 18); g.fill(); g.stroke();
    g.font = '900 64px -apple-system, "Apple SD Gothic Neo", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ff9fd0'; g.shadowBlur = 14; g.fillStyle = '#ffe3f2';
    g.fillText(`${text}초`, PX / 2, PY / 2 + 3);
    g.shadowBlur = 0;
  };
  return {
    set(seconds) {
      const text = String(Math.max(0, Math.ceil(seconds)));
      if (mesh.userData.text === text) return;
      mesh.userData.text = text;
      draw(text);
      tex.needsUpdate = true;
    },
    dispose() { anchor.remove(mesh); tex.dispose(); mat.dispose(); },
  };
}
