# 피규어 뽑기 구현 계획 (9단계)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 큰 홀 동쪽 '준비 중' 장식 14대를 진짜 피규어 뽑기 기계(F-1~F-14)로 바꾼다 — 쇠막대 두 개에 걸친 상자를 두 팔 집게로 밀고 돌려 막대 사이로 떨어뜨리고, 뽑으면 무작위 피규어 상자를 깐다.

**Architecture:** 인형 기계와 같은 틀을 쓴다: 판 잠금·코인(`play`/`play_ok`), 하는 사람 브라우저의 Rapier 물리(결정성 빌드), 판 끝 보고(`done`), 구경꾼 중계(`pose`), 서버 상식 확인·저장·가방·결과 알림. 다른 것만 새로 만든다: 상자 한 개의 자리를 기계마다 저장(`figures_v1`), 버튼 ①② 판(`FigureSession`), 두 팔 집게 물리(`figureWorld`/`figureClaw`/`figureCycle`), 피규어 기계 그림(`figureZone`), 옆 대각선 시점, 상자 까기(`figureReveal`). 경품은 뽑힌 순간 서버가 정한다.

**Tech Stack:** three.js + TypeScript + Vite + vitest(client), `@dimforge/rapier3d-deterministic-compat`, Python Cloudflare Workers + Durable Objects + D1(server, pytest, import-linter), 공용 JSON(`shared/`, 서버는 `uv run python scripts/gen_shared.py`로 복사).

**Spec:** `docs/superpowers/specs/2026-11-01-toycrane-figure-machine-design.md` (승인 1e12be1). 기계 모양 기준: `docs/superpowers/specs/2026-10-31-toycrane-graphics-a-design.md` §3.5. 피규어 생김새 C 시안: `client/src/spike/figure.ts`(`?only=c`).

## Global Constraints

- 무료 요금제 안(Cloudflare Workers·DO·D1). 유료 기능 금지. D1 마이그레이션 없음(`bag.zone` 열이 이미 있음, 값 `"figure"`).
- 화면에 일본어 금지. 화면 문구에서 가운데 점(·)으로 문장을 잇지 않는다.
- 캐릭터는 우리 24종(`shared/catalog.json`)만. 털 표현 금지.
- 효과는 한눈에: 글자 이름표 + 제자리 반짝임. 둘레를 도는 작은 점 금지.
- 물리는 `@dimforge/rapier3d-deterministic-compat`, 고정 걸음(1/120초), 같은 입력이면 같은 결과.
- 휴대폰 성능 관문(`client/e2e/perf.mjs`): 걷기 그리기 호출 ≤ 400, 기계 앞 ≤ 160, 걷기 삼각형 ≤ 180만.
- 판수 목표(사용자): 혼자 처음부터 운 좋으면 4판, 나쁘면 15판 → 합리적 자동 플레이어의 뽑기까지 판수 10%선 4판 안팎, 90%선 15판 안팎.
- 희귀 3%(효과 8가지 중 하나), 황금 0.5%, 캐릭터 24종 같은 확률 — 뽑힌 순간 서버가 정한다. 뽑기 전 메시지·저장 어디에도 경품 내용이 없다.
- 조작: 기계 조작대의 진짜 버튼 ①(누르는 동안 오른쪽, 떼면 멈춤) ②(누르는 동안 안쪽, 떼면 집게가 내려감), 버튼마다 한 판에 한 번. PC 마우스, 휴대폰 손가락.
- 시점: ① 단계는 정면, ①을 떼는 순간 옆 대각선으로 부드럽게, 판이 끝나면 정면. 버튼을 누르고 있는 동안 카메라는 움직이지 않는다.
- 상자 까기: 일반은 효과 없이 평범하게, 희귀는 무광 + 주위 효과, 황금은 광이 살짝 있는 금도금 + 황금 효과. 희귀·황금은 진열탑 전광판 알림.
- 생김새 C: 우리 인형 빌더 모양, 천 주름 그늘(꼭짓점 색) 뺌, 외곽선 유지, `MeshStandardMaterial` 거칠기 0.62 수준의 무광, 둥근 받침대.
- 한 판 1코인, 이어 하기(한 판 더·세 판·다섯 판)는 인형 기계와 같은 흐름. 기계 번호 F-1~F-14. 규약 10.
- 배포는 매번 사용자 허락. 커밋 끝줄 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. 뽑기 전에 경품이 새어 나감 → `welcome.figures`·`figure` 메시지·DO 저장(`figures_v1`)에는 상자 자리와 `nudged`만 있다(Task 3 `test_figure_state_carries_no_prize`, Task 5 `figure messages carry no prize`).
2. 화면이 엉뚱한 상자 자리(기계 밖, NaN, 막대 아래인데 `won` 없음)를 보고함 → 서버가 거절하거나 기계 안으로 자르고, 저장 상태는 그대로(Task 2 `test_check_report_*`).
3. 하는 사람이 판 도중 나가거나 보고가 안 옴 → 상자는 판 시작 전 자리로 남고, 잠금이 풀린 뒤 다음 사람이 할 수 있다(Task 4 `test_expired_lock_keeps_box`).
4. 버튼 순서가 어긋남(①보다 ② 먼저, 두 번 누름, 화면 밖에서 뗌, 시간 초과) → 판이 꼬이지 않고 규칙대로 내려간다(Task 8 `FigureSession` 시험).
5. 상자가 꽉 끼어 영영 안 움직임 → 8판 동안 거의 안 움직이면 서버가 살짝 옮기고, 옮긴 상자가 바로 빠지지는 않는다(Task 2 `test_stuck_box_gets_nudged`, Task 7 `nudged box stays on the bars`).

---

## 파일 구조

| 파일 | 맡는 일 |
|---|---|
| `shared/figure.json` (새) | 피규어 기계 수치: 막대·상자·집게·버튼 속도·확률·꽉 낀 상자 규칙·처음 자리 흔들림 |
| `shared/store_layout.json` | `figures` 14대, 기계마다 장애물, 피규어 장식 줄 삭제 |
| `client/src/data/figures.ts` (새) | `FIGURES`, `FIGURE`(figure.json 타입), `isFigure(id)` |
| `client/src/physics/figureWorld.ts` (새) | Rapier 세계: 막대 2개, 상자, 떨어지는 곳, 벽 |
| `client/src/physics/figureClaw.ts` (새) | 두 팔 집게(머리 + 경첩 팔, 힘 한도, 들림 한계) |
| `client/src/physics/figureCycle.ts` (새) | 한 바퀴: 내려감 → 오므림 → 올림 → 놓음 → 제자리 → 멈출 때까지 |
| `client/src/game/figureSession.ts` (새) | 버튼 ①② 단계·시간 초과 |
| `client/src/world/figureControls.ts` (새) | 조작대 버튼 ①②(누르기 판정, 빛남, 눌림) |
| `client/src/world/figureZone.ts` (새) | 피규어 기계 14대 그림·줄마다 가림막·집게·상자 자리 |
| `client/src/world/figureModel.ts` (새) | `makeFigure(kind, rare)`: C 무광·황금 도금·받침대 |
| `client/src/world/figureReveal.ts` (새) | 상자 까기 연출(일반·희귀·황금) |
| `client/src/game/figureCamera.ts` (새) | 정면·옆 대각선 자세와 넘어가기 |
| `client/sim/figure.test.ts`, `client/sim/figureBot.ts` (새) | 판수 맞추기·공략 장면·결정성 |
| `client/src/net/protocol.ts` | `welcome.figures`, `figure` 메시지, 규약 10 |
| `client/src/main.ts` | 피규어 판 연결, 입력, 보고, 중계, 결과 |
| `server/src/toycrane/domain/figure.py` (새) | 처음 상자, 경품 뽑기, 보고 확인, 꽉 낀 상자 |
| `server/src/toycrane/domain/layout.py` | `FIGURES`, `machine_spot(id)` |
| `server/src/toycrane/adapter/outbound/do_storage_figure_boxes.py` (새) | `figures_v1` 저장 |
| `server/src/toycrane/app/use_cases/figure_done_interactor.py` (새) | 피규어 판 보고 처리 |
| 서버 스키마·메시지·입장·판 시작·중계 | 피규어 기계 번호도 받기 |
| `client/e2e/figure.mjs` (새) | 피규어 한 판 e2e |

---

### Task 1: 공용 수치·배치 — 피규어 기계 14대 자리

**Files:**
- Create: `shared/figure.json`, `client/src/data/figures.ts`, `client/src/data/figures.test.ts`
- Modify: `shared/store_layout.json`, `client/src/data/storeLayout.ts`, `client/src/world/decor.ts`, `client/src/world/decor.test.ts`, `client/src/data/storeLayout.test.ts`, `server/src/toycrane/domain/layout.py`, `server/tests/domain/test_shared_data.py`, `server/src/toycrane/domain/shared_data.py`(생성)

**Interfaces:**
- Produces (client): `type FigureSpot = { id: string; x: number; z: number; ry: number; row: 'f1' | 'f2' }`; `FIGURES: FigureSpot[]`; `FIGURE: FigureSpec`(figure.json 그대로 타입); `isFigure(id: string): boolean`; `nearestFigure(pos: Vec2): FigureSpot | null`(손 닿는 거리 `MACHINE_SPEC.reach` 안의 가장 가까운 피규어 기계 앞자리); `frontSpot`은 `FigureSpot`도 받는다(같은 `front`·`ry` 규칙). `nearestMachine`은 인형 기계만 그대로 — 둘을 합치는 건 Task 12(연결 전 화면이 피규어 기계에서 인형 판을 열지 않게).
- Produces (server): `layout.FIGURES: dict[str, Figure]`(`Figure(id, x, z, ry, row)`), `layout.machine_spot(id) -> Machine | Figure | None`, `layout.front_spot`가 둘 다 받음. `shared_data.FIGURE`(figure.json).
- `shared/figure.json` 키(값은 Task 7이 시뮬로 맞춤, 처음 값은 아래): `{"bars": {"y": 0.98, "gap": 0.16, "radius": 0.012, "half_len": 0.42}, "box": {"w": 0.11, "d": 0.08, "h": 0.22, "mass": 0.3, "com": -0.15}, "claw": {"home": [-0.4, 0.3], "speed": 0.3, "rest_y": 1.9, "descend": 0.35, "grip": 0.07, "lift": 0.032, "carry": 0.02, "max_lift": 0.05, "max_clear": 0.008}, "play_half": [0.4, 0.3], "odds": {"rare": 0.03, "gold": 0.005}, "stuck": {"plays": 8, "move": 0.004, "turn": 0.035}, "nudge": {"shift": [0.005, 0.01], "twist_deg": [3, 7]}, "start_jitter": {"shift": 0.006, "twist_deg": 2}}` — 기계 좌표(앞 +z, 오른쪽 +x), 막대는 x를 따라, 상자 긴 변은 처음에 z를 따라 두 막대에 걸침.

- [ ] **Step 1: 실패하는 시험** — `client/src/data/figures.test.ts`:
  - `test('fourteen figure machines F-1 to F-14 face the plaza in two rows')`: `FIGURES.map(f=>f.id)` = `F-1`…`F-14`; 줄 `f1` x 13.2·`f2` x 18.4, 줄마다 7대 z = (i−3)×2.7; `ry` = −π/2(±1e-6).
  - `test('every figure machine front is reachable and does not overlap anything')`: storeLayout.test의 `distancesFrom`·`near` 방식(0.25 격자, 여유 0.35)으로 스폰에서 14대 앞자리 모두 도달; `OBSTACLES` 서로 안 겹침.
  - `test('players can walk between neighbouring figure machines')`: 광장 쪽 줄(f1) 이웃 기계 사이 한가운데가 걸을 수 있는 바닥(`free`).
  - `test('the box is longer than the bar gap but stands through it')`: `FIGURE.box.h > FIGURE.bars.gap` 그리고 `Math.hypot(FIGURE.box.w, FIGURE.box.d) + 0.016 < FIGURE.bars.gap`.
  - `decor.test.ts`: `'figure'` 장식이 없다(`DECOR.every(d => d.kind !== 'figure')`).
  - `server/tests/domain/test_shared_data.py::test_figures_come_from_shared_layout`: `len(FIGURES) == 14`, `FIGURES["F-1"]`의 x·z·ry, `front_spot(FIGURES["F-1"])` = (12.05, −8.1).
- [ ] **Step 2: 돌려 실패 확인** — `cd client && npx vitest run src/data src/world/decor.test.ts`, `cd server && uv run pytest tests/domain/test_shared_data.py -q` → FAIL(`FIGURES` 없음).
- [ ] **Step 3: 구현** — `store_layout.json`에 `"figures"` 14개(위 자리), `obstacles`에서 피규어 긴 두 상자를 빼고 기계마다 하나(f1 x [12.5, 13.9], f2 x [17.7, 23], z 기계 ±0.85 — 인형 기계와 같은 규칙), `decor`에서 피규어 두 줄 삭제. `decor.ts`의 피규어 장식 갈래(`figBase/figCover/figTop`, `SPACING.figure`)와 `DecorSpot.kind`의 `'figure'`를 지운다. `figures.ts`, 서버 `layout.py` 추가, `gen_shared.py`가 `shared/figure.json`도 `FIGURE`로 복사하게.
- [ ] **Step 4: 돌려 통과 확인** — 위 명령 PASS, 전체 `npx vitest run src`·`uv run pytest -q` PASS(옛 피규어 장식에 묶인 시험이 있으면 새 배치로).
- [ ] **Step 5: 커밋** `feat: 피규어 기계 14대 자리·공용 수치`

### Task 2: 서버 규칙 — 처음 상자, 경품, 보고 확인, 꽉 낀 상자

**Files:**
- Create: `server/src/toycrane/domain/figure.py`, `server/tests/domain/test_figure.py`

**Interfaces:**
- Consumes: `shared_data.FIGURE`, `CATALOG`(24종·효과 8가지).
- Produces: `BoxPose = tuple[float, float, float, float, float, float, float]`(x,y,z,qx,qy,qz,qw, 기계 좌표); `FigureState(box: BoxPose, still: int, last: BoxPose)`; `start_box(rng) -> BoxPose`; `roll_prize(rng) -> tuple[str, str]`(kind, rare: `""` | 효과 id | `"gold"`); `check_report(state, box, won) -> tuple[BoxPose, bool] | str`(정상이면 (잘라낸 자리, 빠짐), 아니면 거절 이유); `after_play(state, box, won, rng) -> tuple[FigureState, bool]`(새 상태, nudged).

- [ ] **Step 1: 실패하는 시험** (`test_figure.py`):
  - `test_start_box_lies_across_both_bars`: 시드 20개 — `abs(x) ≤ shift`, z 가운데 ±`shift`, y = `bars.y + bars.radius + box.d/2`(±1e-6, 상자는 그림 면 위로 눕힘), 돌림 각 ≤ `twist_deg`(요 각만).
  - `test_roll_prize_odds`: 시드 고정 20만 번 — 황금 0.4~0.6%, 희귀 2.7~3.3%, 희귀 효과는 `CATALOG` 8가지 모두 나옴, 캐릭터 24종 모두 각 3.5~4.8%.
  - `test_check_report_rejects_bad_numbers`: NaN·무한 → `"bad"`; 사원수 길이 0 → `"bad"`.
  - `test_check_report_clamps_inside_machine`: x = 3.0 → `±(play_half[0]+0.1)`로 잘림, y는 [0.3, 2.2].
  - `test_check_report_needs_box_below_bars_for_a_win`: `won=True`인데 y > `bars.y − box.h/2` → `"won"`; `won=False`인데 y < `bars.y − box.h` → `"won"`.
  - `test_stuck_box_gets_nudged`: 같은 자리(차이 1mm, 1°)로 8판 → 8번째 `after_play`가 `nudged=True`, 새 자리는 x·z로 `nudge.shift` 범위, 요 `twist_deg` 범위, y 그대로, `still`은 0으로.
  - `test_moving_box_resets_still`: 1cm 움직이면 `still` 0.
  - `test_win_places_a_new_box`: `won=True` → 새 상태 `box`가 `start_box` 규칙, `still` 0.
- [ ] **Step 2: 돌려 실패** — `cd server && uv run pytest tests/domain/test_figure.py -q` → ImportError.
- [ ] **Step 3: 구현** `domain/figure.py` — 순수 함수(무작위는 `rng: random.Random`을 받음). 꽉 낀 판단: 직전 판과 비교해 이동 < `stuck.move` 그리고 요 차이 < `stuck.turn`이면 `still += 1`, 아니면 0; `still ≥ stuck.plays`이면 옮김.
- [ ] **Step 4: 돌려 통과** — 위 명령 PASS.
- [ ] **Step 5: 커밋** `feat: 피규어 서버 규칙 — 처음 상자·경품·보고 확인·꽉 낀 상자`

### Task 3: 서버 저장·입장·판 시작·중계가 피규어 기계를 받는다 (규약 10)

**Files:**
- Create: `server/src/toycrane/adapter/outbound/do_storage_figure_boxes.py`, `server/src/toycrane/app/ports/output/figure_boxes_port.py`, `server/tests/adapter/test_figure_storage.py`
- Modify: `server/src/toycrane/app/use_cases/enter_interactor.py`(스냅샷 `figures`), `play_start_interactor.py`(`machine_spot`), `pose_interactor.py`·`adapter/inbound/ws/schemas/pose_schema.py`·`done_schema.py`·`play_schema`(피규어 번호 허용), `adapter/inbound/ws/schemas/server_messages.py`(`PROTOCOL = 10`, `welcome.figures`, `figure`), `adapter/outbound/ws_connections_adapter.py`(`broadcast_figure`), `shared/protocol_fixtures.json`(`v` 10, `server_figure`, welcome에 `figures`), 관련 시험

**Interfaces:**
- Produces: `FigureBoxesPort.load() -> dict[str, FigureState]`, `save(states)`; 없는 기계는 `start_box`로 채움(`ensure_figures(port, rng)`). DO 키 `figures_v1` = `{id: {"b": [7], "s": still, "l": [7]}}`.
- 서버 메시지: `welcome.figures: {id: [x,y,z,qx,qy,qz,qw]}`(소수 셋째), `{"t":"figure","m":id,"box":[7],"nudged":bool}`.

- [ ] **Step 1: 실패하는 시험**:
  - `test_figure_state_carries_no_prize`: `ensure_figures` 뒤 저장 JSON의 모든 값이 숫자 배열·정수뿐(문자열 없음), welcome 빌더 결과의 `figures` 값이 길이 7 숫자 배열.
  - `test_play_start_accepts_figure_machine`: F-1 앞자리에서 `play{m:"F-1"}` → `play_ok`(코인 1 차감), 3m 밖이면 `play_no` `far`.
  - `test_pose_relays_for_figure_machine`: F-1 잠근 사람의 `pose{m:"F-1", c:[4], d:[[0,…]]}` → 다른 사람에게 중계.
  - `test_welcome_matches_fixture`(기존) — 픽스처 `v` 10·`figures` 포함으로 갱신 후 통과.
- [ ] **Step 2: 돌려 실패** — `uv run pytest -q` → 새 시험 FAIL.
- [ ] **Step 3: 구현** — 판 잠금·코인·시간 규칙은 인형과 같은 것을 쓴다(`PLAY_SECONDS`·`CYCLE_SECONDS`). 스키마의 `m in MACHINES`를 `machine_spot(m) is not None`으로.
- [ ] **Step 4: 통과** — `uv run pytest -q && PYTHONPATH=src uv run lint-imports` PASS.
- [ ] **Step 5: 커밋** `feat: 피규어 기계 저장·입장·판 시작·중계 — 규약 10`

### Task 4: 서버 피규어 판 보고 — 확인·저장·경품·가방·결과

**Files:**
- Create: `server/src/toycrane/app/use_cases/figure_done_interactor.py`, `server/tests/app/use_cases/test_figure_done_interactor.py`
- Modify: `adapter/inbound/ws/handlers` 중 `done` 처리(피규어 번호면 피규어 쪽으로), `dependencies/*_provider.py`

**Interfaces:**
- Consumes: Task 2 `check_report`·`after_play`·`roll_prize`, Task 3 `FigureBoxesPort`, 기존 `PlayLockPort`·`BagPort.add(guest, kind, color, rare, zone, now)`·`send_bag`·`broadcast_result`.
- 화면 → 서버: 기존 `done{m, won:[0]|[], dolls:[[0,x,y,z,qx,qy,qz,qw]]}`(상자는 uid 0 한 줄). 서버 → 모두: 빠졌으면 `result{m,id,won:[[kind,0,rare,0]]}`, 늘 `figure{m, box, nudged}`.

- [ ] **Step 1: 실패하는 시험**:
  - `test_figure_win_rolls_prize_into_bag_zone_figure`: 빠짐 보고 → `bag.add(..., zone="figure")` 한 번, `send_bag` 뒤 `broadcast_result`의 `won[0]`이 `[kind, 0, rare, 0]`, `figure` 방송의 `box`는 새 처음 상자.
  - `test_figure_miss_saves_reported_box`: 안 빠짐 → 저장 상자 = 보고 자리(셋째 자리), `result`의 `won` 빈 목록.
  - `test_expired_lock_keeps_box`: 잠금 만료 뒤 보고 → `done_no`, 저장 상자 그대로.
  - `test_bad_report_keeps_box`: 막대 위인데 `won` → `done_no` `"won"`, 저장 그대로.
  - `test_prize_is_decided_only_at_win`: 빠지기 전 저장·방송 어디에도 kind 문자열이 없다(가짜 `rng`가 `roll_prize` 전에는 불리지 않음을 확인).
- [ ] **Step 2: 실패 확인** → FAIL.
- [ ] **Step 3: 구현** — 인형 `DoneInteractor._take`와 같은 잠금 확인(판 도중·같은 기계·만료 아님 → between으로).
- [ ] **Step 4: 통과** — `uv run pytest -q && PYTHONPATH=src uv run lint-imports`.
- [ ] **Step 5: 커밋** `feat: 피규어 판 보고 — 경품은 빠진 순간, 가방 zone figure`

### Task 5: 화면 규약 — `welcome.figures`, `figure` 메시지

**Files:** Modify `client/src/net/protocol.ts`, `client/src/net/protocol.test.ts`

**Interfaces:** Produces `type BoxWire = [number, number, number, number, number, number, number]`; `Welcome.figures: Record<string, BoxWire>`; `FigureMsg = { t: 'figure'; m: string; box: BoxWire; nudged: boolean }`; `PROTOCOL = 10`. 보고·중계는 기존 `encodeDone(m, won, dolls)`·`encodePose`를 uid 0으로 쓴다.

- [ ] **Step 1: 실패하는 시험** — `decodes every server fixture`(픽스처 갱신), `test('figure messages carry no prize')`: `figure` 디코드 결과의 키가 `t,m,box,nudged`뿐; 길이 6 `box`·문자열 섞인 `box`는 `null`; `PROTOCOL` 10.
- [ ] **Step 2~4:** `npx vitest run src/net` FAIL → 구현 → PASS.
- [ ] **Step 5: 커밋** `feat: 화면 규약 10 — 피규어 상자 메시지`

### Task 6: 피규어 물리 — 막대·상자·두 팔 집게·한 바퀴

**Files:**
- Create: `client/src/physics/figureWorld.ts`, `figureClaw.ts`, `figureCycle.ts`, `client/src/physics/figureCycle.test.ts`

**Interfaces:**
- Consumes: `loadRapier()`, `FIGURE`.
- Produces: `class FigureWorld(R, box: BoxWire)`: `step(dt)`, `boxPose(): BoxWire`, `fallen(): boolean`(상자가 `bars.y − box.h`보다 아래), `dispose()`. `class FigureClaw(R, world)`: `setHead(x, y, z)`, `close(phase: 'grip'|'lift'|'carry')`, `open()`, `armsOpen(): number`(0~1, 그림·중계용). `class FigureCycleRunner(world, claw, x, z)`: `advance(dt): boolean`, `clawPose(): [x,y,z,open]`, `done(): { won: boolean; box: BoxWire }`. `runFigureCycle(world, claw, x, z): {won, box}`(시뮬·시험용 동기판).
- 방식(조사한 시뮬레이터처럼, 코드는 쓰지 않음): 머리는 운동학, 팔 둘은 경첩(revolute) 동적 몸체이고 매 걸음 `τ = clamp(kp·(목표−θ) − kd·ω, −단계힘, +여는힘)`으로 민다(단계힘 = `claw.grip`/`lift`/`carry`). 상자는 직육면체(`box.w×box.d×box.h`, 질량 `box.mass`), 무게중심을 긴 변 방향으로 `box.com × h`만큼 치우침(`setAdditionalMassProperties`). 상자 모서리가 처음보다 `max_lift` 넘게 오르거나 상자 전체가 `max_clear` 넘게 뜨면 팔 힘을 0으로 하고 살짝 연다(미끄러짐). 막대 마찰 0.22, 상자 마찰 0.5, 되튐 0.04, 상자 CCD.
- 한 바퀴 단계: 내려감(`claw.descend` m/s, 머리가 닿거나 바닥 한계) → 오므림 0.6초 → 올림(`rest_y`까지) → 0.4초 → 놓음 → 집으로(`claw.home`) → 상자가 잠들거나 4초 → 끝.

- [ ] **Step 1: 실패하는 시험** (`figureCycle.test.ts`, `beforeAll(loadRapier)`):
  - `test('a fresh box rests across both bars')`: 처음 상자로 3초 → `fallen()` false, 자리 변화 < 2mm.
  - `test('grabbing the middle cannot lift the box off the bars')`: 상자 가운데 위에서 `runFigureCycle` 20번 → 한 번도 안 빠지고, 매 바퀴 상자 최대 높이 상승 < `max_lift + 0.005`.
  - `test('grabbing one end walks or tips the box')`: 안쪽 끝(상자 중심 z − h/2 + 0.02)에서 한 바퀴 → 상자 자리 또는 요가 처음과 달라짐(> 3mm 또는 > 1°).
  - `test('the same play gives the same box twice')`: 같은 처음 상자·같은 x,z로 두 번 → `box` 정확히 같음(`toEqual`).
  - `test('a standing box drops between the bars')`: 상자를 세워(긴 변 수직) 막대 사이 위에 놓고 1초 → `fallen()` true.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/physics/figureCycle.test.ts` → FAIL(모듈 없음).
- [ ] **Step 3: 구현** — 인형 `MachineWorld`처럼 걸음 1/120, 남은 시간 버림, 몸체는 정해진 순서로.
- [ ] **Step 4: 통과** — 위 명령 PASS.
- [ ] **Step 5: 커밋** `feat: 피규어 물리 — 막대·상자·두 팔 집게`

### Task 7: 판수 맞추기 시뮬 — 4~15판, 두 공략, 마구 누르기

**Files:**
- Create: `client/sim/figureBot.ts`, `client/sim/figure.test.ts`
- Modify: `shared/figure.json`(맞춘 값), `server/src/toycrane/domain/shared_data.py`(재생성)

**Interfaces:**
- Produces: `botPlay(state: BoxWire, rng, strategy: 'smart'|'vertical'|'rotate'|'masher'): {x, z}` — 버튼 ①·② 거리로 바꿀 수 있는 자리만(① x는 `home[0]`부터 오른쪽, ② z는 앞에서 안쪽); `playsToWin(R, strategy, seed, max = 60): number`(처음 상자부터 빠질 때까지, 꽉 낀 상자 규칙 포함 — 서버 `after_play`와 같은 규칙을 시뮬 안에 복사).
- 똑똑한 봇: 상자 자세를 보고 세로로 빠뜨리기(안쪽 끝 걸기 → 앞 끝 내려앉음 → 높은 끝 밀기)와 돌려서 빠뜨리기(모서리 누르기)를 고른다. 사람 눈대중처럼 자리마다 ±1.5cm 무작위 오차.

- [ ] **Step 1: 실패하는 시험** (`figure.test.ts`, `SIM_TRIALS` 기본 200 상자):
  - `test('a sensible player wins in about 4 to 15 plays')`: `smart` 판수의 10%선 3~5, 90%선 12~18.
  - `test('both shop techniques work')`: `vertical`만, `rotate`만 각각 90% 이상이 30판 안에 빠짐.
  - `test('mashing buttons takes far longer')`: `masher` 중앙값 ≥ `smart` 중앙값 × 2.
  - `test('nudged box stays on the bars')`: 꽉 낀 자리 20개에 서버 규칙대로 옮긴 뒤 3초 → 하나도 안 빠짐.
- [ ] **Step 2: 실패 확인** — `npx vitest run --config vitest.sim.config.ts sim/figure.test.ts` → FAIL.
- [ ] **Step 3: 맞추기** — `figure.json`의 `box.mass`·`box.com`·`claw.grip/lift/carry`·`max_lift`·`bars.gap`만 움직여(시뮬 결과를 `SIM_OUT`으로 파일에) 통과시킨다. 장부에 처음 값 → 맞춘 값을 남긴다.
- [ ] **Step 4: 통과** — 위 명령 PASS(`SIM_TRIALS=500`으로 한 번 더 PASS), `cd server && uv run python scripts/gen_shared.py && uv run pytest -q` PASS.
- [ ] **Step 5: 커밋** `feat: 피규어 판수 맞추기 — 4~15판, 두 공략`

### Task 8: 버튼 ①② 판과 조작대 버튼

**Files:**
- Create: `client/src/game/figureSession.ts`, `client/src/game/figureSession.test.ts`, `client/src/world/figureControls.ts`, `client/src/world/figureControls.test.ts`

**Interfaces:**
- Produces: `type FigurePhase = 'one' | 'moving-one' | 'two' | 'moving-two' | 'cycle'`; `class FigureSession(machineId, limit, startedAt)`: `claw: {x, z}`(`FIGURE.claw.home`에서 시작), `phase`, `press(b: 1|2): boolean`, `release(b: 1|2, now): 'drop' | null`, `update(dt, now): 'drop' | null`(①은 +x로 `play_half[0]`까지, ②는 −z로 `-play_half[1]`까지, 속도 `claw.speed`; 남은 시간 0이면 지금 자리에서 `'drop'`), `remaining(now)`. `FIGURE_CONTROLS = { one: [0.12, 0.925, 0.66], two: [0.32, 0.925, 0.66] }`(기계 좌표, fde3f11과 같은 자리). `buildFigureControls(anchor)`: `pick(ray): 1|2|null`, `setPhase(phase)`(다음에 누를 버튼만 빛나고 숨쉼), `setPressed(b|null)`(1.2cm 눌림), `dispose()`.
- 참고: 커밋 `fde3f11`의 `PlaySession`(버튼판)·`MachineControls`(① 빨강 0xff3b5c, ② 파랑 0x3b8bff).

- [ ] **Step 1: 실패하는 시험**:
  - `test('button one moves right only while held and hands over to two')`: press(1) → 0.5초 update → x 증가; release(1) → phase `'two'`, 이후 update로 x 그대로.
  - `test('pressing two first does nothing')`: phase `'one'`에서 press(2) false, claw 그대로.
  - `test('each button works once')`: ①을 놓은 뒤 press(1) false; ②를 놓으면 `'drop'` 한 번, 두 번째 release(2)는 null.
  - `test('time out drops where the claw is')`: 시간 다 되면 update가 `'drop'`(① 누르는 중이었어도 그 자리).
  - `test('claw stops at the play edge')`: ①을 10초 눌러도 x ≤ `play_half[0]`.
  - `figureControls.test.ts` `test('picks button one and two and lights the next one')`: 버튼 위치로 쏜 광선 → 1·2, `setPhase('two')` 뒤 ②만 빛남.
- [ ] **Step 2~4:** `npx vitest run src/game/figureSession.test.ts src/world/figureControls.test.ts` FAIL → 구현 → PASS.
- [ ] **Step 5: 커밋** `feat: 피규어 버튼 ①② 판과 조작대`

### Task 9: 피규어 기계 그림 — 14대, 막대·상자·집게·진열대

**Files:** Create `client/src/world/figureZone.ts`, `client/src/world/figureZone.test.ts`; Modify `client/src/world/storeScene.ts`(필요하면 구역 칠·글씨만)

**Interfaces:**
- Produces: `buildFigureZone(scene): FigureZone` — `setBox(id, box: BoxWire)`, `boxOf(id): BoxWire`, `worldOf(id): THREE.Object3D`(기계 기준점), `clawOf(id)`(머리·팔 그룹), `setClaw(id, x, y, z, open)`, `hideControls(id, hidden)`, `occluders: Occluder[]`(줄마다, 기계마다 상자 `boxes`), `update(t)`.
- 모양: 그래픽 설계 §3.5 — 양옆 흰 기둥 죔쇠에 긴 쇠막대 2개, 막대 아래 큰 인쇄 그림 바닥, 뒤쪽 계단 진열대에 랜덤 상자 세워 쌓기, 각진 흰 캡슐 몸통(검은·빨간 띠, 앞 스티커) + 납작한 반투명 판 팔 두 개(바깥 → 아래 → 안쪽 갈고리). 상자 그림은 모두 같은 랜덤 상자('toycrane 피규어 컬렉션', 물음표 실루엣). 기계 정지 부분은 줄마다 합쳐 그리고(인형 `bigZone`처럼 `materialCloner`), 상자 14개는 인스턴스 한 덩어리.

- [ ] **Step 1: 실패하는 시험**:
  - `test('fourteen figure machines draw in a few meshes')`: 장면 메시 수 ≤ 30.
  - `test('every box shows the same blind box art')`: 상자 재질 하나, 상자 그림 캔버스에 캐릭터 이름 글자가 없다(`drawnTexts`에 24종 이름 없음).
  - `test('setBox moves the box of that machine only')`.
  - `test('rows fade only when a machine really hides me')`: decor.test의 `fadeAt`와 같은 방식 — 두 줄 사이 통로(x 15.8)에 서면 안 흐림.
- [ ] **Step 2~4:** `npx vitest run src/world/figureZone.test.ts` FAIL → 구현 → PASS.
- [ ] **Step 5: 커밋** `feat: 피규어 기계 그림 14대`

### Task 10: 시점 — 정면 → ①을 떼면 옆 대각선

**Files:** Create `client/src/game/figureCamera.ts`, `client/src/game/figureCamera.test.ts`

**Interfaces:** Produces `figureCameraPose(spot: FigureSpot, side: number): { pos: THREE.Vector3; look: THREE.Vector3 }`(side 0 정면 = 인형 기계와 같은 기계 좌표 눈 (0, 1.7, 2.0)·봄 (0, 1.3, 0); side 1 옆 대각선 = 눈 (1.45, 1.55, 1.15)·봄 상자 가운데 (0, 1.05, 0)); `class SideBlend { start(now); stop(now); value(now): number }`(0.6초 smoothstep).

- [ ] **Step 1: 실패하는 시험**:
  - `test('side view looks across the bars from the right')`: side 1의 시선 수평 방향이 기계 앞(+z)과 30° 이상 벌어짐.
  - `test('button two stays on screen from the side')`: side 1 카메라(fov 50, 세로·가로 화면 둘 다)로 ② 버튼 자리를 투영 → NDC [−1, 1] 안.
  - `test('blend moves only between presses')`: `start` 뒤 0.3초 값 0~1 사이, 0.6초 뒤 1.
- [ ] **Step 2~4:** FAIL → 구현 → PASS (`npx vitest run src/game/figureCamera.test.ts`).
- [ ] **Step 5: 커밋** `feat: 피규어 시점 — 정면에서 옆 대각선`

### Task 11: 피규어 모양과 상자 까기

**Files:** Create `client/src/world/figureModel.ts`, `figureModel.test.ts`, `client/src/world/figureReveal.ts`, `figureReveal.test.ts`; Modify `client/src/world/copy.ts`(문구)

**Interfaces:**
- Produces: `makeFigure(kind: string, rare: string): THREE.Group`(받침대 포함; `rare` `''`·효과 id·`'gold'`); `figureName(kind, rare): string` — 일반 `'토끼 피규어'`, 희귀 `'별빛 토끼 피규어'`(효과 이름 + 캐릭터), 황금 `'황금 토끼 피규어'`; `playReveal(scene, at: THREE.Vector3, kind, rare, done: () => void): { update(dt): boolean }`.
- 모양: `makePlush(kind, {...PLAIN, rare, face: 1})` → 꼭짓점 색 끔, 재질을 `MeshStandardMaterial`(색·그림 그대로, 거칠기 0.62)로, 외곽선 유지(시안 `client/src/spike/figure.ts`의 C). 황금은 금속감 0.8·거칠기 0.35 금색. 받침대 둥근 판.
- 연출: 상자가 열리고 피규어가 받침대째 올라옴. 일반은 효과 없이 이름 카드만. 희귀는 피규어 둘레 제자리 반짝임 + 글자 이름표 '희귀!'. 황금은 금빛 제자리 반짝임 + '황금!'. 도는 작은 점 금지.

- [ ] **Step 1: 실패하는 시험**:
  - `test('figures are matte vinyl without fabric creases')`: 일반 피규어 몸 재질이 `MeshStandardMaterial`, `vertexColors` false, 거칠기 ≥ 0.55; 외곽선(뒷면) 메시 있음.
  - `test('gold figure is lightly glossy gold')`: 금속감 ≥ 0.6, 거칠기 0.25~0.45.
  - `test('figure names read naturally')`: 위 세 이름, 가운데 점·일본어 없음.
  - `test('a normal reveal shows no effect')`: 일반 연출이 만든 효과 물체 0개, 희귀·황금은 이름표 글자('희귀!'·'황금!')를 그림.
- [ ] **Step 2~4:** FAIL → 구현 → PASS.
- [ ] **Step 5: 커밋** `feat: 피규어 모양과 상자 까기`

### Task 12: 연결 — 매장에서 피규어 한 판, 구경, 결과, e2e

**Files:** Modify `client/src/main.ts`, `client/src/world/storeScene.ts`(필요하면); Create `client/e2e/figure.mjs`; Modify `README.md`, `client/e2e/perf-hall.json`

**Interfaces:**
- Consumes: Task 1~11 전부.
- Produces(e2e 고리): `window.__toycrane.buttonAt(b: 1|2): {x, y} | null`, `figureBox(id): BoxWire`, `figureSide(): number`(지금 옆 시점 정도).
- 흐름: `nearestMachine`과 `nearestFigure` 중 가까운 쪽으로 판을 고른다. 피규어 기계 앞이면 인형과 같은 '한 판 하기'·이어 하기 버튼 → `play_ok`이면 `FigureSession` + 조작대 버튼 + 정면 시점 → ① 떼면 `SideBlend.start` → ② 떼면 `FigureCycleRunner`(물리 `figureWorld`는 그 기계의 지금 상자) → 매 프레임 `PoseSender`로 `[x,y,z,open]` + 상자(uid 0) → 끝나면 `encodeDone(m, won ? [0] : [], [{uid:0,…}])` → `result`(피규어 번호면 `playReveal` + 승리 카드 '가방 n개째' + 희귀·황금이면 탑 알림 `'★ 희귀 피규어! ★'`/`'★★ 황금 피규어! ★★'`, 둘째 줄 `'<닉> 님이 <이름>을 뽑았어요'`) → `figure` 메시지로 상자 자리, `nudged`면 안내 `'직원이 상자를 살짝 옮겨 줬어요'` → 판이 끝나면 `SideBlend.stop`. 구경꾼은 12m 안이면 `pose`로 집게·상자.

- [ ] **Step 1: e2e 먼저** — `client/e2e/figure.mjs <port> <url>`: 코인 받기 → F-1 앞 → '한 판 하기' → `buttonAt(1)` 0.6초 누름·뗌 → `figureSide()`가 0.6초 뒤 > 0.9 → `buttonAt(2)` 0.5초 → 관찰자가 `result`와 `figure{m:'F-1'}`를 받고, 받은 `box` = 화면 `figureBox('F-1')`(1cm 안), 판 전 관찰자 메시지 어디에도 경품 문자열 없음, 콘솔 오류 0 → `PASS figure`.
- [ ] **Step 2: 돌려 실패** — 로컬 개발 서버 8787 + 헤드리스 크롬 9461: `node e2e/figure.mjs 9461 http://localhost:8787` → FAIL.
- [ ] **Step 3: 연결 구현** (`main.ts`).
- [ ] **Step 4: 확인** — `node e2e/figure.mjs …` PASS; 인형 e2e `play`·`run`·`watch` PASS; `determinism`(빈 저장소 서버) PASS; `perf.mjs` 휴대폰 관문 통과(피규어 기계 앞 시점 수치 추가); 전체 `npx vitest run src && npx tsc --noEmit -p . && npm run build`, `cd server && uv run pytest -q && PYTHONPATH=src uv run lint-imports`, `npx vitest run --config vitest.sim.config.ts sim/scenes.test.ts sim/figure.test.ts` PASS; PC·휴대폰 스크린샷(피규어 구역, 판 중 정면·옆, 상자 까기 일반·희귀·황금 — 희귀·황금은 개발용 강제 값으로).
- [ ] **Step 5: 커밋** `feat: 피규어 뽑기 연결 — 한 판, 구경, 상자 까기, e2e` + README 확인 기록 '9단계 피규어 뽑기'.

### Task 13: 최종 검토와 배포

- [ ] 전체 브랜치 리뷰(가장 유능한 모델) → Critical·Important 한 번에 고치기(각 RED→GREEN) → **사용자에게 배포 허락**(알릴 것: 규약 10이라 열린 화면 새로 고침, 인형 기계 그대로) → `cd server && CI=1 uv run pywrangler deploy` → 라이브 `figure.mjs`·`play`·`run`·스크린샷·콘솔 오류 → README에 Version.
