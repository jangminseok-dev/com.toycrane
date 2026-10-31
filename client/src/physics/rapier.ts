// Rapier(WASM) 지연 로딩 (물리 뽑기 설계 §4.1): 약 2MB라 입장 뒤 한가할 때 받고, 한 번 받으면 같은 약속을 돌려준다
export type Rapier = typeof import('@dimforge/rapier3d-deterministic-compat');

let loading: Promise<Rapier> | null = null;
let ready: Rapier | null = null;

export function loadRapier(): Promise<Rapier> {
  loading ??= import('@dimforge/rapier3d-deterministic-compat').then(async (R) => { await R.init(); ready = R; return R; });
  return loading;
}

export const rapierReady = (): boolean => ready !== null;
export const rapierNow = (): Rapier | null => ready;
