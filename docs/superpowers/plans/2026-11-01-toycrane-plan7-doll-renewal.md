# 인형 리뉴얼 (B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 24종 인형을 승인된 v13 카툰 결(매끈한 무광, 2단 셀 음영, 굵은 외곽선, 그린 눈)로 다시 만들어, 도감 시제품에서 사용자 승인을 받은 뒤 게임(무더기·물리·확률·성능)에 넣고 배포한다.

**Architecture:** 새 인형은 `client/src/world/plush/`에 따로 만든다 — 모양 도구·재질·외곽선(`kit.ts`), 그린 얼굴 한 장 그림(`faceAtlas.ts`), 세트별 생김새(`soft.ts`·`forest.ts`·`water.ts`·`dream.ts`), 변형까지 입혀 완성하는 `makePlush`(`index.ts`). 도감 시제품(`client/dogam.html`, 개발 서버 전용)이 이것만 써서 24종을 보여 주고, 사용자 승인 뒤에 `world/dolls.ts`의 `makeDoll`·`dollHits`·`headOf`가 `makePlush`로 넘어간다. 부딪힘 공은 생김새를 만들 때 부위마다 같이 만든다(모양을 훑어 추측하지 않는다).

**Tech Stack:** three.js 0.169 (MeshToonMaterial, DecalGeometry, LatheGeometry, TubeGeometry), TypeScript, vitest, Rapier(deterministic-compat), Python Workers(server: 저장 키·규약 번호만).

**Spec:** `docs/superpowers/specs/2026-11-01-toycrane-doll-renewal-design.md` · 결 기준 시제품 `docs/reference/prototypes/spike-plush-v13.html`(가운데 곰·오른쪽 고양이)

## Global Constraints

- 털 표현 금지: 털 셸·셰이더 잔털/곱슬 결·봉제선 골 모두 안 된다. 매끈한 무광, 광택은 눈만 (spec §2 안티목표, §3).
- 셀 음영: 툰 그라데이션 2단 — 어두운 단 165, 밝은 단 255(16칸 표, NearestFilter 아닌 Linear로 경계만 좁게: 앞 8칸 165, 뒤 8칸 255). 가장자리 빛 `outgoingLight += diffuse * 0.22 * smoothstep(0.35, 0.5, pow(1 - n·v, 3))`. 인형은 제 몸 그림자를 받지 않는다(receiveShadow false), 그림자는 드리운다 (v13 값).
- 외곽선: 뒷면 껍질, 시제품 단위 굵기 0.02, 색 0x3f2a4f, polygonOffset factor 3 / units 12. 부위마다 만들어 인형 하나에 한 덩어리. 귓속·발바닥 젤리처럼 겉면에 붙은 얇은 부위는 외곽선 없음 (spec §3).
- 비율: 머리가 몸보다 크다, 몸통은 배 모양 돌림체 한 덩어리. 얼굴판(가면처럼 큰 흰 판) 금지 — 동물 본래 무늬는 괜찮다. 오리지널(유명 캐릭터와 닮지 않게, 예: 리본 단 넓은 얼굴 고양이 금지) (spec §2·§3).
- 손발·꼬리: 앞발은 관 끝 = 발 공 중심·같은 굵기로 이음새 없이 + 발가락 줄 둘, 뒷발은 몸 색 + 분홍 젤리(큰 볼록이 1 + 발가락 볼록이 3), 꼬리는 몸 안에서 시작해 몸을 감아 바닥에 (spec §3).
- 생김새는 시제품 단위(v13 곰 머리 꼭대기 ≈ 1.76)로 짓고, `makePlush`가 단단한 부위의 맨 위가 서 있는 형 **1.07**, 동글이형 **1.02**가 되게 고르게 줄인다(지금 인형과 같은 키, spec §4). 서버 한계: 맨 위 < 0.34 / 0.3 (`dolls.test.ts` 기존 단언).
- 기계 속 크기 `DOLL_SCALE = 0.3` 그대로.
- `client/src/world/plush/`는 `client/src/world/dolls.ts`를 import하지 않는다(Task 10에서 `dolls.ts`가 plush를 import하므로 순환이 생긴다). `DollLook`·`Body`는 `net/protocol`에서, `PLAIN`은 시험에서만 `dolls.ts`에서 가져온다.
- 부딪힘 공: 인형 한 마리 14개 이하(spec §6 "12개 안팎"), 귀는 넣지 않는다, 앞발·뒷발·꼬리는 넣는다.
- 확률(1000판): 24종 각각 머리 겨냥 0.30~0.40, 희귀 0.13~0.22, 황금 0.08~0.15(곰·동글이형 하나), 먼 쪽 > 가까운 쪽, 장면 4개 통과. 승인된 생김새는 고치지 않고 `shared/claw.json`의 종류별 배율로 맞춘다 (spec §6).
- 휴대폰 기계 앞 그리기 호출 ≤ 160 (지금 151). 물리 휴대폰 ≤ 1ms (지금 0.73). 삼각형은 측정해 기록 (spec §7).
- 무료·코드만. 외부 에셋·AI 생성 없음 (spec §2).
- 사용자에게 보이기 전에 반드시 스크린샷으로 먼저 확인한다(실패작이 그대로 보이면 안 됨).
- 화면 문구: 한국어, 일본 글자 없음, 문장을 가운데 점(·)으로 잇지 않는다.
- 배포는 사용자 허락을 받고 한다. 커밋 끝: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. 누운·뒤집힌 인형에서 보이는 발·꼬리를 손가락·옆 인형이 뚫는다 → 단단한 부위의 모든 꼭짓점이 어느 부딪힘 공에서 0.06(모델 단위) 안에 있다 (Task 4~7 공통 시험 `species.test.ts`).
2. 황금·특수효과 인형에서 그린 눈·입이 금이나 무늬로 덮여 얼굴이 사라진다 → 황금·효과 인형도 얼굴 조각은 얼굴 재질 그대로 (Task 8).
3. 24종·5표정·희귀가 섞인 무더기에서 재질이 늘어 그리기 호출이 튄다 → 한 묶음 재질 ≤ 6 (Task 10).
4. 배포 직후 옛 저장 상태(v4, 옛 모양 자리)와 열려 있던 옛 화면 → v4는 안 앉은 채로 읽히고, 규약 4 화면은 새로 고친다 (Task 13).
5. 처음 들어올 때 무더기 만들기(표면 그림 붙이기)가 길어 화면이 멈칫한다 → 기계 하나(9마리, 서로 다른 겉모습) lite 만들기가 PC vitest에서 200ms 이하 (Task 10).

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `client/src/world/plush/kit.ts` (새) | 셀 재질·외곽선 재질, 모양 도구(공·관·배 모양·뾰족 귀), `PlushBuilder`(부위 모으기·외곽선 껍질·부딪힘 공·자수), 꼭짓점 색 재질 |
| `client/src/world/plush/faceAtlas.ts` (새) | 그린 얼굴 조각 한 장 그림, 표정별 조각 고르기, 표면에 붙이는 조각 도형, 얼굴 재질 하나 |
| `client/src/world/plush/species.ts` (새) | `Species` 형, 24종 등록표 `SPECIES` (세트 파일을 모은다) |
| `client/src/world/plush/soft.ts` · `forest.ts` · `water.ts` · `dream.ts` (새) | 세트별 6종 생김새 |
| `client/src/world/plush/index.ts` (새) | `makePlush(id, look, lite)`: 생김새 + 색·체형·표정·희귀·황금 + 키 맞추기 + 캐시 |
| `client/dogam.html`, `client/src/dogam/main.ts` (새, 개발 전용) | 도감 시제품 페이지 |
| `client/e2e/dogam-shot.mjs` (새) | 도감 보기별 스크린샷 |
| `client/src/world/dolls.ts` (고침) | `makeDoll`·`dollHits`·`headOf`·`isRoundDoll`이 `makePlush`로 넘어감, 옛 생김새 코드 삭제 |
| `client/src/world/bigZone.ts` (고침) | 무더기 꼭짓점 색 재질을 셀 재질로 |
| `client/src/physics/clawBody.ts`, `shared/claw.json`, `client/src/data/claw.ts` (고침) | 종류별 힘 배율 |
| `client/sim/kinds.test.ts` (새) | 종류별 1000판 확률 |
| `server/.../do_storage_machine_contents.py`, `server/.../server_messages.py`, `client/src/net/protocol.ts`, `shared/protocol_fixtures.json` (고침) | 저장 키 v5, 규약 5 |

---

### Task 1: 셀 재질과 모양 도구 (`kit.ts`)

**Files:**
- Create: `client/src/world/plush/kit.ts`
- Test: `client/src/world/plush/kit.test.ts`

**Interfaces:**
- Produces:
  - `export type V3 = [number, number, number]`
  - `export type Slot = 'body' | 'accent' | 'pad' | 'inner' | 'nose' | 'thread' | number` (number = 고정 색)
  - `export type PartOpts = { slot?: Slot; outline?: boolean; hit?: 'solid' | 'ear' | 'none'; name?: string }` — 기본 slot 'body', outline true, hit 'solid'
  - `export const CEL: THREE.DataTexture`, `export function plushMat(color: number): THREE.MeshToonMaterial` (색마다 캐시, `userData.plush = true`), `export const PLUSH_VC: THREE.MeshToonMaterial` (꼭짓점 색, 같은 셀·가장자리 빛), `export function plushVCWithMap(map: THREE.Texture): THREE.MeshToonMaterial` (캐시), `export const PLUSH_OUTLINE: THREE.MeshBasicMaterial`, `export const OUTLINE_W = 0.02`
  - `export type Hit = { c: THREE.Vector3; r: number; part?: 'crown' }` (지금 `dolls.ts`의 `Hit`을 여기로 옮기고 `dolls.ts`는 다시 내보낸다)
  - `export class PlushBuilder { constructor(o: { lite: boolean }); sphere(r: number, at: V3, scale?: V3, rot?: V3, o?: PartOpts): this; tube(points: V3[], r: number, taper?: (t: number) => number, o?: PartOpts): this; pear(profile: [number, number][], flatZ?: number, zOff?: number, o?: PartOpts): this; pointedEar(r: number, at: V3, side: -1 | 1, flat: number, lean: number, o?: PartOpts): this; build(colors: (slot: Slot) => THREE.Material): BuiltPlush }`
  - `export type BuiltPlush = { group: THREE.Group; surface: THREE.Mesh[]; solid: Hit[]; ears: Hit[]; head: { c: number; r: number } }` — `surface` = 얼굴 그림·자수를 붙일 겉면 메시들(외곽선 제외), `head` = 이름이 'head'인 부위의 중심 높이·평균 반지름
- 동작: 같은 재질(slot)끼리 한 메시로 합치고(재질 수만큼 메시), 외곽선이 켜진 부위들의 껍질을 합쳐 `PLUSH_OUTLINE` 메시 하나로 group에 넣는다. 공 하나 = 부딪힘 공 하나(반지름 = 세 축 배율 평균 × r × 0.95), 관 = 길이에 맞춰 공 2~3개, 배 모양 = 굵은 마디마다 공(최대 3). lite면 공 16×12·관 24×10·돌림 24칸, 아니면 v13 값(공 48×36, 관 48×32, 돌림 64칸). 각 메시 castShadow true, receiveShadow false.

- [ ] **Step 1: Write the failing tests** — `kit.test.ts`:

```ts
test('plush materials share the two-step cel shading and are cached per color', () => {
  expect(plushMat(0xc4a6ee)).toBe(plushMat(0xc4a6ee));
  expect(plushMat(0xc4a6ee).gradientMap).toBe(CEL);
  expect([...CEL.image.data]).toEqual([...Array(8).fill(165), ...Array(8).fill(255)]);
  expect(PLUSH_VC.vertexColors).toBe(true);
  expect(PLUSH_OUTLINE.side).toBe(THREE.BackSide);
  expect(PLUSH_OUTLINE.color.getHex()).toBe(0x3f2a4f);
});
test('a builder merges parts per material and adds one outline mesh', () => {
  const b = new PlushBuilder({ lite: false })
    .sphere(0.6, [0, 1.2, 0], [1.12, 0.94, 0.96], [0, 0, 0], { name: 'head' })
    .sphere(0.11, [0.5, 1.61, 0.02], [1, 1, 0.32], [0, 0, 0], { slot: 'inner', outline: false, hit: 'none' })
    .tube([[0.2, 0.8, 0], [0.4, 0.5, 0.2], [0.36, 0.4, 0.3]], 0.11);
  const built = b.build((s) => plushMat(s === 'inner' ? 0xfff4e2 : 0xc4a6ee));
  const meshes = built.group.children as THREE.Mesh[];
  expect(meshes.filter((m) => m.material === PLUSH_OUTLINE)).toHaveLength(1);
  expect(meshes.filter((m) => m.material !== PLUSH_OUTLINE)).toHaveLength(2);
  expect(built.surface).toHaveLength(2);
  expect(built.head.c).toBeCloseTo(1.2); expect(built.head.r).toBeGreaterThan(0.5);
  expect(built.solid.length).toBeGreaterThanOrEqual(3); // 머리 1 + 관 2~3
  expect(meshes.every((m) => m.castShadow && !m.receiveShadow)).toBe(true);
});
test('lite builds use fewer triangles', () => {
  const tri = (lite: boolean) => { const g = new PlushBuilder({ lite }).sphere(0.5, [0, 1, 0]).build(() => plushMat(0xffffff)).group; let n = 0; g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) n += m.geometry.index ? m.geometry.index.count / 3 : m.geometry.getAttribute('position').count / 3; }); return n; };
  expect(tri(true)).toBeLessThan(tri(false) / 3);
});
test('a pear torso is one closed lathe and gets body hit balls', () => {
  const built = new PlushBuilder({ lite: false }).pear([[0.02, 0], [0.3, 0.43], [0.6, 0.36], [0.88, 0]], 0.94, 0.02).build(() => plushMat(0xffffff));
  expect(built.solid.length).toBeGreaterThanOrEqual(1); expect(built.solid.length).toBeLessThanOrEqual(3);
});
```

- [ ] **Step 2: Run** `cd client && npx vitest run src/world/plush/kit.test.ts` — Expected: FAIL (모듈 없음).
- [ ] **Step 3: Implement `kit.ts`** — 모양 도구·셀 재질·외곽선은 `docs/reference/prototypes/spike-plush-v13.html`의 `sph`/`tube`/`pear`/`earShape`/`celMat`/`hull`/`withOutline`를 옮긴다(시제품의 털 셰이더·`bakeAO`·`lumpy`·`pinchSeam`은 옮기지 않는다). 가장자리 빛은 `onBeforeCompile`로 `#include <opaque_fragment>` 앞에 넣는다(시제품과 같은 식, `PLUSH_VC`·`plushVCWithMap`에도).
- [ ] **Step 4: Run** 같은 명령 — Expected: PASS. 그리고 `npx tsc --noEmit -p .` — Expected: 오류 없음.
- [ ] **Step 5: Commit** `feat: 인형 리뉴얼 — 셀 재질·외곽선·모양 도구(PlushBuilder)`

---

### Task 2: 그린 얼굴 한 장 그림 (`faceAtlas.ts`)과 자수

**Files:**
- Create: `client/src/world/plush/faceAtlas.ts`
- Modify: `client/src/world/plush/kit.ts` (자수·얼굴 그림 붙이기)
- Test: `client/src/world/plush/faceAtlas.test.ts`

**Interfaces:**
- Consumes: Task 1 `PlushBuilder`, `BuiltPlush.surface`
- Produces:
  - `export type EyeStyle = 'dot' | 'anime'`, `export type Iris = 'violet' | 'blue' | 'green' | 'amber' | 'pink' | 'brown'`
  - `export type Cell = 'dotEye' | `anime-${Iris}` | 'closed' | 'animeClosed' | 'sleepy' | 'blush' | 'blushBig' | `mark-${string}``  (무늬 칸은 세트 작업에서 필요하면 더한다 — 예: 'mark-tabby')
  - `export const FACE_MAT: THREE.MeshToonMaterial` — 한 장 그림(map), transparent, depthWrite false, polygonOffset factor -4, `gradientMap: CEL`
  - `export function cellUV(cell: Cell): [u0: number, v0: number, u1: number, v1: number]`
  - `export function eyeCells(style: EyeStyle, iris: Iris, face: number): { left: Cell; right: Cell; blush: Cell; omega: boolean }` — 표정(spec §4): 0 웃음(양쪽 감은 눈) · 1 ω 입(뜬 눈, omega true) · 2 윙크(오른눈만 감음) · 3 졸린 눈 · 4 볼 빨개짐(blushBig). 감은 눈은 style이 'anime'면 'animeClosed'
  - `PlushBuilder`에 더한다: `paint(cell: Cell, at: [x: number, y: number], size: [w: number, h: number], name: string): this`(앞에서 본 자리를 겉면에 투사, 이름은 'face-'로 시작), `stitch(points: [x: number, y: number][], r?: number, name?: string): this`(겉면에 붙인 실, 재질은 slot 'thread', lite면 생략하되 이름이 'face-mouth'인 자수는 남긴다). 둘 다 `build` 안에서 겉면 메시가 만들어진 뒤 붙고, 얼굴 그림은 모두 `FACE_MAT` 메시 하나로 합친다.

- [ ] **Step 1: Write the failing tests** — `faceAtlas.test.ts`:

```ts
test('five faces pick five different eye sets', () => {
  for (const style of ['dot', 'anime'] as const) {
    const sig = (f: number) => JSON.stringify(eyeCells(style, 'violet', f));
    expect(new Set([0, 1, 2, 3, 4].map(sig)).size, style).toBe(5);
  }
  expect(eyeCells('dot', 'violet', 2)).toMatchObject({ left: 'dotEye', right: 'closed' });
  expect(eyeCells('anime', 'green', 0)).toMatchObject({ left: 'animeClosed', right: 'animeClosed' });
  expect(eyeCells('anime', 'green', 1)).toMatchObject({ left: 'anime-green', omega: true });
  expect(eyeCells('dot', 'violet', 4).blush).toBe('blushBig');
});
test('every cell has its own place on the atlas', () => {
  const cells: Cell[] = ['dotEye', 'closed', 'animeClosed', 'sleepy', 'blush', 'blushBig', 'anime-violet', 'anime-blue', 'anime-green', 'anime-amber', 'anime-pink', 'anime-brown'];
  const uvs = cells.map((c) => cellUV(c).join(','));
  expect(new Set(uvs).size).toBe(cells.length);
  for (const c of cells) { const [u0, v0, u1, v1] = cellUV(c); expect(u0).toBeGreaterThanOrEqual(0); expect(v1).toBeLessThanOrEqual(1); expect(u1).toBeGreaterThan(u0); expect(v1).toBeGreaterThan(v0); }
});
test('painted face pieces all share one material', () => {
  const built = new PlushBuilder({ lite: false }).sphere(0.6, [0, 1.2, 0], [1, 1, 1], [0, 0, 0], { name: 'head' })
    .paint('dotEye', [-0.21, 1.25], [0.095, 0.12], 'face-eye').paint('dotEye', [0.21, 1.25], [0.095, 0.12], 'face-eye')
    .paint('blush', [0.36, 1.06], [0.15, 0.09], 'face-cheek').stitch([[0, 1.07], [0, 1.03]], 0.009, 'face-mouth')
    .build((s) => plushMat(s === 'thread' ? 0x3a2330 : 0xc4a6ee));
  const faceMeshes: THREE.Mesh[] = []; built.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.material === FACE_MAT) faceMeshes.push(m); });
  expect(faceMeshes).toHaveLength(1);
  const names: string[] = []; built.group.traverse((o) => names.push(o.name));
  expect(names).toContain('face-mouth');
});
```

- [ ] **Step 2: Run** `npx vitest run src/world/plush` — Expected: FAIL (모듈 없음).
- [ ] **Step 3: Implement** — 그림은 시제품 `dotEyeTex`·`eyeTex`·`blushTex`를 한 캔버스(1024×1024)의 칸에 그린다. 애니 눈은 Iris마다 그라데이션 색만 다르게(violet은 시제품 `#2c1a5c → #5b3fc4 → #a98cff`). 감은 눈은 굵은 ∩ 선, 졸린 눈은 살짝 내려간 가로 선, blushBig은 blush보다 크고 진하게. 투사는 `DecalGeometry`로 만들고 uv를 `cellUV` 칸으로 다시 맞춘다. 얼굴 조각은 각각 `name`을 단 빈 `Object3D`로도 group에 남겨(위치·크기) 표정 서명 시험이 읽게 한다.
- [ ] **Step 4: Run** `npx vitest run src/world/plush` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: 인형 리뉴얼 — 그린 얼굴 한 장 그림·표정 5가지·자수`

---

### Task 3: 생김새 등록표와 도감 시제품 페이지

**Files:**
- Create: `client/src/world/plush/species.ts`, `client/src/world/plush/index.ts`, `client/dogam.html`, `client/src/dogam/main.ts`, `client/e2e/dogam-shot.mjs`
- Test: `client/src/world/plush/species.test.ts`

**Interfaces:**
- Consumes: Task 1·2
- Produces:
  - `export type Species = { id: string; round: boolean; eyes: EyeStyle; iris: Iris; make(b: PlushBuilder, face: number): void }` (`species.ts`)
  - `export const SPECIES: Record<string, Species>` — 이 작업에서는 `soft.ts`의 곰·고양이 두 종만(Task 4가 나머지를 채운다)
  - `export const TARGET_TOP = { standing: 1.07, round: 1.02 }` (`index.ts`)
  - `export function makePlush(id: string, look: DollLook, lite: boolean): { group: THREE.Group; solid: Hit[]; ears: Hit[]; head: { c: number; r: number } } | null` (`index.ts`) — 이 작업에서는 색 slot 'body' = 팔레트 색, 'accent' = 팔레트 색을 흰색 쪽으로 0.55 섞은 색, 나머지 고정 색만 처리하고 키를 맞춰(단단한 공 맨 위 = TARGET_TOP) group과 공을 같은 배율로 줄인다. 희귀·황금·체형은 Task 8.
  - 도감 페이지: `npm run dev` 뒤 `http://localhost:5173/dogam.html`. 주소 인자 `set=soft|forest|water|dream`(없으면 전부), `kind=<id>`(한 종만 크게), `view=front|side|back|paws`, `face=0..4`, `look=variants`(한 종을 색 6·체형 3·표정 5·희귀·황금으로 줄 세움), `shot=1`(안내 숨김). 바닥·조명은 v13 시제품과 같게. 그리기 준비가 끝나면 `window.__ready = true`.
  - `node client/e2e/dogam-shot.mjs <port> <base-url> <out-dir> [query...]` — 쿼리마다 1400×900 스크린샷 `<out-dir>/<query를 파일 이름으로>.png`, 페이지 예외를 출력.
- 곰·고양이 생김새는 v13 시제품 `bear()`·`cat()`(꼬리·손발 고친 마지막 판)을 그대로 옮긴다. 눈: 곰 'dot', 고양이 'anime' + 'violet', 고양이 이마 줄무늬는 'mark-tabby' 칸.

- [ ] **Step 1: Write the failing tests** — `species.test.ts` (Task 4~7이 종을 더할 때마다 이 시험이 그 종까지 덮는다):

```ts
const kinds = () => Object.keys(SPECIES);
const solidVerts = (g: THREE.Object3D) => { /* 외곽선·얼굴·귀(이름 'ear')·자수를 뺀 겉면 꼭짓점을 월드 좌표로 */ };
test('each species reaches its target height and stays under the server limit', () => {
  for (const id of kinds()) {
    const p = makePlush(id, PLAIN, false)!;
    const top = Math.max(...p.solid.map((h) => h.c.y + h.r));
    expect(top, id).toBeCloseTo(SPECIES[id].round ? TARGET_TOP.round : TARGET_TOP.standing, 2);
    expect(top, id).toBeLessThan(0.34 / 0.3);
  }
});
test('each species has at most fourteen hit balls and a head', () => {
  for (const id of kinds()) { const p = makePlush(id, PLAIN, false)!; expect(p.solid.length, id).toBeLessThanOrEqual(14); expect(p.head.r, id).toBeGreaterThan(0.2); }
});
// Review Focus 1: 보이는 단단한 부위(발·꼬리 포함)를 공이 감싼다 — 손가락·옆 인형이 뚫지 않게
test('hit balls hug every solid vertex', () => {
  for (const id of kinds()) {
    const p = makePlush(id, PLAIN, true)!;
    for (const v of solidVerts(p.group)) expect(Math.min(...p.solid.map((h) => v.distanceTo(h.c) - h.r)), id).toBeLessThan(0.06);
  }
});
test('every species knows its eye style', () => {
  for (const id of kinds()) expect(['dot', 'anime'], id).toContain(SPECIES[id].eyes);
});
```

- [ ] **Step 2: Run** `npx vitest run src/world/plush` — Expected: FAIL.
- [ ] **Step 3: Implement** `species.ts`, `soft.ts`(곰·고양이), `index.ts`, 도감 페이지, 스크린샷 스크립트. `dogam.html`은 `client/` 바로 아래에 두어 `vite build`(index.html만 넣는다)에는 들어가지 않게 한다 — `npm run build` 뒤 `ls dist`에 dogam이 없는지 확인.
- [ ] **Step 4: Run** `npx vitest run src/world/plush && npx tsc --noEmit -p . && npm run build` — Expected: PASS, `dist/`에 dogam 없음.
- [ ] **Step 5: 스크린샷 자체 확인** — `npm run dev`를 띄우고 `node e2e/dogam-shot.mjs 9461 http://localhost:5173 /tmp-dir "kind=bear&shot=1" "kind=cat&shot=1" "kind=cat&view=back&shot=1" "kind=cat&view=paws&shot=1"` (`/tmp-dir`은 세션 scratchpad). 사진을 열어 v13 시제품(`docs/reference/prototypes/spike-plush-v13.html`)과 같은 결인지 본다 — 다르면 고친다.
- [ ] **Step 6: Commit** `feat: 인형 리뉴얼 — 생김새 등록표·makePlush·도감 시제품(곰·고양이)`

---

### Task 4: 말랑 동물 세트 (토끼·곰·고양이·강아지·판다·햄스터)

**Files:**
- Modify: `client/src/world/plush/soft.ts`, `client/src/world/plush/faceAtlas.ts`(필요한 무늬 칸)
- Test: `client/src/world/plush/species.test.ts`(이미 모든 등록 종을 덮는다)

**Interfaces:**
- Consumes: Task 1~3. Produces: `SPECIES`에 bunny·dog·panda·hamster.
- 생김새는 빌더가 정한다(spec §8). 원칙: v13 곰·고양이와 같은 결, 머리 큰 비율, 얼굴판 금지(판다 눈 둘레·주둥이는 본래 무늬), 앞발·뒷발·꼬리 규칙(Global Constraints), 오리지널. 토끼 귀는 hit 'ear'.
- 눈 배정 첫 안 **[빌더]**: 곰·강아지·판다 'dot', 토끼·고양이·햄스터 'anime'(사용자가 Task 9에서 확인).

- [ ] **Step 1:** 네 종을 `SPECIES`에 더한다(생김새는 등록과 함께 쓰므로 시험이 먼저 빨갛게 되지 않는다 — 대신 Step 2가 관문).
- [ ] **Step 2: Run** `npx vitest run src/world/plush` — Expected: PASS (높이·공 수·공이 감싸기·눈 스타일이 새 종에도 맞음). 실패하면 생김새나 공을 고친다(시험 수치는 바꾸지 않는다).
- [ ] **Step 3: 스크린샷 자체 확인** — `set=soft&shot=1`, 종마다 `kind=<id>&view=front|side|back|paws&shot=1`. 기괴 목록(spec §2: 큰 얼굴판, 원반 머리, 고리 팔, 떠 있는 눈)과 유명 캐릭터 닮음을 하나씩 확인하고 고친다.
- [ ] **Step 4: Commit** `feat: 인형 리뉴얼 — 말랑 동물 세트 6종`

### Task 5: 숲속 친구들 세트 (여우·너구리·다람쥐·부엉이·사슴·고슴도치)

같은 방식(Task 4의 Step 1~4). 파일 `client/src/world/plush/forest.ts`. 부엉이는 `round: true`(동글이형). 다람쥐 줄무늬는 몸 재질에 무늬가 필요하면 `plushVCWithMap`과 같은 방식의 무늬 재질을 slot 숫자 대신 쓰지 말고 `faceAtlas`의 'mark-' 칸으로 그린다(무더기 재질이 늘지 않게). 눈 첫 안 **[빌더]**: 여우·사슴 'anime', 나머지 'dot'. 고슴도치 가시는 단단한 공에 넣는다(머리 위로 솟은 부품). Commit `feat: 인형 리뉴얼 — 숲속 친구들 세트 6종`.

### Task 6: 물가 친구들 세트 (펭귄·개구리·오리·물개·문어·고래)

같은 방식. 파일 `client/src/world/plush/water.ts`. 여섯 다 `round: true`. 머리-몸 구분이 없는 몸통형은 몸통 위쪽에 이름 'head' 공을 둔다(겨냥 고리·머리 기준이 그 공을 쓴다). 문어 다리는 몸 아래로 뻗어 바닥에 닿고 단단한 공에 넣는다. 눈 첫 안 **[빌더]**: 전부 'dot'. Commit `feat: 인형 리뉴얼 — 물가 친구들 세트 6종`.

### Task 7: 꿈동산 친구들 세트 (병아리·돼지·양·소·공룡·유니콘)

같은 방식. 파일 `client/src/world/plush/dream.ts`. 병아리 `round: true`. 유니콘 뿔·공룡 등 가시는 단단한 공(머리 위 부품). 눈 첫 안 **[빌더]**: 유니콘 'anime'('pink'), 나머지 'dot'. 이 작업이 끝나면 `Object.keys(SPECIES)`가 `DOLLS`(catalog)의 24종과 같다 — `species.test.ts`에 단언을 더한다:

```ts
test('all 24 catalog dolls have a species', () => expect(Object.keys(SPECIES).sort()).toEqual(Object.keys(DOLLS).sort()));
```

Commit `feat: 인형 리뉴얼 — 꿈동산 친구들 세트 6종`.

---

### Task 8: 변형 — 색·체형·표정·희귀·황금

**Files:**
- Modify: `client/src/world/plush/index.ts`
- Test: `client/src/world/plush/variants.test.ts`

**Interfaces:**
- Consumes: Task 3 `makePlush`, 기존 `world/dollTextures.ts`의 `effectMaterial(rare)`, `goldMaterial()`, `goldToon()`, `sparkMaterial(rare)`, catalog `DOLLS`·`EFFECTS`·`GOLD`
- Produces: `makePlush`가 `look.color`(팔레트 칸), `look.face`(표정), `look.rare`('' / 효과 id / 'gold')를 반영. 체형은 지금처럼 놓는 쪽(무더기·물리)이 x·z에 `BODY_W`를 곱한다 — `makePlush`는 하지 않는다. 결과 group에 기존 이름 규칙을 지킨다: 몸 메시 'body', 귀 'ear'(+`userData.ear`), 꼬리 'tail', 왕관 'crown', 반짝이 'aura'(`userData.spin`에 등록, lite면 없음), 얼굴 조각 'face-*'.
- 희귀: body slot을 `effectMaterial(rare)`로, 작은 왕관(배율 1) + 반짝이. 황금: 얼굴 조각·자수·외곽선 말고 전부 `goldMaterial()`, 큰 왕관(배율 1.4). 왕관 모양은 지금 `dolls.ts` 왕관을 셀 결에 맞게 옮긴다(외곽선 포함). 왕관 공은 `{ part: 'crown' }`로 solid에 더한다(지금처럼 맨 위 + 0.06×배율, 반지름 0.15×배율).
- 캐시: (id, color, face, rare, lite)마다 한 번 만들고 복제해 준다. 얼굴 투사는 (id, face, lite)마다 한 번.

- [ ] **Step 1: Write the failing tests** — `dolls.test.ts`의 변형 시험 다섯 개(`each palette color paints the body`, `gold dolls are made of shiny metal and wear a big crown`, `rare dolls wear a small crown and plain ones none`, `all eight effects build and differ`, `rare dolls sparkle unless drawn in the pile`, `faces change the face parts`, `the pile keeps the faces too`, `a crowned doll adds the crown to its hit spheres`)를 `makePlush` 대상으로 `variants.test.ts`에 옮기고, 더한다:

```ts
// Review Focus 2: 황금·효과 인형도 얼굴은 얼굴 재질 그대로
test('gold and effect dolls keep their painted faces', () => {
  for (const rare of ['gold', 'galaxy']) {
    const g = makePlush('cat', { ...PLAIN, rare }, false)!.group;
    const face: THREE.Mesh[] = []; g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.material === FACE_MAT) face.push(m); });
    expect(face.length, rare).toBe(1);
  }
});
test('the same look is built once and handed out as copies', () => {
  const a = makePlush('bear', { ...PLAIN, color: 2, face: 1 }, true)!.group, b = makePlush('bear', { ...PLAIN, color: 2, face: 1 }, true)!.group;
  expect(a).not.toBe(b);
  expect((a.getObjectByName('body') as THREE.Mesh).geometry).toBe((b.getObjectByName('body') as THREE.Mesh).geometry);
});
```

- [ ] **Step 2: Run** `npx vitest run src/world/plush` — Expected: FAIL.
- [ ] **Step 3: Implement** 변형.
- [ ] **Step 4: Run** 같은 명령 — Expected: PASS. 도감 `kind=bear&look=variants&shot=1`, `kind=cat&look=variants&shot=1` 스크린샷으로 희귀·황금이 보통보다 확실히 귀해 보이는지 확인.
- [ ] **Step 5: Commit** `feat: 인형 리뉴얼 — 색·표정·희귀·황금 변형`

---

### Task 9: 도감 승인 관문 (사용자)

**이 작업은 사용자 승인 없이는 끝나지 않는다** (spec §5.1). 실행자는 여기서 멈추고 묻는다.

- [ ] **Step 1:** 도감 전체(`shot=1`, 세트 넷)와 종마다 앞·옆·뒤 스크린샷을 찍어 먼저 직접 본다. 기괴·닮음·외곽선 자국·잘린 꼬리 끝이 있으면 고친다.
- [ ] **Step 2:** 개발 서버를 띄운 채 사용자에게 `http://localhost:5173/dogam.html`을 열어 보여 준다(브라우저로 열기). 눈 배정(구슬형/애니형) 표와 함께 "어느 캐릭터를 고칠지" 묻는다.
- [ ] **Step 3:** 사용자가 고치라는 것을 고치고 Step 1~2를 되풀이한다. 고친 뒤마다 `npx vitest run src/world/plush` PASS.
- [ ] **Step 4:** 사용자가 24종 전부를 승인하면 ledger에 승인 문구를 그대로 적고 커밋 `feat: 인형 리뉴얼 — 도감 승인(<날짜>)`.

---

### Task 10: 게임에 넣기 — `dolls.ts`·무더기·진열장·든 인형

**Files:**
- Modify: `client/src/world/dolls.ts`, `client/src/world/bigZone.ts`, `client/src/world/dolls.test.ts`, `client/src/world/bigZone.test.ts`
- Delete(쓰지 않게 된 것만): `dolls.ts`의 옛 생김새 코드, `dollTextures.ts`의 `squirrelMat`·`squirrelTail`(새 다람쥐가 안 쓰면)

**Interfaces:**
- Consumes: Task 8 `makePlush`, Task 1 `PLUSH_VC`·`plushVCWithMap`·`Hit`
- Produces (이름·모양 그대로 유지 — 부르는 쪽 `main.ts`·`decor.ts`·`bigZone.ts`·`dollPose.ts`·`aim.ts`·`physics/dollBody.ts`는 바꾸지 않는다):
  - `makeDoll(id, look = PLAIN, lite = false): THREE.Group | null` = `makePlush(...)?.group`
  - `dollHits(id, body = 'n', rare = ''): { solid: Hit[]; ears: Hit[] }` = `makePlush(id, {...PLAIN, rare}, false)`의 공을 `BODY_W[body]`로 넓힌 것(지금 `widen`과 같게)
  - `headOf(id): { c: number; r: number }` = 그 종의 `head`; `isRoundDoll(id)` = `SPECIES[id].round`; `HEAD`는 없앤다(쓰는 곳은 `headOf`로)
  - `bigZone.ts`: 무더기 꼭짓점 색 재질 `DOLL_VC` → `PLUSH_VC`, 무늬 있는 재질 → `plushVCWithMap(map)`. `tintable`은 `m.userData.plush === true && !m.vertexColors`로.

- [ ] **Step 1: Write the failing tests** — `dolls.test.ts`에서 옛 생김새 수치에 묶인 시험(`standing dolls have a big plush head`, `bear ears are soft parts the claw can bend`의 0.12, `chubby hit spheres are wider`의 인덱스)을 새 모양 기준으로 바꾸고(곰 머리 공이 몸 공보다 크다, 곰 귀 둘, 뚱뚱이 공이 BODY_W.c배), 변형 시험은 Task 8 `variants.test.ts`로 옮겼으니 지운다. `bigZone.test.ts`에 더한다:

```ts
// Review Focus 3: 24종·5표정·희귀가 섞여도 한 묶음 재질 ≤ 6
test('a block mixing every kind, face and rarity keeps few materials', () => {
  const scene = new THREE.Scene(), zone = buildBigZone(scene);
  const kinds = Object.keys(DOLLS);
  for (const [k, m] of MACHINES.slice(0, 6).entries())
    zone.setContents(m.id, Array.from({ length: 9 }, (_, i) => spot(kinds[(k * 9 + i) % kinds.length], -0.3 + (i % 3) * 0.25, -0.25 + Math.floor(i / 3) * 0.22, i, 0, { color: i % 6, face: i % 5, rare: i === 4 ? 'star' : '' })));
  zone.update(0);
  expect(materialsIn(scene, 'dolls-big-wall-0')).toBeLessThanOrEqual(6);
});
// Review Focus 5: 처음 들어올 때 기계 하나(9마리, 서로 다른 겉모습) lite 만들기 200ms 이하
test('building one machine of fresh lite dolls is quick', () => {
  const t0 = performance.now();
  Object.keys(DOLLS).slice(0, 9).forEach((id, i) => makeDoll(id, { ...PLAIN, color: i % 6, face: (i + 1) % 5 }, true));
  expect(performance.now() - t0).toBeLessThan(200);
});
```

- [ ] **Step 2: Run** `npx vitest run src/world` — Expected: FAIL.
- [ ] **Step 3: Implement** 넘기기·옛 코드 삭제.
- [ ] **Step 4: Run** `npx vitest run src && npx tsc --noEmit -p . && npm run build` — Expected: 전부 PASS.
- [ ] **Step 5:** 개발 서버(`uv run pywrangler dev` + 빌드)에서 `node client/e2e/play.mjs` 사진 인자로 기계 앞 화면을 찍어 v13 결로 보이는지 확인(사진 먼저).
- [ ] **Step 6: Commit** `feat: 인형 리뉴얼 — 게임 인형을 새 모양으로(무더기·진열장·든 인형)`

---

### Task 11: 물리 — 발·꼬리 부딪힘과 장면·결정성

**Files:**
- Modify: (필요하면) `client/src/physics/dollBody.ts`, `client/sim/scenes.test.ts`, `client/sim/world.ts`
- Test: `client/src/physics/machineWorld.test.ts`, `client/sim/scenes.test.ts`

**Interfaces:**
- Consumes: Task 10 `dollHits`(발·꼬리 공 포함). `dollColliders`는 그대로 `dollHits(...).solid`에서 왕관을 뺀 것.

- [ ] **Step 1: Write the failing test** — `machineWorld.test.ts`:

```ts
// 앞으로 나온 발·몸을 감은 꼬리에도 부딪힘이 있다 — 옆 인형이 뚫고 들어가지 않는다 (spec §6)
test('a doll dropped onto another doll\'s foot rests on it', () => {
  const foot = dollHits('cat').solid.reduce((a, h) => (h.c.z > a.c.z ? h : a)); // 가장 앞으로 나온 공
  const fx = foot.c.x * DOLL_SCALE, fz = foot.c.z * DOLL_SCALE;
  const world = new MachineWorld(R, [['cat', 0, DOLL_FLOOR, 0, 0, 0, 0, 1, 0, 'n', 0, '', 1], ['bear', fx, null, fz, 0, 0, 0, 1, 0, 'n', 0, '', 2]]);
  world.settle();
  expect(world.overlaps()).toBe(0);
  world.dispose();
});
test('every kind has at most fourteen colliders', () => {
  for (const id of Object.keys(DOLLS)) expect(dollColliders([id, 0, 0, 0, 0, 0, 0, 1, 0, 'n', 0, '', 1]).shapes.length, id).toBeLessThanOrEqual(14);
});
```

- [ ] **Step 2: Run** `npx vitest run src/physics` — Expected: 첫 시험이 Task 10 전 모양이면 FAIL, 이미 공이 있으면 PASS(그 경우 시험이 지키는 것을 ledger에 적는다).
- [ ] **Step 3:** 장면 시뮬 `npx vitest run --config vitest.sim.config.ts sim/scenes.test.ts` — 탑 쌓기·뒤집기·옮기다 걸치기·탑 유지 4개가 통과하게 장면 배치(인형 자리)만 새 모양에 맞춘다. 집게 값은 Task 12에서.
- [ ] **Step 4: Run** `npx vitest run src/physics && npx vitest run --config vitest.sim.config.ts sim/scenes.test.ts` — Expected: PASS. 결정성: `node client/e2e/determinism.mjs` PASS.
- [ ] **Step 5: Commit** `feat: 인형 리뉴얼 — 발·꼬리 부딪힘, 장면 시뮬 새 모양에 맞춤`

---

### Task 12: 종류별 확률

**Files:**
- Modify: `shared/claw.json`, `client/src/data/claw.ts`, `client/src/data/claw.test.ts`, `client/src/physics/clawBody.ts`, `server/src/toycrane/domain/shared_data.py`(`uv run python scripts/gen_shared.py`로 다시 만들기)
- Create: `client/sim/kinds.test.ts`

**Interfaces:**
- Produces: `shared/claw.json`에 `"kind": { "<id>": <배율> }` (없는 종은 1). `ClawTable.kind: Record<string, number>`. `ClawBody.grip`의 최대 힘 = 지금 식 × `(CLAW.kind[종류] ?? 1)`.

- [ ] **Step 1: Write the failing tests** — `claw.test.ts`:

```ts
test('per-kind strength factors name real dolls and stay gentle', () => {
  for (const [id, k] of Object.entries(CLAW.kind)) { expect(DOLLS[id], id).toBeTruthy(); expect(k).toBeGreaterThanOrEqual(0.6); expect(k).toBeLessThanOrEqual(1.6); }
});
```

`clawBody.test.ts`: 같은 자리에서 `CLAW.kind.bear`를 2로 바꾸면 쥔 최대 힘이 두 배(`maxForceNow()`), 시험 뒤 되돌린다. `kinds.test.ts`: `SIM_KINDS`(쉼표, 없으면 24종 전부) 종마다 `aimRate(R, { trials, kind })`가 0.30~0.40(`SIM_TRIALS` 기본 300, 맞출 때 1000).

- [ ] **Step 2: Run** `npx vitest run src/data src/physics` — Expected: FAIL.
- [ ] **Step 3: Implement** 배율 읽기·적용, 서버 생성 파일 다시 만들기.
- [ ] **Step 4: 맞추기** — `SIM_TRIALS=300 npx vitest run --config vitest.sim.config.ts sim/kinds.test.ts`로 벗어난 종을 찾고, `sim/sweep.test.ts`(`SWEEP_OUT=<파일>`, `kind` 인자를 더해)로 그 종의 배율을 찾아 `claw.json`에 적는다. 생김새는 고치지 않는다(spec §6). 끝으로 `SIM_TRIALS=1000`으로 `kinds.test.ts`(24종)·`odds.test.ts`·`scenes.test.ts` 전부 통과. 종마다 결과를 ledger와 README 확인 기록에 남긴다.
- [ ] **Step 5: Run** `cd server && uv run pytest -q && PYTHONPATH=src uv run lint-imports` — Expected: PASS.
- [ ] **Step 6: Commit** `feat: 인형 리뉴얼 — 종류별 집게 힘 배율로 24종 확률 맞춤`

---

### Task 13: 배포 준비 — 저장 키 v5·규약 5

**Files:**
- Modify: `server/src/toycrane/adapter/outbound/do_storage_machine_contents.py`, `server/src/toycrane/adapter/inbound/ws/schemas/server_messages.py`, `client/src/net/protocol.ts`, `shared/protocol_fixtures.json`
- Test: `server/tests/adapter/test_do_storage_machine_contents.py`, 규약 고정값 시험(클라이언트·서버 fixtures)

**Interfaces:**
- `KEY = "machines_v5"`, 읽기 순서 v5 → v4(모두 안 앉은 채: x·z·색·체형·표정·희귀·번호 유지, y None, 돌림 (0,0,0,1)) → v3(지금처럼). `PROTOCOL = 5`(서버·화면 둘 다).

- [ ] **Step 1: Write the failing tests** — 서버:

```python
# 인형 리뉴얼 설계 §5.3: v4(옛 모양으로 앉힌 자리)는 자리만 남기고 모두 안 앉은 인형으로 읽는다
async def test_v4_contents_are_read_as_unsettled_v5():
    v4 = '{"A-1": {"d": [["bunny", 0.12, 0.9, -0.05, 0.1, 0.2, 0.3, 0.9, 2, "n", 1, "", 1]], "n": 30.0, "u": 10}}'
    stocks = await DoStorageMachineContents(FakeStorage({"machines_v4": v4}), "s-v4", object()).load()
    d = stocks["A-1"].dolls[0]
    assert (d.uid, d.x, d.z, d.y, d.q, d.color, d.face) == (1, 0.12, -0.05, None, (0, 0, 0, 1), 2, 1)
```

`test_save_writes_thirteen_fields_and_v4_wins_over_v3`는 v5 이름으로 바꾼다. 화면: 규약 시험이 `PROTOCOL === 5`와 fixtures의 `v: 5`를 읽는다.

- [ ] **Step 2: Run** `cd server && uv run pytest -q` · `cd client && npx vitest run src/net` — Expected: FAIL.
- [ ] **Step 3: Implement** 키·읽기 순서·규약 번호·fixtures.
- [ ] **Step 4: Run** 서버·화면 전체 + `lint-imports` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: 인형 리뉴얼 — 저장 키 v5(옛 자리는 안 앉은 채로)·규약 5`

---

### Task 14: 성능·e2e·기록, 최종 리뷰 뒤 배포

- [ ] **Step 1:** `node client/e2e/perf.mjs <base> client/e2e/perf-plush.json` — 휴대폰 기계 앞 그리기 호출 ≤ 160, 물리 휴대폰 ≤ 1ms. 넘으면 lite 면 수·합치기를 고친다. 삼각형 수를 기록한다.
- [ ] **Step 2:** e2e 로컬: `play`, `watch`, `run`, `determinism`, `mobile-entry`, `mobile-joystick` 모두 PASS (헤드리스 크롬은 `--disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling`).
- [ ] **Step 3:** README 확인 기록에 7단계 인형 리뉴얼 줄(확률 종류별 요약, 그리기 호출·삼각형, e2e)을 더한다.
- [ ] **Step 4:** 전체 리뷰(가장 유능한 모델) → Critical/Important 한 번에 고치기.
- [ ] **Step 5:** 사용자에게 배포 허락을 묻는다(저장 상태 한 번 비움·탑 사라짐·옛 화면 새로 고침을 알린다). 허락 뒤 `cd server && CI=1 uv run pywrangler deploy`, 라이브 `play`·`run`·`determinism`, 기계 앞 스크린샷, README에 Version 기록.
