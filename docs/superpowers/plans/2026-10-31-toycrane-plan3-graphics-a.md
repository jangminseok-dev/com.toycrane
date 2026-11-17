# toycrane 3단계 — 그래픽 개편 (밝은 일본 게임센터 + 만화 고급화) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매장에 들어서면 밝은 대형 일본 게임센터에 온 것처럼 보이고, 기계 앞에서는 원색 기계·전구 간판·천 인형과, 인형 머리를 감싸 쥐는 집게가 아주 공들인 것처럼 보이며, 휴대폰에서도 지금처럼 부드럽다.

**Architecture:** 화면(`client/`)만 크게 바뀐다. 그림체는 지금처럼 툰 + 외곽선(`world/toon.ts`)이고, 시제품 `docs/reference/prototypes/spike-look-a.html`의 ① 모습과 잡기 방식을 지금 게임 크기·구조로 옮긴다. 정적인 것은 지금처럼 행·묶음별로 재질 단위로 합치고, 전구는 행마다 인스턴싱 한 덩어리로 그린다. 집게는 인형을 "닿는 공"(머리·몸통·주둥이 + 휘는 귀)으로 어림해서, 닿기 전까지만 내려가고 닿을 때까지만 오므린다. 서버는 "준비 중" 장식의 장애물(공용 배치 데이터)만 늘어나고 메시지 형식은 그대로다.

**Tech Stack:** 2단계와 같음 — TypeScript · Vite · three@0.169.0(`RoundedBoxGeometry`, `InstancedMesh`, `BufferGeometryUtils`) · vitest · Google Fonts(Jua, Gaegu — OFL) · Python 3.14 · pytest · Cloudflare Workers(정적 자산)

**Spec:** `docs/superpowers/specs/2026-10-31-toycrane-graphics-a-design.md` (이 문서가 바꾸는 원래 설계: `docs/superpowers/specs/2026-10-30-toycrane-design.md` §4.1·§4.2)

## 로드맵에서의 위치 (설계 §1.1, 2026-10-31 사용자 승인)

1. 함께 걷는 매장 — 완료
2. 코인 + 큰인형 기계 한 판 — 완료(사람 확인 대기), 집게 개편·계속 뽑기 포함
3. **그래픽 개편 (이 문서)**
4. 집게 기계 장치 — 버튼 두 개 조작, 몰아 넣기 보너스, 점원 도움(=근성 게이지), 응원(=리액션)
5. 구역마다 새 기계 — 피규어=막대 위 상자 밀기, 미니=캡슐 뽑기+고리 걸기, 허브=코인 밀기
6. 남은 예전 요소 — 피버, 더블 집기, 업고 다니기, 도감, 오늘의 기계, 자랑 카드

**이번에 하지 않는 것:** 피규어 기계·각진 캡슐 집게(설계 §3.5 — 5단계에서 만든다. 모양 기준은 시제품 "피규어 기계" 시점), 미니·피규어 구역의 진짜 기계(지금은 "준비 중" 장식), 사실적 렌더링(반사·빛 번짐).

## 실행 준비

- 2단계 브랜치 `plan2-coin-crane`이 아직 `main`에 합쳐지지 않았다. 이 계획은 그 위에서 시작한다: `git checkout plan2-coin-crane && git checkout -b plan3-graphics-a`. 2단계를 먼저 `main`에 합쳤으면 `main`에서 가른다.
- 로컬 확인: 서버 `cd server && uv run pywrangler dev --port 8787`, 화면은 `npm --prefix client run build` 뒤 8787에서 본다(정적 자산). 크롬 원격 디버깅 9461 포트(e2e 스크립트가 쓰는 것)가 떠 있어야 한다.

## Global Constraints

- 1·2단계 Global Constraints 그대로(무료만·유료 전환 금지, 헥사고날·슬라이스 1:1·import-linter, 결과는 서버가 정함, 오리지널 인형·상표명 금지).
- **일본어 글자 금지**: 간판·안내 카드·스티커·장식 어디에도 가나·한자(유니코드 `぀-ヿ`, `ㇰ-ㇿ`, `一-鿿`)를 쓰지 않는다. 한국어 + 짧은 영어 로고("toycrane", "NEW!")만.
- **그림체 ① 만화 고급화**: 툰 단계 칠 + 외곽선. `MeshStandardMaterial`/`MeshPhysicalMaterial`·환경맵·빛 번짐(bloom)·바닥 반사를 쓰지 않는다. 발광은 `MeshBasicMaterial` 밝은 색으로만.
- **크기·수치는 지금 게임 값**(설계 §4.7): 기계 1.2×1.05m, 집게 범위 ±0.44/0.38, 상품 구멍 (-0.36, 0.27), `CLAW_REST`(0.1, 1.95, 0), `DOLL_FLOOR` 0.87, `DOLL_SCALE` 0.3, 서버 `DOLL_H`/`DOLL_W`/`SINK`/`PART_RADII`는 바꾸지 않는다.
- **프로토콜(메시지 형식) 그대로.** 서버 쪽 변경은 공용 배치에 "준비 중" 장식 장애물을 더하는 것뿐(Task 10).
- **글꼴**: 간판 = Jua, 손글씨 카드 = Gaegu 700. 둘 다 Google Fonts에서 불러오고, 2.5초 안에 못 불러오면 `"Apple SD Gothic Neo", sans-serif`로 그린다(멈추지 않는다).
- **성능**: Task 1이 잰 지금 값 대비 새 걷기 시점·기계 앞 화면의 그리기 호출 수가 **1.5배 이하**(설계 §7, 준비 중 장식 포함).
- **잡기**(설계 §3.6): 집게 표본점이 인형 단단한 공(머리·몸통·주둥이·왕관) 안으로 들어가지 않는다. 귀는 휘어 밀린다. 오므림은 잡는 그 인형에 닿을 때까지만이다. 쥘 때 가로 4% 눌리고 8mm 떠받친다. 모든 모션은 시작·끝이 매끄러운 곡선(`ease.smooth`)이다.
- 시제품 값과 지금 게임 값이 다르면 **지금 게임 값**을 따르고, 모양·비율·색은 시제품을 따른다.

## Review Focus

1. **휴대폰 세로 화면 + 낮춘 카메라에서 섬 줄·탑이 캐릭터를 가린다** — 가리는 것만 흐려져 캐릭터가 늘 보여야 한다. (Task 4 `the island row fades when it hides the player from the aisle camera`)
2. **글꼴을 못 불러온다**(카톡 인앱·차단·오프라인) — 2.5초 뒤 시스템 글꼴로 그리고 입장이 막히지 않는다. (Task 2 `loadFonts gives up after the timeout`)
3. **집게가 빈 곳이나 키 큰 이웃 위로 내려간다** — 더 높은 이웃 머리에서 멈추고(파고들지 않음), 빈 곳이면 펠트 근처까지 내려가 끝까지 오므린다. (Task 8 `a taller neighbour stops the descent`, `an empty spot closes all the way`)
4. **희귀 인형(왕관)을 잡는다** — 허브가 왕관을 뚫고 머리에 얹히면 안 된다. (Task 6 `rare dolls add a crown to their hit spheres`, Task 8 planner가 같은 공을 쓴다)
5. **준비 중 장식이 길·줄 자리·기계 앞자리를 막는다** — 스폰에서 모든 기계 앞자리와 줄 자리까지 걸어갈 수 있어야 한다. (Task 10 `test_decor_keeps_every_spot_reachable`)

---

## 파일 구조 (새로 생기거나 바뀌는 것)

```
shared/store_layout.json            # (수정) "decor" 목록 + 그 상자들을 obstacles에 추가 (Task 10)
server/src/toycrane/domain/shared_data.py  # (생성 스크립트로 다시 만듦)
server/tests/domain/test_store_rules.py    # (수정) 장식이 길을 막지 않는지
client/index.html                   # (수정) Google Fonts 링크
client/e2e/perf.mjs                 # (새) 그리기 호출 수 재기
client/e2e/perf-baseline.json       # (새) 개편 전 값
client/src/ui/fonts.ts              # (새) 글꼴 불러오기(시간 제한)
client/src/world/copy.ts            # (새) 화면에 쓰는 간판·카드 문구 한 곳
client/src/world/signs.ts           # (새) 간판·안내 카드·스티커·뒷판·번호판·벽 간판·준비 중 그림 (machine.ts의 marqueeTex/plateTex 이동)
client/src/world/storeScene.ts      # (수정) 밝은 매장: 빛·대리석·흰 벽 띠·격자 천장 조명판·구역 색·탑 색
client/src/world/coinCounter.ts     # (수정) 밝은 색
client/src/game/followCamera.ts     # (수정) 천장 아래 통로 시점
client/src/world/machine.ts         # (수정) 새 기계 모양 + 전구 자리
client/src/world/bigZone.ts         # (수정) 행마다 전구 인스턴싱·돌아가며 깜빡임, 인형 자세는 dollPose
client/src/world/dolls.ts           # (수정) 천 인형 비율, HEAD·dollHits·귀 표시
client/src/world/dollPose.ts        # (새) 머리 기준 인형 자세, 기계 안 닿는 공
client/src/game/aim.ts              # (수정) dolls.ts의 HEAD 사용
client/src/world/claw.ts            # (수정) 감싸는 세 마디 손가락·가는 허브·표본점
client/src/game/gripPlan.ts         # (새) 내려갈 높이·오므릴 정도 미리 재기
client/src/world/softEars.ts        # (새) 손가락에 닿은 귀 휘기
client/src/world/clawShow.ts        # (수정) 잡기 계획·눌림·떠받침·부드러운 단계
client/src/game/tween.ts            # (수정) ease.smooth
client/src/game/swing.ts            # (수정) 더 부드럽게 오래 출렁
client/src/world/motions.ts         # (수정) 기본 곡선 smooth
client/src/world/decor.ts           # (새) "준비 중" 덮개 기계·경품 진열장
client/src/main.ts                  # (수정) 글꼴 기다리기, 그리기 수 고리, 장식 가림막
```

---

### Task 1: 개편 전 성능 기준 재기

**Files:**
- Modify: `client/src/main.ts` (renderer 만든 직후)
- Create: `client/e2e/perf.mjs`, `client/e2e/perf-baseline.json`

**Interfaces:**
- Produces: `window.__toycrane.drawCalls(): number`, `window.__toycrane.triangles(): number` (마지막으로 그린 화면의 `renderer.info.render`). `node client/e2e/perf.mjs <base> <out.json>` → `{ "walk_pc": n, "machine_pc": n, "walk_phone": n, "machine_phone": n }` (각 30프레임 평균 그리기 호출 수, 삼각형 수는 `*_tri` 키로 함께).

- [ ] **Step 1: 고리 달기** — `main.ts`에 `Object.assign(window, { __toycrane: { drawCalls: () => renderer.info.render.calls, triangles: () => renderer.info.render.triangles } })`.
- [ ] **Step 2: `perf.mjs` 작성** — `client/e2e/shot.mjs`와 같은 CDP 방식(9461)이다. 화면은 PC(1280×800)와 휴대폰(390×844, mobile)이다. 각각 이렇게 잰다:
  - 입장 후 3초 뒤 스폰 자리에서 30프레임을 잰다 → `walk_*`
  - 교환소 줄에서 코인을 받는다 → C-6 앞자리 (0, -5.4)로 걸어간다(위치는 관찰자 웹소켓의 내 `move`로 맞춘다) → "🪙1 넣고 하기" → 집게를 움직이는 동안 30프레임을 잰다 → `machine_*`
- [ ] **Step 3: 지금 코드로 재고 저장** — `npm --prefix client run build`, 로컬 서버 8787에서 `node client/e2e/perf.mjs http://localhost:8787 client/e2e/perf-baseline.json`.
  Expected: 네 값이 모두 0보다 크다. 파일을 그대로 커밋한다.
- [ ] **Step 4: Commit** — `git add client/src/main.ts client/e2e/perf.mjs client/e2e/perf-baseline.json && git commit -m "chore: 그래픽 개편 전 그리기 호출 수 기준"`

### Task 2: 글꼴과 간판 글자

**Files:**
- Modify: `client/index.html`, `client/src/main.ts`, `client/src/world/machine.ts` (marqueeTex·plateTex를 signs.ts로 옮기고 import만 바꿈)
- Create: `client/src/ui/fonts.ts`, `client/src/ui/fonts.test.ts`, `client/src/world/copy.ts`, `client/src/world/copy.test.ts`, `client/src/world/signs.ts`

**Interfaces:**
- Produces:
  - `loadFonts(sample: string, timeoutMs = 2500): Promise<boolean>`. 둘 다 불러오면 `true`, 시간 초과·`document.fonts` 없음·오류면 `false`. 절대 reject하지 않는다.
  - `copy.ts`:
    - `MACHINE_NAMES: string[]` (지금 machine.ts의 13개)
    - `POP_CARDS = ['NEW!', '잘 뽑혀요♪', '대형!', '인기 1위', '한정', '신상']`
    - `STICKER = '1회 🪙1'`, `WALL_SIGN = ['toycrane', '게임센터']`, `PREP = '준비 중'`
    - `ALL_COPY: string` (위 전부를 이은 것, 글꼴 표본용)
  - `signs.ts`(모두 `THREE.CanvasTexture`):
    - `signTex(text, color)`: 간판. 그라데이션 + 별 + 흰 테두리 + Jua.
    - `popTex(text, bg, fg)`: 안내 카드. 점선 테두리 + Gaegu 700 + 별, 둥근 모서리 밖은 투명.
    - `stickerTex()`, `backArtTex(c1, c2)`: 뒷판(파스텔 하늘·구름·하트/별/점).
    - `plateTex(id)`, `wallSignTex()`, `prepTex()`.
    - 그림은 시제품 `spike-look-a.html`의 `signTex`/`popTex`/`stickerT`/`backArt`/`plateT`/`wallSignT`를 따른다.

- [ ] **Step 1: 실패하는 테스트**

```ts
// client/src/world/copy.test.ts
const JP = /[぀-ヿㇰ-ㇿ一-鿿]/;
test('on-screen copy has no Japanese characters', () => {
  for (const s of [...MACHINE_NAMES, ...POP_CARDS, STICKER, ...WALL_SIGN, PREP]) expect(JP.test(s)).toBe(false);
});
// client/src/ui/fonts.test.ts (vi.useFakeTimers, document.fonts를 바꿔 끼움)
test('loadFonts gives up after the timeout', async () => {
  stubFonts(() => new Promise(() => {}));           // 영원히 안 끝남
  const p = loadFonts('가', 2500); await vi.advanceTimersByTimeAsync(2600);
  await expect(p).resolves.toBe(false);
});
test('loadFonts reports success when both faces load', async () => {
  stubFonts(() => Promise.resolve([{}]));
  await expect(loadFonts('가')).resolves.toBe(true);
});
test('loadFonts copes without a font API', async () => {
  stubFonts(undefined);
  await expect(loadFonts('가')).resolves.toBe(false);
});
```

- [ ] **Step 2: 실패 확인** — `npm --prefix client test -- copy fonts` → FAIL(모듈 없음).
- [ ] **Step 3: 구현** — 아래를 만든다.
  - `fonts.ts`: `Promise.race`(`document.fonts.load('80px Jua', sample)`·`document.fonts.load('700 80px Gaegu', sample)` vs 타이머).
  - `copy.ts`, `signs.ts`.
  - `index.html` `<head>`에 Google Fonts 링크: `preconnect` 2개 + `css2?family=Gaegu:wght@700&family=Jua&display=swap`.
  - `main.ts` 맨 위 무대 만들기 전에 `await loadFonts(ALL_COPY)`.
- [ ] **Step 4: 통과 확인** — `npm --prefix client test` 전체 PASS, `npm --prefix client run build` OK.
- [ ] **Step 5: Commit** — `feat: 간판 글꼴(Jua·Gaegu)과 화면 문구 한 곳 — 일본어 글자 검사`

### Task 3: 밝은 매장 (빛·대리석·벽·천장·허브)

**Files:**
- Modify: `client/src/world/storeScene.ts`, `client/src/world/coinCounter.ts`, `client/src/main.ts`(body 배경색)
- Create: `client/src/world/storeScene.test.ts`

**Interfaces:**
- Consumes: `wallSignTex()` (Task 2)
- Produces: `buildStore(scene): HubTower`(모양 그대로)

- [ ] **Step 1: 실패하는 테스트**

```ts
test('the bright store uses one sun and a sky light, no coloured point lights', () => {
  const scene = new THREE.Scene(); buildStore(scene);
  const lights = scene.children.filter((o) => (o as THREE.Light).isLight);
  expect(lights.filter((l) => (l as THREE.PointLight).isPointLight)).toHaveLength(0);
  expect(lights.filter((l) => (l as THREE.DirectionalLight).isDirectionalLight)).toHaveLength(1);
});
test('ceiling light panels are one merged mesh under the ceiling', () => {
  const scene = new THREE.Scene(); buildStore(scene);
  const panels = scene.getObjectByName('ceiling-lights') as THREE.Mesh;
  expect(panels.position.y + panels.geometry.boundingBox!.max.y).toBeLessThan(ROOM_HEIGHT);
  expect(panels.geometry.attributes.position.count).toBeGreaterThan(100 * 4);
});
test('the store stays a handful of draw calls', () => {
  const scene = new THREE.Scene(); buildStore(scene);
  let n = 0; scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.visible) n++; });
  expect(n).toBeLessThanOrEqual(40);
});
```

- [ ] **Step 2: 실패 확인** — `npm --prefix client test -- storeScene` → FAIL(분홍 점광 5개, ceiling-lights 없음).
- [ ] **Step 3: 구현** (값은 시제품 기준)
  - 배경·안개 `0xf4f1f7`.
  - 빛: `HemisphereLight(0xffffff, 0xeee6f2, 1.25)` + `DirectionalLight(0xffffff, 1.7)` 그림자 하나. 분홍 점광과 벽 네온 줄은 지운다.
  - 바닥: 큰 판(1.2m) 밝은 회백색 대리석. 시제품 `tilesT`처럼 판마다 밝기 차, 회색 결 곡선, 가는 줄눈. `toonWith({ map })`.
  - 벽: 흰 바탕에 분홍·노랑·하늘 띠와 별(시제품 `sideWallT`). 북쪽 벽(z=-13) 위쪽 1m 띠에 `wallSignTex()`를 줄지어 붙인다.
  - 천장: 흰 격자 그림, 2m 간격 조명판(0.9×0.42, `MeshBasicMaterial` 흰색). 판 전부를 한 덩어리 `ceiling-lights`로 합친다.
  - 구역 바닥 색: 큰인형 분홍 0.08, 미니 연보라 0.1, 피규어 하늘 0.1, 허브 노랑 0.06. 바닥 글씨 `rgba(80,60,100,.25)`.
  - 4면 전광판 탑과 교환소: 몸통 흰색, 강조는 빨강·노랑. 스폰 링은 분홍.
  - body 배경 `#f4f1f7`.
- [ ] **Step 4: 통과 확인** — `npm --prefix client test` PASS. 빌드 후 PC 스크린샷 한 장(`client/e2e/shot.mjs`)으로 밝은 매장인지 본다. 아바타가 하얗게 날아가 보이면 `avatar.ts` 색만 한 단계 진하게 한다.
- [ ] **Step 5: Commit** — `feat: 밝은 일본 게임센터 매장 — 대리석·흰 벽 띠·격자 천장 조명`

### Task 4: 천장 아래 통로 시점 카메라

**Files:**
- Modify: `client/src/game/followCamera.ts`, `client/src/main.ts`(처음 카메라 자리)
- Create: `client/src/game/followCamera.test.ts`
- Test: `client/src/game/occlusion.test.ts`(있으면 추가, 없으면 새로)

**Interfaces:**
- Produces:
  - `followCamera(camera, at, dt)`: 같은 신호. 가로 화면 오프셋 `WIDE = (0, 2.6, 4.4)`, 세로 `TALL = (0, 2.95, 5.6)`. 바라보는 점은 `(at.x, 1.1, at.z - 1.6)`.
  - `export const CAMERA_OFFSETS = { WIDE, TALL }`(테스트·성능 측정용).

- [ ] **Step 1: 실패하는 테스트**

```ts
for (const aspect of [16 / 9, 9 / 19.5]) test(`aisle camera stays under the ceiling (aspect ${aspect.toFixed(2)})`, () => {
  const cam = new THREE.PerspectiveCamera(50, aspect);
  for (let i = 0; i < 120; i++) followCamera(cam, { x: 1, z: -3 }, 0.1);
  expect(cam.position.y).toBeLessThanOrEqual(ROOM_HEIGHT - 0.4);
  expect(cam.position.z - -3).toBeGreaterThanOrEqual(3.5);
  const dir = cam.getWorldDirection(new THREE.Vector3());
  expect(dir.z).toBeLessThan(0); expect(dir.y).toBeLessThan(0);
});
test('the island row fades when it hides the player from the aisle camera', () => {
  const island = new THREE.Box3(new THREE.Vector3(-9.9, 0, -8.4), new THREE.Vector3(9.9, 2.7, -5.75));
  let opacity = 1; const fader = new OcclusionFader([{ box: island, setOpacity: (o) => { opacity = o; } }]);
  const at = { x: 0, z: -10 };
  const eye = new THREE.Vector3(at.x, 0, at.z).add(CAMERA_OFFSETS.WIDE);
  for (let i = 0; i < 30; i++) fader.update(0.05, eye, at);
  expect(opacity).toBeLessThan(0.5);
});
```

- [ ] **Step 2: 실패 확인** — FAIL(y=7, CAMERA_OFFSETS 없음).
- [ ] **Step 3: 구현** — 오프셋·바라보는 점을 바꾸고 `CAMERA_OFFSETS`를 내보낸다. `main.ts`의 처음 `camera.position`을 스폰 + `WIDE`로 맞춘다. 세로 화면 fov 60은 지금 그대로.
- [ ] **Step 4: 통과 확인** — `npm --prefix client test` PASS. 기존 e2e `client/e2e/mobile-joystick.mjs`가 그대로 통과한다(조이스틱 위 = 화면 위 = -z).
- [ ] **Step 5: Commit** — `feat: 걷기 카메라를 천장 아래 통로 시점으로`

### Task 5: 큰인형 기계 새 모양 + 돌아가는 전구

**Files:**
- Modify: `client/src/world/machine.ts`, `client/src/world/bigZone.ts`, `client/src/world/bigZone.test.ts`
- Create: `client/src/world/machine.test.ts`

**Interfaces:**
- Consumes: `signTex`, `popTex`, `stickerTex`, `backArtTex`, `plateTex`, `MACHINE_NAMES`, `POP_CARDS` (Task 2)
- Produces:
  - `MACHINE_COLORS = [0xe8384f, 0xffb81f, 0x2f7cf6, 0xff4f9a, 0x22b36b, 0x8b5cf6, 0xff8a1f, 0x12b5cb]`, `FELT_COLORS = [0x8fd3ff, 0xff9ec7, 0xffe08a, 0xb7e4a8]`.
  - `makeMachineParts(spot, index): MachineParts`(신호 그대로). 캐비닛 메시 이름은 `'cabinet'`, 몸통 색은 `MACHINE_COLORS[index % 8]`.
  - `bulbSpots(): THREE.Vector3[]`: 기계 안 좌표의 간판 둘레 전구 자리. 간격 0.05, 간판 앞면 z보다 앞.
  - `CLAW_REST`·`DOLL_FLOOR`·`DOLL_SCALE`은 그대로 낸다.
  - BigZone: 신호 그대로. 행마다 `InstancedMesh` 하나(이름 `bulbs-${행 그룹 이름}`, 예: `bulbs-big-island`)에 전구를 모은다. 재질은 행 복제라 흐려짐도 따라간다. `update(t)`에서 `(i + floor(t·8)) % 3 === 0`인 전구는 어둡게(`0xfff0b0`×0.55), 나머지는 밝게(×1.8) 한다. `flash(id, gold, s)` 동안 그 기계 전구는 분홍·금색으로 깜빡인다.

- [ ] **Step 1: 실패하는 테스트**

```ts
// machine.test.ts
test('each machine body takes its colour from the palette', () => {
  const parts = makeMachineParts(MACHINES[3], 3);
  const cab = parts.statics.getObjectByName('cabinet') as THREE.Mesh;
  expect((cab.material as THREE.MeshToonMaterial).color.getHex()).toBe(MACHINE_COLORS[3]);
});
test('the old chequered flags are gone', () => {
  for (let i = 0; i < 4; i++) expect(makeMachineParts(MACHINES[i], i).statics.getObjectByName('flag')).toBeUndefined();
});
test('bulbs ring the marquee', () => {
  const spots = bulbSpots();
  expect(spots.length).toBeGreaterThanOrEqual(30); expect(spots.length).toBeLessThanOrEqual(60);
});
test('six machines bake into a small number of materials', () => {
  const g = new THREE.Group(); for (let i = 0; i < 6; i++) g.add(makeMachineParts(MACHINES[i], i).statics);
  expect(bakeByMaterial(g).length).toBeLessThanOrEqual(24);
});
// bigZone.test.ts
test('marquee bulbs chase around over time', () => {
  const scene = new THREE.Scene(); const zone = buildBigZone(scene);
  const bulbs = scene.getObjectByName('bulbs-big-island') as THREE.InstancedMesh;
  zone.update(0); const a = bulbs.instanceColor!.array.slice();
  zone.update(0.2); expect(bulbs.instanceColor!.array).not.toEqual(a);
});
```

- [ ] **Step 2: 실패 확인** — FAIL(`MACHINE_COLORS`·`bulbSpots`·`bulbs-*` 없음, 깃발 있음).
- [ ] **Step 3: 구현** — 설계 §4.1을 지금 크기(1.2×1.05, 캐비닛 높이 0.85, 유리 칸 0.86~1.96, 간판 1.96~2.46)에 옮긴다. 모서리는 `RoundedBoxGeometry`, 외곽선은 `part()`를 쓴다. 들어갈 것:
  - 원색 캐비닛 + 흰 앞판
  - 상품 출구: 검정 + 분홍 LED 테두리 + 투명 덮개
  - 크롬 코인 투입구 + 빛나는 슬롯 + 스티커, 바닥 하늘색 LED 띠
  - 흰 조작대: 레버(크롬 받침 + 빨간 공) + 버튼 2개(빨강·파랑, 크롬 고리)
  - 크롬 기둥 4개 + 앞 기둥 LED 줄
  - 기계마다 펠트 색, 뒷판 그림
  - 상품 구멍 + 투명 가림막 + 크롬 테두리
  - 천장 조명판, 앞·뒤 레일
  - 앞·옆 유리 + 만화식 대각 반사 줄 2개
  - 안내 카드(`POP_CARDS[index % 6]`, 앞 유리 안 오른쪽 위, -0.12 기울임)
  - 몸통 색 간판 상자 + 이름판 + 번호판

  LED 띠·테두리는 지금처럼 기계마다 꼭짓점 색 한 덩어리(`ledGeo`)로 둔다. 전구만 행 인스턴싱으로 옮긴다. 깃발은 뺀다.
- [ ] **Step 4: 통과 확인** — `npm --prefix client test` 전체 PASS(기존 bigZone 테스트 포함). 빌드 후 C-6 기계 앞 스크린샷을 시제품 ①과 비교한다.
- [ ] **Step 5: Commit** — `feat: 큰인형 기계 새 모양 — 원색 몸통·레버와 버튼 둘·안내 카드·돌아가는 간판 전구`

### Task 6: 천 인형 다듬기 + 닿는 공

**Files:**
- Modify: `client/src/world/dolls.ts`, `client/src/world/dolls.test.ts`, `client/src/game/aim.ts`, `client/src/game/aim.test.ts`

**Interfaces:**
- Produces:
  - `HEAD = { standing: { c: 0.74, r: 0.35 }, round: { c: 0.5, r: 0.48 } }`(인형 모양 좌표, 크기 1)와 `headOf(id): { c: number; r: number }`.
  - `type Hit = { c: THREE.Vector3; r: number }`, `dollHits(id): { solid: Hit[]; ears: Hit[] }`(인형 모양 좌표).
    - 서 있는 형: 몸통 `(0,0.3,0) r0.29`, 머리 `(0,0.74,0) r0.34`, 주둥이 `(0,0.66,0.29) r0.1`.
    - 동글이형: 몸통 `(0,0.5,0) r0.47`(문어는 `(0,0.62,0) r0.43`).
    - 희귀: 왕관 `(0, 머리 꼭대기+0.06, 0) r0.15`.
    - 귀(휘는 부분):
      - 곰·판다·너구리: `(±0.27,1.0,-0.02) r0.12`
      - 토끼: `(±0.14,1.12,-0.02)`와 `(±0.15,1.32,-0.02)`, 둘 다 r0.08
      - 고양이·여우·다람쥐: `(±0.21,1.03,0) r0.1`
  - 귀 메시는 `name = 'ear'`이고 `userData.ear = { c, r, out }`을 단다. `out`은 바깥 위쪽 단위 벡터 `(±1, 0.5, 0)` 정규화.
  - `aimHeight`는 `headOf(id)`를 쓴다(로컬 `STANDING`/`ROUND` 삭제).

- [ ] **Step 1: 실패하는 테스트**

```ts
test('the head hit sphere matches the model head top', () => {
  for (const id of Object.keys(DOLLS)) {
    const top = headTopOf(makeDoll(id)!);              // 'ear'·'crown'·반짝이를 뺀 메시 경계 상자의 max.y
    const head = dollHits(id).solid.reduce((a, h) => (h.c.y + h.r > a.c.y + a.r ? h : a));
    expect(Math.abs(head.c.y + head.r - top)).toBeLessThan(0.08);
  }
});
test('standing dolls have a big plush head', () => {
  const [body, head] = dollHits('bear').solid; expect(head.r).toBeGreaterThan(body.r);
});
test('bear ears are soft parts the claw can bend', () => {
  const ears = makeDoll('bear')!.children.filter((o) => o.name === 'ear');
  expect(ears).toHaveLength(2); expect(ears[0].userData.ear.r).toBeCloseTo(0.12);
});
test('rare dolls add a crown to their hit spheres', () => {
  const top = (id: string) => Math.max(...dollHits(id).solid.map((h) => h.c.y + h.r));
  expect(top('starbunny')).toBeGreaterThan(top('bunny') + 0.1);
});
```

- [ ] **Step 2: 실패 확인** — FAIL(`dollHits`·`HEAD` 없음).
- [ ] **Step 3: 구현** — 서 있는 형을 시제품 천 인형 비율로 바꾼다(인형 모양 좌표). 머리 꼭대기 1.07은 `DOLL_H/DOLL_SCALE` 1.13 안에 든다.
  - 몸통 `(0.3,0.29,0.27)` @y0.3
  - 배 패치(밝은 색) `(0.2,0.21,0.1)` @(0,0.28,0.17)
  - 머리 `(0.36,0.33,0.34)` @y0.74
  - 주둥이 `(0.14,0.1,0.09)` @(0,0.66,0.29)
  - 반짝이 눈 @y0.76 z0.3, 볼터치
  - 팔 `0.11` @(±0.3,0.36,0.07), 다리 `(0.12,0.08,0.15)` @(±0.14,0.06,0.13)
  - 옆구리 품질 택(흰 판 0.06×0.09) @(0.28,0.16,-0.06)
  - 귀 자리는 새 머리에 맞춘다.

  동글이형은 모양을 그대로 두고 배 패치(없는 것만)와 택을 더한다. `lite`는 지금처럼 잔부품을 뺀다(택·배 패치도 뺀다).
- [ ] **Step 4: 통과 확인** — `npm --prefix client test` PASS(aim 테스트는 새 HEAD 값으로 기대값만 고친다).
- [ ] **Step 5: Commit** — `feat: 천 인형 비율(큰 머리·배 패치·택)과 집게가 닿는 공`

### Task 7: 머리 기준 인형 자세

설계 §4.8: 서버는 인형 자리(x,z)에서 평면 거리로 부위를 고른다. 화면은 위층 인형을 기울여서 머리가 최대 10cm 벗어난다. 그래서 인형을 **머리 가운데가 (x,z) 위에 오도록** 놓는다. 이렇게 하면 서버는 그대로 두고 "머리 판정 = 화면에서 머리"가 된다.

**Files:**
- Create: `client/src/world/dollPose.ts`, `client/src/world/dollPose.test.ts`
- Modify: `client/src/world/bigZone.ts`(rebuild), `client/src/world/clawShow.ts`(pickUp·fallAndRoll의 `tiltOf` 대신)

**Interfaces:**
- Consumes: `headOf`, `dollHits` (Task 6)
- Produces:
  - `dollPose(spot: DollSpot): { position: THREE.Vector3; quaternion: THREE.Quaternion }`(기계 안 좌표)
    - 기울기 Euler(XYZ)는 지금과 같다: `(sin(3r)·0.25 + (y>0 ? 0.3 : 0), r, cos(5r)·0.25)`.
    - 바닥 높이 = `DOLL_FLOOR + y`.
    - 가로 자리 = `(x, z) − 가로(q·(0, headOf(id).c·DOLL_SCALE, 0))`.
  - `solidsOf(spots: DollSpot[]): Hit[][]`: 인형마다 단단한 공. 기계 안 좌표, 미터 단위(자세 + `DOLL_SCALE` 적용).
  - `earsOf(spots): Hit[][]`도 같은 방식으로 낸다.

- [ ] **Step 1: 실패하는 테스트**

```ts
test('a leaning stacked doll keeps its head right above its spot', () => {
  const spot: DollSpot = ['bear', 0.12, -0.08, 2.1, 0.2];
  const { position, quaternion } = dollPose(spot);
  const head = new THREE.Vector3(0, HEAD.standing.c * DOLL_SCALE, 0).applyQuaternion(quaternion).add(position);
  expect(head.x).toBeCloseTo(0.12, 6); expect(head.z).toBeCloseTo(-0.08, 6);
  expect(position.y).toBeCloseTo(DOLL_FLOOR + 0.2, 6);
});
test('solid spheres sit where the doll is drawn', () => {
  const [[, head]] = solidsOf([['bear', 0.1, 0.05, 0.4, 0]]);
  expect(head.c.x).toBeCloseTo(0.1, 6); expect(head.c.z).toBeCloseTo(0.05, 6);
});
```

- [ ] **Step 2: 실패 확인** — FAIL(모듈 없음).
- [ ] **Step 3: 구현** — `dollPose`를 만들고 `bigZone.rebuild`와 `clawShow`가 쓰게 한다. `rebuild`는 행렬 합성에 `dollPose` 결과를 쓴다. `clawShow`의 `tiltOf`는 지운다.
- [ ] **Step 4: 통과 확인** — `npm --prefix client test` PASS(`dolls are drawn at their resting height` 포함).
- [ ] **Step 5: Commit** — `feat: 인형을 머리 기준으로 놓아 서버 부위 판정과 화면을 맞춤`

### Task 8: 머리를 감싸 쥐는 집게

**Files:**
- Modify: `client/src/world/claw.ts`, `client/src/world/claw.test.ts`, `client/src/world/clawShow.ts`
- Create: `client/src/game/gripPlan.ts`, `client/src/game/gripPlan.test.ts`, `client/src/world/softEars.ts`, `client/src/world/softEars.test.ts`

**Interfaces:**
- Consumes: `solidsOf`, `dollPose` (Task 7), `HEAD` (Task 6)
- Produces:
  - `ClawRig`(claw.ts)에 더할 것: `probes: THREE.Object3D[]`(허브 바닥·가장자리, 칼라 둘레, 손가락 마디마다 4점), `fingerProbes: THREE.Object3D[]`, `HUG: number`(손가락 각 0이 되는 `setOpen` 값).
  - `setOpen(t)`: 경첩 각을 `lerp(-0.3, 0.38, t)`로 둔다(바깥이 +). 기존 `root/swing/grip/tips/setCable`은 그대로.
  - 손가락은 경첩(허브 둘레 반지름 0.034) 기준 세 마디다(바깥, 아래, m):
    - `(0,0) → (0.09,-0.045) → (0.095,-0.18) → (0.038,-0.24)`
    - 허브는 반지름 0.024, 바닥이 몸통 원점에서 -0.08이다.
    - `HUG` 자세가 서 있는 인형 머리(반지름 `0.36·DOLL_SCALE`)를 5mm 띄워 감싸는 모양이다.
  - `planGrip(rig, claw: THREE.Object3D, anchor: THREE.Object3D, solids: Hit[][], target: number | null): { y: number; open: number }`
    - `claw.position.y`를 `CLAW_REST.y`부터 3mm씩 내린다. 활짝(1) 상태에서 표본점이 어느 공에든 4mm 안으로 들어오기 직전 높이에서 멈춘다. 허브 바닥은 `DOLL_FLOOR + 0.02`보다 내려가지 않는다.
    - 그 높이에서 `open`을 1부터 0.01씩 줄인다. 손가락 표본점이 `target` 인형 공에만 2mm 안으로 들어오기 직전 값이 `open`이다. `target`이 null이면 0이다.
    - 끝나면 rig 상태를 되돌린다.
  - `bendEars(doll: THREE.Object3D, probes: THREE.Object3D[], dt: number): void`: `'ear'` 메시를 겹친 깊이×1.4(최대 0.05/`DOLL_SCALE`)만큼 `out` 쪽으로 밀고 살짝 기울인다. 따라가는 속도는 `dt·14`이고, 닿지 않으면 제자리로 돌아온다.

- [ ] **Step 1: 실패하는 테스트**

```ts
// gripPlan.test.ts — 기계 하나를 흉내: anchor(원점) ⊃ claw(CLAW_REST) ⊃ rig.root
const inside = (rig: ClawRig, anchor: THREE.Object3D, hits: Hit[], margin: number) => rig.probes.some((p) => {
  const w = anchor.worldToLocal(p.getWorldPosition(new THREE.Vector3())); return hits.some((h) => w.distanceTo(h.c) < h.r + margin);
});
test('the claw stops on the head without sinking in', () => {
  const { rig, claw, anchor } = machineWithClaw(0, 0);
  const solids = solidsOf([['bear', 0, 0, 0, 0]]);
  const plan = planGrip(rig, claw, anchor, solids, 0);
  claw.position.y = plan.y; rig.setOpen(1); anchor.updateMatrixWorld(true);
  expect(inside(rig, anchor, solids[0], 0.003)).toBe(false);
  const headTop = solids[0][1].c.y + solids[0][1].r;
  expect(hubBottomY(rig, anchor) - headTop).toBeLessThan(0.015);
});
test('fingers close until they wrap the head, tips under its middle', () => {
  const { rig, claw, anchor } = machineWithClaw(0, 0);
  const solids = solidsOf([['bear', 0, 0, 0, 0]]);
  const plan = planGrip(rig, claw, anchor, solids, 0);
  claw.position.y = plan.y; rig.setOpen(plan.open); anchor.updateMatrixWorld(true);
  expect(plan.open).toBeLessThan(0.75);
  expect(tipsY(rig, anchor)).toBeLessThan(solids[0][1].c.y);          // 끝이 머리 가운데보다 아래
  rig.setOpen(plan.open - 0.03); anchor.updateMatrixWorld(true);
  expect(inside(rig, anchor, solids[0], 0.002)).toBe(true);           // 더 오므리면 닿는다
});
test('an empty spot closes all the way', () => {
  const { rig, claw, anchor } = machineWithClaw(0, 0);
  const plan = planGrip(rig, claw, anchor, [], null);
  expect(plan.open).toBe(0); expect(plan.y).toBeLessThan(DOLL_FLOOR + 0.35);
});
test('a taller neighbour stops the descent', () => {
  const { rig, claw, anchor } = machineWithClaw(0, 0);
  const low = planGrip(rig, claw, anchor, solidsOf([['bear', 0, 0, 0, 0]]), 0).y;
  const high = planGrip(rig, claw, anchor, solidsOf([['bear', 0, 0, 0, 0], ['bear', 0.04, 0.02, 0, 0.2]]), 0).y;
  expect(high).toBeGreaterThan(low + 0.1);
});
test('a neighbour beside the target does not stop the fingers', () => {
  const { rig, claw, anchor } = machineWithClaw(0, 0);
  const alone = planGrip(rig, claw, anchor, solidsOf([['bear', 0, 0, 0, 0]]), 0).open;
  const crowded = planGrip(rig, claw, anchor, solidsOf([['bear', 0, 0, 0, 0], ['cat', 0.3, 0, 0, 0]]), 0).open;
  expect(crowded).toBeCloseTo(alone, 2);
});
// softEars.test.ts
test('an ear touched by a finger bends outward and springs back', () => {
  const bear = makeDoll('bear')!; const ear = bear.children.find((o) => o.name === 'ear')!;
  const base = ear.position.clone(); const probe = new THREE.Object3D();
  probe.position.copy(ear.position); bear.add(probe); bear.updateMatrixWorld(true);
  for (let i = 0; i < 30; i++) bendEars(bear, [probe], 1 / 60);
  expect(ear.position.distanceTo(base)).toBeGreaterThan(0.02);
  for (let i = 0; i < 90; i++) bendEars(bear, [], 1 / 60);
  expect(ear.position.distanceTo(base)).toBeLessThan(0.002);
});
```

테스트 파일 안 헬퍼:
- `machineWithClaw(x, z)`: `anchor`(원점 Group) ⊃ `claw`(Group, 위치 `(x, CLAW_REST.y, z)`) ⊃ `rig.root`, `rig = makeClawRig()`.
- `hubBottomY(rig, anchor)`: 허브 바닥 가운데 표본점의 anchor 좌표 y.
- `tipsY(rig, anchor)`: 손가락 맨 끝 표본점 3개 중 가장 높은 y.

- [ ] **Step 2: 실패 확인** — `npm --prefix client test -- gripPlan softEars claw` → FAIL.
- [ ] **Step 3: 구현** — claw.ts 손가락·허브·표본점을 만들고, `gripPlan.ts`·`softEars.ts`를 만든다.
  - 칠은 설계 §4.3대로 크롬 몸통·손가락, 분홍 칼라, 분홍 손가락 끝이다.
  - 쉬는 기계 34대가 쓰는 `idleClawGeometry()`도 새 손가락 모양(쉬는 벌림 0.35)으로 다시 만든다. `clawShow.ts`의 단계는 아래와 같다(곡선은 Task 9의 `ease.smooth`, 오므림만 `ease.out`):
  1. 옮겨 가며 벌리기
  2. 1.2초 동안 `plan.y`까지 내려감(`lowY`·`CLAW_REACH·0.62` 계산은 지운다)
  3. 0.7초 동안 `plan.open`까지 오므림. 오므림 뒤쪽 절반에서 인형이 가로 -4%·세로 +3%로 눌리고 8mm 떠오른다.
  4. 매단다(지금 `hangDown` 유지).
  5. 1.4초 동안 들어 올림. 눌림은 처음 40% 동안 풀린다.
  6. 결과별 갈래(성공 옮기기, 놓침 75%에서 떨어져 구름, 헛잡음 미끄러짐)는 지금 그대로다.

  집은 인형에는 연출 내내 매 프레임 `bendEars(doll, rig.probes, dt)`를 부른다. 이웃 인형까지 넣은 `solidsOf(before)`로 내려갈 높이를 재고, 오므림은 `target = m.i`로 잰다.
- [ ] **Step 4: 통과 확인** — `npm --prefix client test` 전체 PASS.
- [ ] **Step 5: Commit** — `feat: 집게가 인형 머리를 감싸 쥠 — 닿을 때까지만 내려가고 오므리기·귀 휨·말랑 눌림`

### Task 9: 모든 모션을 부드럽게

**Files:**
- Modify: `client/src/game/tween.ts`, `client/src/game/tween.test.ts`, `client/src/game/swing.ts`, `client/src/game/swing.test.ts`, `client/src/world/motions.ts`, `client/src/game/clawPath.ts`

**Interfaces:**
- Produces:
  - `ease.smooth(k) = k³(k(6k−15)+10)`
  - `Tweens.tween`의 기본 곡선을 `ease.smooth`로 바꾼다.
  - `Swing`의 스프링을 `K 32 → 22`, `C 2.4 → 2.0`으로 바꿔 더 오래 부드럽게 출렁이게 한다.
  - 캐릭터 `pose()` 기본 곡선도 `ease.smooth`로 바꾼다.

- [ ] **Step 1: 실패하는 테스트**

```ts
test('smooth ease starts and ends with zero speed', () => {
  expect(ease.smooth(0)).toBe(0); expect(ease.smooth(1)).toBe(1); expect(ease.smooth(0.5)).toBeCloseTo(0.5);
  const slope = (k: number) => (ease.smooth(k + 1e-4) - ease.smooth(k)) / 1e-4;
  expect(slope(0)).toBeLessThan(1e-3); expect(slope(1 - 1e-4)).toBeLessThan(1e-3);
});
test('a swing keeps rocking a little longer before it settles', () => {
  const s = new Swing(); for (let i = 0; i < 12; i++) s.update(1 / 60, 3, 0);
  for (let i = 0; i < 60; i++) s.update(1 / 60, 0, 0);
  expect(Math.abs(s.tiltX)).toBeGreaterThan(0.004);                 // 1초 뒤에도 아직 출렁인다
});
```

- [ ] **Step 2: 실패 확인** — FAIL(`ease.smooth` 없음, 1초 뒤 진폭이 너무 작음).
- [ ] **Step 3: 구현** — 위 값대로 바꾼다. 기존 swing 테스트("멈추면 잦아든다": 600프레임 뒤 0.005 미만)도 그대로 통과해야 한다. `clawPath`의 정착 곡선도 `ease.smooth`를 쓴다.
- [ ] **Step 4: 통과 확인** — `npm --prefix client test` 전체 PASS.
- [ ] **Step 5: Commit** — `feat: 모션 곡선을 시작·끝이 매끄럽게, 집게 출렁임을 더 부드럽게`

### Task 10: 빈 구역 "준비 중" 장식

**Files:**
- Modify: `shared/store_layout.json`, `server/src/toycrane/domain/shared_data.py`(생성 스크립트), `server/tests/domain/test_store_rules.py`, `client/src/data/storeLayout.ts`, `client/src/main.ts`
- Create: `client/src/world/decor.ts`, `client/src/world/decor.test.ts`

**Interfaces:**
- Consumes: `prepTex()`(Task 2), `makeDoll(id, true)`(Task 6), `bakeByMaterial`/`materialCloner`
- Produces:
  - 공용 배치 `"decor"`: `[{ "kind": "mini" | "figure" | "shelf", "rect": [x0, z0, x1, z1], "ry": number }]`. 각 `rect`는 `"obstacles"`에도 넣는다.
    - 미니 벽 줄 `[-12.95,-4.6,-11.75,11.6]` ry π/2
    - 미니 아래 줄 `[-11.2,11.75,-1.6,12.95]` ry π
    - 미니 진열장 `[-9.2,0,-8.2,6]` ry π/2
    - 피규어는 좌우 거울로 둔다: `[11.75,-4.6,12.95,11.6]` ry -π/2, `[1.6,11.75,11.2,12.95]` ry π, 진열장 `[8.2,0,9.2,6]` ry -π/2.
  - `DECOR`(storeLayout.ts).
  - `buildDecor(scene): Occluder[]`: 줄마다 하나씩 가림막을 돌려준다.
    - mini: 2단 미니 기계 벽에 파스텔 천 덮개와 "준비 중" 카드를 단다.
    - figure: 상자 기계에 덮개와 카드를 단다.
    - shelf: 2단 흰 진열장에 lite 인형을 줄지어 올린다.
    - 모두 재질별로 합친다.

- [ ] **Step 1: 실패하는 테스트**

```python
# server/tests/domain/test_store_rules.py — 0.25m 격자 BFS, 장애물 안·바닥 밖은 못 감
def test_decor_keeps_every_spot_reachable():
    goals = [front_spot(m) for m in MACHINES.values()] + [q for c in COUNTERS for q in c.queue]
    reach = reachable_from(Position(SPAWN_RADIUS, 0.0), step=0.25)
    assert all(reach(g) for g in goals)
```

```ts
// decor.test.ts
test('decor stays a few merged meshes and every piece is an obstacle', () => {
  const scene = new THREE.Scene(); buildDecor(scene);
  let n = 0; scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; });
  expect(n).toBeLessThanOrEqual(24);
  for (const d of DECOR) expect(OBSTACLES).toContainEqual(d.rect);
});
```

- [ ] **Step 2: 실패 확인** — `cd server && uv run pytest tests/domain/test_store_rules.py -q`가 FAIL(헬퍼 없음)이다. 장식을 넣기 전에 헬퍼만 먼저 만들면 PASS여야 한다(테스트가 제대로 도는지 확인). 화면 `decor` 테스트는 FAIL이다.
- [ ] **Step 3: 구현** — 아래를 넣는다.
  - JSON에 장식과 장애물을 넣고 `cd server && uv run python scripts/gen_shared.py`를 돌린다.
  - 테스트 헬퍼 `reachable_from`(테스트 파일 안)을 만든다.
  - `decor.ts`를 만들고, `main.ts`의 `OcclusionFader`에 장식 가림막을 넣는다.
  - BFS가 막히면 장식 상자를 줄인다. 줄 자리·기계 앞자리는 옮기지 않는다.
- [ ] **Step 4: 통과 확인** — 서버 `uv run pytest -q`, `PYTHONPATH=src uv run lint-imports`, 화면 `npm --prefix client test` 모두 PASS.
- [ ] **Step 5: Commit** — `feat: 미니·피규어 구역을 "준비 중" 덮개 기계와 경품 진열장으로 채움`

### Task 11: 성능·화면 확인, 배포, 사람 확인

**Files:**
- Create: `client/e2e/perf-after.json`(재본 값)
- Modify: `docs/DEPLOY_LOG.md`(3단계 확인 기록)

- [ ] **Step 1: 성능** — 빌드 후 로컬에서 `node client/e2e/perf.mjs http://localhost:8787 client/e2e/perf-after.json`을 돌린다.
  Expected: 네 값 모두 `perf-baseline.json`의 1.5배 이하. 넘으면 이렇게 줄이고 다시 잰다(먼저 줄이는 순서):
  1. 멀리 있는 기계의 유리 반사 줄·안내 카드 빼기
  2. 휴대폰에서 그림자 끄기
  3. 장식 더 합치기
- [ ] **Step 2: 기존 e2e** — `client/e2e/mobile-entry.mjs`, `client/e2e/mobile-joystick.mjs`, 계속 뽑기 흐름(한 판 → 기계 화면 유지 → 한 번 더 → 그만하기 → free)이 모두 통과한다.
- [ ] **Step 3: 화면 프레임** — 아래를 찍어 직접 본다.
  - PC와 휴대폰의 걷기 시점(스폰, 섬 줄 뒤): 천장 조명판·간판이 보이는가.
  - C-6 기계 앞에서 성공·놓침·헛잡음 각각 손가락이 오므려진 순간과 들어 올린 순간: 집게가 인형 속에 들어간 데가 없는가.

  들어간 데가 있으면 그 결과의 `planGrip` 입력을 테스트로 만들어 고친다.
- [ ] **Step 4: 전체 확인 후 배포** — 아래를 순서대로 돌린다.
  1. `npm --prefix client test`
  2. `cd server && uv run pytest -q && PYTHONPATH=src uv run lint-imports`
  3. `npm --prefix client run build && (cd server && CI=1 uv run pywrangler deploy)`
  4. 라이브에서 한 판(관찰자 웹소켓으로 result 수신)
- [ ] **Step 5: 사람 확인** — 사용자가 PC와 휴대폰으로 확인한다:
  - 싸 보이지 않고 일본 게임센터 같은가
  - 카메라와 조이스틱 방향이 자연스러운가
  - 잡는 느낌이 나는가
  - 휴대폰에서 부드러운가

  결과와 측정값을 docs/DEPLOY_LOG.md "3단계 확인"에 적고 커밋한다(`docs: 3단계 확인 기록`).
