# 피규어 큰 상자 두 종류 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 피규어 기계 14대를 진짜 가게처럼 큰 상자 두 종류로 바꾼다. 줄마다 긴 상자(F-1~F-7) 또는 정사각형 상자(F-8~F-14)를 둔다. 상자는 두 막대 사이(GET)로만 빠지고, 뒤 받침 막대·투명 벽과 앞 투명판이 앞뒤를 막는다.

**Architecture:** 종류별 수치(상자 치수·무게, 막대 틈, 집게 힘)는 `shared/figure.json`의 `variants`에 둔다. 각 기계의 종류는 `shared/store_layout.json` figures의 `box`에 적는다. 서버 규칙(새 상자·보고 확인·직원 도움)과 화면(물리 세계·집게·그림·시뮬)은 기계 종류를 받아 그 수치를 쓴다. 저장 키는 `figures_v2`, 규약은 11로 올린다.

**Tech Stack:** three.js/TS, Rapier(결정적 빌드), vitest(+ sim config), Python Cloudflare Workers(DO), pytest, import-linter.

**Spec:** `docs/superpowers/specs/2026-11-01-toycrane-figure-machine-design.md` §8(개정). §1~§7은 그대로 유효하다. 시제품은 `client/figure-v2-preview.html`와 `client/src/spike/figureV2Preview.ts`(개발 전용)이다.

## Global Constraints

- 무료 요금제 안(Cloudflare Workers·DO·D1). 유료 기능 금지. 배포는 매번 사용자 허락.
- 화면에 일본어 금지. 화면 문구에서 가운데 점(·)으로 문장을 잇지 않는다. 효과는 글자 이름표·제자리 반짝임(도는 작은 점 금지).
- 캐릭터는 우리 24종, 털 표현 금지.
- 판수: 영리하게 하면 10%선 3~5판, 90%선 12~18판(§2 "운 좋으면 4판·나쁘면 15판"). 종류마다 따로 맞춘다.
- 결정성: 같은 입력이면 같은 상자 자리(고정 간격 1/120초, 걸음 순서 고정).
- 경품은 상자가 빠진 순간 서버가 정한다. 그 전 메시지·저장에는 상자 자리와 `nudged`뿐이다(§3.4, 그대로).
- 휴대폰 성능 관문: 걷기 그리기 호출 ≤ 400, 기계 앞 ≤ 160, 걷기 삼각형 ≤ 180만.
- 커밋 끝줄: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **상자가 앞뒤로 빠져 나감:** 세게 밀리거나 기울어 받침 막대·벽·앞판 너머로 가는 경우다. 막대 사이가 아닌 곳으로는 빠지지 않아야 하고 당첨으로도 세지 않는다(Task 3 `the box never leaves over the front or back`).
2. **정사각형 상자가 누운 채로 돌기만 해서 빠짐(너무 쉬움):** 45° 돌려도 막대 위에 남아야 한다(Task 3 `a lying square box stays on the bars at any turn`).
3. **옛 작은 상자 저장(`figures_v1`)을 새 기계가 읽음:** 새 키라 무시하고 종류에 맞는 새 상자를 둔다(Task 2 `test_old_small_boxes_are_not_read`).
4. **기계 종류가 화면과 서버에서 어긋나거나 빠짐:** 모든 피규어 기계가 `long`이나 `square`이고, 화면과 서버가 같은 표를 읽는다(Task 1 `every figure machine has a box kind`, Task 2 `test_every_figure_has_a_known_box`).
5. **큰 상자가 뒤 받침 막대 위나 벽에 기대 영영 갇힘:** 판수 90%선이 기준 안이고, 직원이 옮긴 상자가 바로 빠지지 않는다(Task 4 시뮬 시험).

---

### Task 1: 종류별 공용 수치와 기계 종류

**Files:**
- Modify: `shared/figure.json`, `shared/store_layout.json`(figures 14개에 `"box"`), `client/src/data/figures.ts`, `client/src/data/figures.test.ts`
- Regenerate: `cd server && uv run python scripts/gen_shared.py`

**Interfaces:**
- Produces:
  - `type BoxKind = 'long' | 'square'`
  - `FigureSpot = { id; x; z; ry; row: 'f1' | 'f2'; box: BoxKind }`
  - `type Variant = { box: { w; d; h; mass; com }; gap: number; power: { grip; lift; carry; max_lift; max_clear } }`
  - `variantOf(kind: BoxKind): Variant`
  - `boxKindOf(id: string): BoxKind` (모르는 id면 throw)
  - figure.json 모양:
    - `bars {y, radius, half_len}`
    - `claw {home, speed, rest_y, descend, scale}`
    - `guards {back_bar, back_wall, front}` — 앞 막대 중심 z에서 바깥쪽으로 떨어진 거리(m)
    - `variants {long, square}`
    - `play_half`, `odds`, `stuck`, `nudge`, `start_jitter`
  - 집게 힘(grip·lift·carry·max_lift·max_clear)은 `claw`에서 빼고 `variants.*.power`로 옮긴다.

- [ ] **Step 1: 실패하는 시험**
  - `client/src/data/figures.test.ts`:
    - `every figure machine has a box kind`:
      - F-1~F-7 → `'long'`, F-8~F-14 → `'square'`(`boxKindOf`).
      - 표의 모든 기계가 둘 중 하나.
    - `each box is longer than its bar gap but stands through it`(옛 `the box is longer than the bar gap but stands through it`를 바꿈). 종류마다:
      - `box.h > gap + 2*radius`(눕히면 걸침)
      - `box.d < gap`(세우면 빠짐)
      - 정사각형은 추가로 `box.w > gap + 2*radius`(돌려도 걸침)
    - `the guards close the front and back`:
      - `guards.front < box.d`
      - `guards.back_wall - guards.back_bar < box.d`
      - 받침 막대와 벽 사이로 상자가 못 들어간다.
- [ ] **Step 2: 실행**
  - Run: `cd client && npx vitest run src/data/figures.test.ts`
  - Expected: FAIL(`boxKindOf` 없음).
- [ ] **Step 3: 구현**
  - `figure.json`의 시작 값(시제품, Task 4에서 다시 맞춤):
    - bars: `radius 0.014`, `half_len 0.43`, `y 0.98` 그대로
    - claw: `scale 1.5`
    - guards: `back_bar 0.09`, `back_wall 0.17`, `front 0.06`
    - long: `box {w 0.17, d 0.12, h 0.34, mass 0.5, com -0.15}`, `gap 0.255`
    - square: `box {w 0.26, d 0.13, h 0.26, mass 0.6, com 0}`, `gap 0.2`
    - power: 두 종류 모두 지금 값(grip 0.3, lift 0.25, carry 0.12, max_lift 0.04, max_clear 0.008)
  - `store_layout.json` figures마다 `"box"`를 넣는다.
  - `figures.ts`에 위 Interfaces를 만든다.
  - `FIGURE.box`, `FIGURE.bars.gap`, `FIGURE.claw.grip` 같은 옛 이름을 쓰는 곳은 이 Task에서 컴파일만 되게 `variantOf('long')`로 잇는다. 진짜 종류 연결은 Task 3·5에서 한다.
  - `gen_shared`로 서버 사본을 다시 만든다.
- [ ] **Step 4: 실행**
  - Run: `cd client && npx vitest run src/data && npx tsc --noEmit -p .`
  - Expected: PASS.
- [ ] **Step 5: 커밋** — `feat: 피규어 상자 두 종류 공용 수치와 기계 종류`

### Task 2: 서버 — 종류별 새 상자·보고 확인, 저장 v2, 규약 11

**Files:**
- Modify:
  - `server/src/toycrane/domain/figure.py`
  - `server/src/toycrane/domain/layout.py`(`Figure.box`)
  - `server/src/toycrane/app/use_cases/figure_boxes.py`
  - `server/src/toycrane/app/use_cases/figure_done_interactor.py`
  - `server/src/toycrane/adapter/outbound/do_storage_figure_boxes.py`(KEY `figures_v2`)
  - `server/src/toycrane/adapter/inbound/ws/schemas/server_messages.py`(PROTOCOL 11)
  - `client/src/net/protocol.ts`(PROTOCOL 11)
  - 시험: `server/tests/domain/test_figure.py`, `server/tests/adapter/test_figure_storage.py`, `server/tests/app/use_cases/test_figure_done_interactor.py`, 규약 시험

**Interfaces:**
- Consumes: Task 1 `figure.json` variants, layout `box`.
- Produces:
  - `start_box(rng, kind: str) -> BoxPose`(누운 높이 = bars.y + radius + d/2)
  - `check_report(box, won, kind) -> (BoxPose, bool) | str`. 당첨 기준과 잘라 넣기는 그 종류의 `h`·`d`로 잰다.
  - `after_play(state, box, won, rng, kind)`
  - `Figure(id, x, z, ry, row, box)`

- [ ] **Step 1: 실패하는 시험**
  - `test_start_box_lies_across_both_bars`를 두 종류로: y = 0.98 + 0.014 + d/2(±1e-9). 돌림 ≤ 2°, 자리 ≤ 6mm.
  - `test_check_report_needs_box_below_bars_for_a_win`: 종류마다 `h`로 잰다.
  - `test_win_places_a_new_box`: 그 기계 종류의 상자가 놓인다.
  - `test_every_figure_has_a_known_box`: `FIGURES` 모두 `box in ('long', 'square')`, F-8의 box는 `'square'`.
  - `test_old_small_boxes_are_not_read`: `figures_v1`에만 상자가 저장된 저장소를 `ensure_figures`가 읽으면 14대 모두 종류에 맞는 새 상자(누운 높이)를 받는다.
  - 규약 시험: `PROTOCOL == 11`(서버, 화면).
- [ ] **Step 2: 실행**
  - Run: `cd server && uv run pytest -q tests/domain/test_figure.py tests/adapter/test_figure_storage.py tests/app/use_cases/test_figure_done_interactor.py`
  - Expected: FAIL.
- [ ] **Step 3: 구현**
  - `figure_done_interactor`와 `ensure_figures`는 `FIGURES[id].box`를 넘긴다.
  - `check_report` 허용 범위도 함께 좁힌다(최종 리뷰 M5): x는 `half_len`, z는 `barZ + guards.back_wall` 안, 안 빠진 상자 y는 `bars.y + h` 이하.
- [ ] **Step 4: 실행**
  - Run: `cd server && uv run pytest -q && PYTHONPATH=src uv run lint-imports`
  - Expected: PASS, contracts kept.
- [ ] **Step 5: 커밋** — `feat: 서버 피규어 규칙을 상자 종류별로, 저장 v2, 규약 11`

### Task 3: 물리 — 종류별 세계, 앞뒤 막힘, 1.5배 집게

**Files:**
- Modify: `client/src/physics/figureWorld.ts`, `client/src/physics/figureClaw.ts`, `client/src/physics/figureCycle.ts`, `client/src/physics/figureCycle.test.ts`

**Interfaces:**
- Consumes: Task 1 `variantOf`, `BoxKind`.
- Produces:
  - `new FigureWorld(R, start: BoxWire, kind: BoxKind)`
  - `world.kind`, `world.variant`
  - `barZ(kind): number`
  - `FigureClaw`: 모양 상수 × `claw.scale`. `CLAW_SHAPE`는 키운 값을 내보낸다(그림이 같은 모양).
  - `FigureCycleRunner`는 힘을 `world.variant.power`에서 읽는다.
  - `fallen()`: 상자 가운데가 막대보다 `h` 아래이고, z가 두 막대 사이(|z| < barZ)일 때만 참.

- [ ] **Step 1: 실패하는 시험** — `figureCycle.test.ts`. 기존 다섯 시험을 `for (const kind of ['long', 'square'])`로 돌린다(세운 상자는 그 종류의 d가 틈을 지나게 세움). 그리고 다음을 더한다.
  - `the box never leaves over the front or back`:
    - 종류마다 누운 상자에 앞(+z)으로 1.5m/s, 뒤(−z)로 1.5m/s를 따로 준다. 3초 흐른 뒤 상자 y > bars.y이고 |z| < barZ + guards.back_wall이다.
    - 또는 막대 사이로 빠졌다면 그때 |z| < barZ다.
  - `a lying square box stays on the bars at any turn`: 정사각형을 0°, 20°, 45°, 70° 돌려 놓고 3초 흐른 뒤 `fallen() === false`.
  - `a box pushed onto the back support can be dragged back`: 긴 상자를 받침 막대 쪽(z = −barZ − 0.05)에 놓고 집게를 앞 끝(상자 +z 끝 근처)에 내린다. 6판 안에 상자 가운데 z가 늘어난다(앞으로 끌려옴).
- [ ] **Step 2: 실행**
  - Run: `cd client && npx vitest run src/physics/figureCycle.test.ts`
  - Expected: FAIL(생성자 인자, 새 시험).
- [ ] **Step 3: 구현**
  - 충돌체:
    - 막대 두 개(±barZ(kind))
    - 받침 막대(z = −(barZ + guards.back_bar), 같은 높이)
    - 뒤 벽(z = −(barZ + guards.back_wall), 막대 위 0.3m, 마찰 0)
    - 앞판(z = barZ + guards.front, 막대 위 0.07m, 마찰 0)
    - 옆 벽, 받는 바닥
  - 옛 멈춤판(STOP_*)은 앞판·뒤 벽으로 바꾼다.
  - 상자는 그 종류의 치수·질량·무게중심을 쓴다.
  - 집게:
    - 모양 상수(HEAD·HINGE·ELBOW·TIP·PLATE·TIP_R) × scale
    - 머리 질량 0.4 × scale³은 Task 4에서 맞춤
    - 팔 질량 × scale³
  - `corners()`·`checkSlip()`은 `fw.variant`를 쓴다.
- [ ] **Step 4: 실행**
  - Run: `cd client && npx vitest run src/physics && npx tsc --noEmit -p .`
  - Expected: PASS.
- [ ] **Step 5: 커밋** — `feat: 피규어 물리를 상자 종류별로 — 앞뒤 막힘, 받침 막대, 1.5배 집게`

### Task 4: 시뮬 판수 맞추기 — 종류마다

**Files:**
- Modify: `client/sim/figureBot.ts`, `client/sim/figure.test.ts`, `shared/figure.json`(맞춘 값), `server` 사본(gen_shared)

**Interfaces:**
- Consumes: Task 3.
- Produces:
  - `playsToWin(R, strategy, seed, max, kind: BoxKind)`
  - `startBox(rng, kind)`
  - `nudgeBox(w, rng)`(그대로)
  - 전략:
    - 긴 상자: `smart | vertical | rotate | masher`
    - 정사각형: `smart | flip | drag | masher`
      - `flip`: 한쪽 끝을 눌러 들어 세움
      - `drag`: 뒤로 간 상자를 앞 끝을 걸어 끌어옴 + 들어 세움
    - `smart`는 두 판 연속 거의 안 움직이면 그 종류의 공략을 바꾼다(옛 규칙 그대로).

- [ ] **Step 1: 실패하는 시험** — `sim/figure.test.ts`를 종류마다 돌린다(`describe.each(['long', 'square'])`).
  - `a sensible player wins in about 4 to 15 plays`: 10%선 3~5, 90%선 12~18.
  - `both shop techniques work`: 30판 안 성공률 ≥ 0.9.
    - 긴 상자: vertical, rotate
    - 정사각형: flip, drag
  - `mashing buttons takes far longer`: 50%선 ≥ 2 × smart 50%선.
  - `nudged box stays on the bars`: 옛 시험 그대로, 종류마다.
- [ ] **Step 2: 실행**
  - Run: `cd client && SIM_TRIALS=60 npx vitest run --config vitest.sim.config.ts sim/figure.test.ts`
  - Expected: FAIL(인자, 아직 안 맞춘 값).
- [ ] **Step 3: 맞추기**
  - `figure.json`의 종류별 `gap`, `box.mass`, `box.com`, `power`와 `claw.scale`을 바꿔 가며 기준을 맞춘다.
  - 시제품 모양에서 크게 벗어나지 않는다: 틈 ±3cm, 상자 치수는 그대로.
  - 바뀐 값마다 이유를 ledger에 남긴다.
  - 맞춘 뒤 500상자로 한 번 잰 숫자를 README에 적는다.
- [ ] **Step 4: 실행**
  - Run: `cd client && SIM_TRIALS=200 npx vitest run --config vitest.sim.config.ts sim/figure.test.ts sim/scenes.test.ts && npx vitest run src/physics src/data`
  - Expected: PASS.
- [ ] **Step 5: 커밋** — `feat: 큰 상자 두 종류 판수 맞추기 — 시뮬`

### Task 5: 그림 — 종류별 기계 속, 정사각형 상자 그림, 큰 집게

**Files:**
- Modify: `client/src/world/figureMachine.ts`, `client/src/world/figureZone.ts`, `client/src/world/figureReveal.ts`, `client/src/world/figureZone.test.ts`, `client/src/world/figureReveal.test.ts`
- Delete(끝나면): `client/figure-v2-preview.html`, `client/src/spike/figureV2Preview.ts`

**Interfaces:**
- Consumes: Task 1 `variantOf`, Task 3 `barZ(kind)`, 키운 `CLAW_SHAPE`.
- Produces:
  - `blindBoxGeo(kind: BoxKind)`: 종류마다 하나씩, 정사각형은 윗면에 정사각 그림.
  - `makeFigureMachineParts(spot, index, color)`: `spot.box`로 막대 틈·받침 막대·뒤 벽(윗변 테두리)·앞판(테두리 없음)·진열대 상자를 그린다.
  - `playReveal(scene, at, toward, kind, rare, done, box: BoxKind = 'long')`

- [ ] **Step 1: 실패하는 시험**
  - `figureZone.test.ts`:
    - `each row draws its own box size`: f1 줄 상자 인스턴스 도형의 bbox는 (0.17, 0.12, 0.34), f2 줄은 (0.26, 0.13, 0.26)(±1e-6).
    - `fourteen figure machines draw in a few meshes`: 기준 ≤ 64(받침 막대·벽 재질이 늘 수 있음).
  - `figureReveal.test.ts` `the reveal box matches the machine box`: `box: 'square'`면 상자 도형 bbox는 정사각형 치수 × BOX_SCALE.
  - `every box shows the same blind box art`: 정사각형 그림에도 '피규어 컬렉션' 문구가 있고 캐릭터 이름은 없다.
- [ ] **Step 2: 실행**
  - Run: `cd client && npx vitest run src/world/figureZone.test.ts src/world/figureReveal.test.ts`
  - Expected: FAIL.
- [ ] **Step 3: 구현**
  - 시제품 `figureV2Preview.ts`의 배치를 옮긴다: 받침 막대 색 `0xd9dbe3`, 뒤 벽 투명판과 흰 테두리, 앞판 투명.
  - 정사각형 상자 그림은 같은 물음표 원·'toycrane 피규어 컬렉션'을 정사각 칸에 그린다(새 캔버스 또는 같은 아틀라스의 새 칸).
  - `FigurePlay.reveal`은 그 기계 종류를 넘긴다.
- [ ] **Step 4: 실행**
  - Run: `cd client && npx vitest run src/world && npx tsc --noEmit -p .`
  - Expected: PASS.
  - 미리보기 `figure-zone-preview.html?view=front`·`side`(F-4 긴 상자, F-11 정사각형 — 미리보기에 `?id=` 추가) 스크린샷이 시제품과 같아 보인다.
- [ ] **Step 5: 커밋** — `feat: 피규어 기계 그림을 상자 종류별로 — 받침 막대, 투명 벽·앞판, 정사각형 상자`

### Task 6: 연결·확인 — 한 판, e2e 두 종류, 성능, 사진

**Files:**
- Modify: `client/src/game/figurePlay.ts`(`FigureWorld(R, box, kind)`), `client/src/main.ts`(필요하면), `client/e2e/figure.mjs`(셋째 인자 기계 id, 기본 F-1), `client/src/game/figureCamera.test.ts`(키운 집게 머리), `README.md`, `client/e2e/perf-hall.json`

- [ ] **Step 1: 실패하는 시험**
  - Run: `node e2e/figure.mjs 9461 http://localhost:8787 F-8`
  - Expected: FAIL. 화면이 아직 긴 상자 물리로 정사각형 기계를 돌려 상자 자리가 서버 저장(정사각형 누운 높이)과 어긋난다. 또는 인자를 아직 안 받는다.
- [ ] **Step 2: 구현**
  - `FigurePlay.start`가 `boxKindOf(id)`를 넘긴다.
  - 카메라 시험은 키운 집게 팔 끝(대기 높이 − 0.255m)도 보이는지 더한다.
- [ ] **Step 3: 확인**
  - `figure.mjs` F-1·F-8 PASS
  - `figure-run.mjs` PASS
  - 인형 play·run·watch PASS
  - determinism(빈 저장소) PASS
  - `perf.mjs` 관문 통과
  - 전체 시험: `npx vitest run src && npx tsc --noEmit -p . && npm run build`, `cd server && uv run pytest -q && PYTHONPATH=src uv run lint-imports`, sim scenes·figure PASS
  - PC·휴대폰 스크린샷: 긴 상자·정사각형 정면·옆·한 바퀴
- [ ] **Step 4: 커밋** — `feat: 큰 상자 두 종류 연결 — e2e, 성능, 기록`(README '피규어 큰 상자 두 종류')

### Task 7: 최종 리뷰와 배포

- [ ] 전체 브랜치 리뷰(가장 유능한 모델)
- [ ] Critical·Important를 한 번에 고친다(각각 RED→GREEN).
- [ ] **사용자에게 배포 허락을 받는다.** 알릴 것:
  - 지금 작은 상자 14개가 새 큰 상자로 바뀜
  - 규약 11이라 열린 화면 새로 고침
  - 인형 기계는 그대로
- [ ] 배포: `cd server && CI=1 uv run pywrangler deploy`
- [ ] 라이브 확인: `figure.mjs` F-1·F-8, `figure-run`, `play`, `run`, 스크린샷, 콘솔 오류
- [ ] README에 Version을 적는다.
