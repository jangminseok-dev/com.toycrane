# toycrane 1단계 — 함께 걷는 매장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 닉네임을 정하고 들어오면 자리가 있는 매장에 배정되고, 같은 매장의 사람들이 26m 정사각형 매장 안을 함께 걸어 다니는 모습이 실시간으로 보인다. 실제 Cloudflare 무료 계정에 배포된 주소로 동작한다.

**Architecture:** 서버는 Python Workers(pywrangler). HTTP 요청은 Worker 진입점이 슬라이스별 라우터로 나누고, 매장 하나는 Durable Object `Store` 하나가 맡아 웹소켓 hibernation으로 50명의 이동을 중계한다. 게스트·매장 인원은 D1에 둔다. 화면은 TypeScript + three.js(Vite) 빌드 결과를 같은 Worker의 정적 자산으로 내보낸다(설계 §9.1의 Pages 대신 — 같은 무료 범위, 주소 하나라 CORS 없음). 서버 코드는 헥사고날 + 수직 슬라이스 1:1 규칙을 따른다.

**Tech Stack:** Python 3.14 (Pyodide 런타임) · uv · workers-py(pywrangler) · pytest · pytest-asyncio · import-linter · Cloudflare Workers / Durable Objects(SQLite) / D1 / Static Assets · Node 22+ · TypeScript · Vite · three@0.169.0 · vitest

**Spec:** `docs/superpowers/specs/2026-10-30-toycrane-design.md`

## 전체 로드맵 (이 문서는 1단계)

설계가 여러 하위 시스템을 담고 있어 계획을 5단계로 나눈다. 각 단계는 그 자체로 동작하는 결과물을 낸다.

1. **함께 걷는 매장 (이 문서)** — 계정·배포 확인, 저장소 뼈대, 게스트·닉네임, 매장 배정·만석(정원), 실시간 이동, 매장 겉모습
2. 코인 교환소 + 큰인형 기계 한 판 — 실제 줄, 기계 1인 잠금, 조이스틱·내리기, 서버 판정(부위×희귀도), 모션 8종, 가방, 당첨 카드, 희귀 전광판
3. 도감 + 콘텐츠 — 인형 목록 데이터 파일, 28종 × 큰인형·미니·피규어, 미니·피규어 구역 기계, 도감 NPC·화면, 희귀 진열장, 이어하기 코드
4. 재미 요소 — 피버, 근성 게이지, 더블 집기, 오늘의 기계·한정, 업고 다니기, 구경 + 리액션
5. 공개 준비 — 자랑 카드(R2 + 링크 미리보기), 무료 예산 시간당 배분·만석, IP당 접속 제한, 휴대폰 성능 다듬기, 방문 측정

## Global Constraints

- 무료 범위만 쓴다. 유료 전환 금지. 한도에 닿으면 "만석"(설계 §9.1).
- 서버 언어 파이썬(Python Workers). 런타임 파이썬 3.14. 로컬 개발·배포는 `uv run pywrangler dev|deploy`.
- Durable Object는 SQLite 기반만(`new_sqlite_classes`) — 무료 계정 조건.
- 웹소켓은 hibernation API만 쓴다: `self.ctx.acceptWebSocket(ws)`, `self.ctx.getWebSockets()`, `webSocketMessage(self, ws, message)`, `webSocketClose(self, ws, code, reason, wasClean)`. `setTimeout`·`setInterval`·알람으로 매장을 깨워 두지 않는다(잠들지 못하면 무료 사용 시간이 샌다).
- 잠들면 DO 메모리가 지워진다. 접속별 상태는 웹소켓 attachment(직렬화 16KB 이하)에, 매장 상태는 DO 저장소에 둔다.
- 닫기 코드 1005·1006을 그대로 `ws.close`에 넘기지 않는다 → 1000으로 바꿔 닫는다.
- 매장 정원 50명. 매장 크기 26m 정사각형(바닥 이동 한계 ±12.6m), 가운데 허브 10m, 허브 한가운데 전광판 탑(반폭 1.3m), 스폰 링 반지름 2.4m.
- 걷는 속도 3.2m/s. 위치는 "입력이 바뀔 때"와 "움직이는 중 3초마다"에만 보낸다.
- 로그인 없음. 게스트 ID는 서버가 만든 UUID, 브라우저 `localStorage` 키 `toycrane.guestId`에 저장.
- 닉네임: 앞뒤 공백 제거, 연속 공백은 하나로, 1~10자, 제어 문자 금지.
- 서버 구조: `adapter → app → domain` 단방향. app·domain은 `js`·`workers`·`pyodide`를 import하지 않는다. 런타임 모듈을 import하는 곳은 `entry.py`, `adapter/runtime.py`, `adapter/inbound/ws/store_durable_object.py` 셋뿐(나머지 adapter는 테스트에서 import된다).
- 슬라이스 1:1: 슬라이스마다 router(또는 ws handler)·schema·dto·`ports/input/<이름>_use_case`·`ports/output/<이름>_*_port`·`<이름>_interactor`·`<이름>_provider`·`test_<이름>_interactor` 각 1개. 한 파일에 여러 슬라이스 금지. HTTP 표면 없는 슬라이스는 router 대신 ws handler. 저장소 포트는 도메인어 이름 허용(`guest_repository`).
- HTTP 라우터마다 `GET <prefix>/myself` — 배역·은유가 아니라 실제 기능(엔드포인트·데이터·제약)을 설명한다. 앱 대표 자기소개 `GET /api/myself`는 전체 단면(schema→DTO→input port→interactor→record port→log adapter→provider→test)을 관통한다.
- 인형·상표: 기존 캐릭터·상표명 사용 금지.
- 화면 겉모습 기준: `docs/reference/prototypes/spike-arcade-big-v3.html`(매장·아바타), `map-layout-v3.html`(배치).

## Review Focus

1. **배포하면 모든 웹소켓이 끊긴다** — 화면은 끊기면 0.5·1·2·4·8초 간격으로 다시 배정받고 다시 접속해야 하며, 사용자는 "다시 연결 중" 표시만 본다. (Task 9 재접속 테스트)
2. **조용하다가 매장이 잠들었다 깬다** — 깨어난 뒤에도 접속자 목록·이동 중계가 그대로여야 한다. (Task 5 스모크 `idle`)
3. **같은 게스트가 탭 두 개로 들어온다** — 먼저 들어온 접속을 닫기 코드 4003으로 내보내고 유령 캐릭터가 남지 않아야 한다. (Task 5 테스트)
4. **이상한 메시지** — JSON이 아니거나, 모르는 종류이거나, 숫자 대신 문자·무한대가 온다 → 무시하고 접속은 유지. (Task 6 스키마 테스트)
5. **닉네임 극단값** — 공백만, 11자 이상, 제어 문자 → 400 응답, 서버 오류 없음. 이모지·한글은 허용. (Task 3 테스트)

---

## 파일 구조

```
com.toycrane/
├── .gitignore
├── README.md                                  # 개발·배포 명령 모음
├── docs/reference/prototypes/                 # 브레인스토밍 시제품 사본(겉모습 기준)
├── shared/protocol_fixtures.json              # 서버·화면이 같이 읽는 메시지 견본(계약 테스트)
├── server/
│   ├── pyproject.toml  .python-version  wrangler.jsonc  .importlinter
│   ├── migrations/0001_init.sql
│   ├── scripts/smoke.mjs                      # pywrangler dev/배포 주소에 붙는 스모크
│   ├── src/
│   │   ├── entry.py                           # Default(WorkerEntrypoint) + Store DO 내보내기
│   │   └── toycrane/
│   │       ├── domain/
│   │       │   ├── value_objects/{position,heading}.py
│   │       │   ├── entities/player.py
│   │       │   ├── nickname.py                # 닉네임 규칙
│   │       │   ├── store_rules.py             # 정원·바닥·스폰·매장 고르기
│   │       │   └── movement.py                # 이동 검증
│   │       ├── app/
│   │       │   ├── dtos/{manager,guest,admission,enter,move,leave}_dto.py, player_view.py
│   │       │   ├── ports/input/{manager,guest,admission,enter,move,leave}_use_case.py
│   │       │   ├── ports/output/manager_record_port.py, guest_repository.py,
│   │       │   │   occupancy_port.py, player_registry_port.py, connections_port.py
│   │       │   └── use_cases/{manager,guest,admission,enter,move,leave}_interactor.py
│   │       ├── adapter/
│   │       │   ├── runtime.py                 # Request/Response·JsProxy 변환(런타임 의존은 여기만)
│   │       │   ├── inbound/http/http_router.py, manager_router.py, guest_router.py,
│   │       │   │   admission_router.py, store_gateway_router.py
│   │       │   ├── inbound/http/schemas/{manager,guest,admission}_schema.py
│   │       │   ├── inbound/ws/store_durable_object.py, ws_router.py,
│   │       │   │   enter_handler.py, move_handler.py, leave_handler.py
│   │       │   ├── inbound/ws/schemas/{move_schema,server_messages}.py
│   │       │   └── outbound/log_manager_record_adapter.py, d1_guest_repository.py,
│   │       │       d1_occupancy_adapter.py, attachment_player_registry.py, ws_connections_adapter.py
│   │       └── dependencies/{manager,guest,admission,enter,move,leave}_provider.py
│   └── tests/
│       ├── fakes.py
│       ├── test_architecture.py
│       ├── domain/test_{nickname,store_rules,movement}.py
│       ├── adapter/test_{guest_schema,move_schema,server_messages}.py
│       └── app/use_cases/test_{manager,guest,admission,enter,move,leave}_interactor.py
└── client/
    ├── package.json  tsconfig.json  vite.config.ts  index.html
    └── src/
        ├── main.ts
        ├── net/{protocol,api,storeSocket,reconnect}.ts
        ├── game/{movement,inputSampler,remote,localPlayer}.ts
        ├── input/{keyboard,joystick}.ts
        ├── world/{layout,storeScene,avatar,label}.ts
        ├── ui/{entry,status}.ts
        └── **/*.test.ts
```

## 메시지 형식 (서버·화면 공통)

| 방향 | 메시지 |
|---|---|
| 화면→서버 | `{"t":"move","x":1.5,"z":-2.0,"dx":0.707,"dz":-0.707}` (x,z 소수 2자리, dx,dz 소수 3자리, 멈춤은 dx=dz=0) |
| 서버→화면 | `{"t":"welcome","store":1,"you":P,"players":[P...]}` — 들어온 사람에게 |
| 서버→화면 | `{"t":"join","p":P}` / `{"t":"move","id":"...","x":..,"z":..,"dx":..,"dz":..}` / `{"t":"leave","id":"..."}` — 다른 사람에게 |
| 서버→화면 | `{"t":"correct","x":..,"z":..}` — 보낸 위치가 말이 안 될 때 본인에게 |
| P (플레이어) | `{"id":"<uuid>","nick":"말랑 토끼","color":3,"x":2.4,"z":0.0,"dx":0,"dz":0}` |
| 닫기 코드 | 4001 만석 · 4002 모르는 게스트 · 4003 다른 창에서 접속 |

HTTP: `POST /api/guest {nickname}` → 201 `{guestId,nickname,color}` / 400 `{"error":"nickname"}` · `GET /api/guest/{id}` → 200 / 404 · `POST /api/admission {guestId}` → 200 `{"store":n}` 또는 200 `{"full":true}` / 404 · `GET /ws/store/{n}?guest={id}` → 웹소켓 · 각 접두사 `/myself`.

---

### Task 1: Cloudflare 무료 계정에서 파이썬 DO 실배포 확인 (게이트)

설계 §11-1. 여기서 안 되면 멈추고 사용자와 상의한다(대안: 서버 TypeScript, Oracle 무료 VM + FastAPI).

**Files:**
- Modify: `spikes/py-do-hibernation/wrangler.toml` (필요 시 이름만)

**Interfaces:**
- Consumes: 없음
- Produces: 로그인된 wrangler, 확인 결과 한 줄(README에 기록은 Task 2)

- [ ] **Step 1: 사용자에게 Cloudflare 무료 계정 생성을 요청한다** (이메일 가입, 카드 등록 없이 Workers Free). 사용자가 터미널에서 `! npx wrangler login`을 실행해 로그인한다.

- [ ] **Step 2: uv를 설치한다**

Run: `brew install uv && uv --version`
Expected: `uv 0.x` 버전 출력

- [ ] **Step 3: 시험 코드를 배포한다**

Run: `cd spikes/py-do-hibernation && npx wrangler@latest deploy`
Expected: `https://toycrane-py-do-spike.<계정>.workers.dev` 주소 출력. 무료 요금제에서 SQLite DO 마이그레이션 오류 없음.

- [ ] **Step 4: 실제 환경에서 hibernation을 확인한다**

Run: `node probe.mjs wss://toycrane-py-do-spike.<계정>.workers.dev/ws 20`
Expected: 두 번째 메시지의 `inst`·`born` 값이 첫 번째와 다르고 `handled=1`, `conns=2`, 두 클라이언트 모두 수신, 끊김 코드 1000.

- [ ] **Step 5: 확인 후 시험 Worker를 지운다**

Run: `npx wrangler delete toycrane-py-do-spike`
Expected: 삭제 완료. (커밋 없음 — 저장소는 Task 2에서 만든다)

---

### Task 2: 저장소 뼈대 + 앱 대표 자기소개 `GET /api/myself`

**Files:**
- Create: `.gitignore`, `README.md`, `docs/reference/prototypes/{spike-arcade-big-v3,map-layout-v3,dogam}.html` (`.superpowers/brainstorm/63849-1793340653/content/`에서 복사)
- Create: `server/pyproject.toml`, `server/.python-version`(`3.14`), `server/wrangler.jsonc`, `server/.importlinter`
- Create: `server/src/entry.py`, `server/src/toycrane/**/__init__.py`, `server/src/toycrane/adapter/runtime.py`
- Create: manager 슬라이스 전체 — `app/dtos/manager_dto.py`, `app/ports/input/manager_use_case.py`, `app/ports/output/manager_record_port.py`, `app/use_cases/manager_interactor.py`, `adapter/outbound/log_manager_record_adapter.py`, `adapter/inbound/http/schemas/manager_schema.py`, `adapter/inbound/http/manager_router.py`, `adapter/inbound/http/http_router.py`, `dependencies/manager_provider.py`
- Create: `server/tests/fakes.py`, `server/tests/test_architecture.py`, `server/tests/app/use_cases/test_manager_interactor.py`, `server/scripts/smoke.mjs`
- Create: `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/index.html`, `client/src/main.ts`

**Interfaces:**
- Produces:
  - `toycrane.adapter.runtime`: `async def read_json(request) -> dict | None` (파싱 실패 None), `def json_response(data: dict, status: int = 200) -> Response`, `def path_of(request) -> str`, `def query_param(request, name: str) -> str | None`, `def to_py(value)` (JsProxy면 `.to_py()`, 아니면 그대로)
  - `toycrane.adapter.inbound.http.http_router`: `async def route(request, env) -> Response` — `(메서드, 경로)` 표로 각 라우터 함수에 넘김, 없으면 404 `{"error":"not_found"}`
  - `ManagerQuery(name: str)`, `ManagerResponse(name: str, introduction: str, endpoints: tuple[str, ...])` (frozen dataclass)
  - `ManagerUseCase.introduce_myself(query: ManagerQuery) -> ManagerResponse` (async)
  - `ManagerRecordPort.record(subject: str, note: str) -> None` (async)
  - `tests/fakes.py`: `FakeRecordPort` (`calls: list[tuple[str, str]]`) — 이후 태스크의 가짜 포트도 이 파일에 추가

- [ ] **Step 1: git 저장소와 무시 목록을 만든다**

`git init`. `.gitignore`: `node_modules/`, `dist/`, `.venv/`, `__pycache__/`, `.wrangler/`, `.superpowers/`, `server/python_modules/`, `.DS_Store`. 시제품 3개를 `docs/reference/prototypes/`로 복사.

- [ ] **Step 2: 서버 프로젝트를 만든다**

`cd server && uvx --from workers-py pywrangler init`으로 뼈대를 받은 뒤 이름을 `toycrane`으로 맞춘다(대화형이라 막히면 아래 내용으로 직접 만든다). `pyproject.toml` dev 의존성: `workers-py`, `workers-runtime-sdk`, `pytest`, `pytest-asyncio`, `import-linter`. `[tool.pytest.ini_options] asyncio_mode = "auto"`, `pythonpath = ["src"]`. `wrangler.jsonc`:

```jsonc
{
  "name": "toycrane",
  "main": "src/entry.py",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["python_workers"],
  "assets": { "directory": "../client/dist", "not_found_handling": "single-page-application", "run_worker_first": ["/api/*", "/ws/*"] },
  "durable_objects": { "bindings": [{ "name": "STORE", "class_name": "Store" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Store"] }],
  "vars": { "MAX_STORES": "4" }
}
```
(`Store` 클래스와 D1은 Task 3·5에서 채운다. 이 태스크에서는 `Store`를 빈 DurableObject로 둔다.)

- [ ] **Step 3: 계층 규칙 테스트를 먼저 쓴다**

`server/.importlinter`: `root_packages = toycrane`, `include_external_packages = True`, 계약 ① layers 위에서부터 `toycrane.adapter : toycrane.dependencies`(같은 층, 서로 import 허용) → `toycrane.app` → `toycrane.domain`, 계약 ② forbidden `source_modules = toycrane.app, toycrane.domain` / `forbidden_modules = js, workers, pyodide`.

`tests/test_architecture.py`:
```python
def test_app_and_domain_never_import_runtime_modules():
    offenders = imports_under(SRC / "toycrane" / "app", SRC / "toycrane" / "domain", names={"js", "workers", "pyodide"})
    assert offenders == []
```
(`imports_under`는 `ast`로 `import`/`from` 첫 마디를 모으는 테스트 내 헬퍼. import-linter가 설치 안 된 외부 모듈을 못 잡는 경우의 보험.)

- [ ] **Step 4: 자기소개 인터랙터 테스트를 쓴다**

```python
async def test_introduce_myself_records_and_describes_real_endpoints():
    record = FakeRecordPort()
    result = await ManagerInteractor(record).introduce_myself(ManagerQuery(name="toycrane 매장 서버"))
    assert result.name == "toycrane 매장 서버"
    assert "POST /api/guest" in " ".join(result.endpoints)
    assert "/ws/store/{n}" in " ".join(result.endpoints)
    assert record.calls == [("introduce_myself", "toycrane 매장 서버 자기소개 관찰")]
```

- [ ] **Step 5: 테스트가 실패하는지 본다**

Run: `cd server && uv run pytest -q`
Expected: FAIL — `ModuleNotFoundError: toycrane.app.use_cases.manager_interactor`

- [ ] **Step 6: manager 단면과 진입점을 구현한다**

`ManagerInteractor.introduce_myself` 소개문(실기능): "온라인 인형뽑기방 toycrane의 서버입니다. 게스트 만들기·매장 배정·매장 웹소켓(이동 중계)을 제공합니다. 로그인은 없고 매장 하나에 50명까지 들어갑니다." `endpoints`: `GET /api/myself`, `POST /api/guest`, `GET /api/guest/{id}`, `POST /api/admission`, `GET /ws/store/{n}?guest={id}`. `manager_router.introduce(request, env)`는 스키마 `to_json`으로 `{"name","introduction","endpoints"}` 응답. `LogManagerRecordAdapter`는 `print`로 남긴다. `entry.py`의 `Default.fetch`는 `route(request, self.env)`.

- [ ] **Step 7: 테스트·계층 검사를 돌린다**

Run: `cd server && uv run pytest -q && uv run lint-imports`
Expected: 테스트 PASS, `Contracts: 2 kept, 0 broken.`

- [ ] **Step 8: 화면 뼈대를 만든다**

`client/`: Vite vanilla-ts. 의존성 `three@0.169.0`, dev `vite`, `vitest`, `typescript`, `@types/three`. `vite.config.ts` dev 프록시 `/api`·`/ws` → `http://localhost:8787`(`ws: true`). `main.ts`는 `fetch('/api/myself')` 결과의 `name`을 화면에 찍는다(다음 태스크에서 갈아엎음). `package.json` scripts: `dev`, `build`, `test` (`vitest run`).

- [ ] **Step 9: 로컬에서 끝까지 붙여 본다**

Run: `npm --prefix client install && npm --prefix client run build && (cd server && uv run pywrangler dev)` 그리고 다른 터미널에서 `node server/scripts/smoke.mjs http://localhost:8787 myself`
Expected: `OK myself` (스모크는 `/api/myself`의 `endpoints` 길이 5 확인). 브라우저 `http://localhost:8787` 에 서버 이름 표시.

- [ ] **Step 10: README에 명령을 적고 커밋한다**

README: 설치(uv, node), `uv run pytest`, `uv run lint-imports`, `npm --prefix client test`, 로컬 실행, 배포, Task 1 확인 결과 한 줄.
```bash
git add -A && git commit -m "chore: 저장소 뼈대와 서버 자기소개 /api/myself"
```

---

### Task 3: 게스트 만들기·되찾기 (D1)

**Files:**
- Create: `server/migrations/0001_init.sql`, `domain/nickname.py`, `app/dtos/guest_dto.py`, `app/ports/input/guest_use_case.py`, `app/ports/output/guest_repository.py`, `app/use_cases/guest_interactor.py`, `adapter/inbound/http/schemas/guest_schema.py`, `adapter/inbound/http/guest_router.py`, `adapter/outbound/d1_guest_repository.py`, `dependencies/guest_provider.py`
- Test: `tests/domain/test_nickname.py`, `tests/adapter/test_guest_schema.py`, `tests/app/use_cases/test_guest_interactor.py`
- Modify: `server/wrangler.jsonc` (d1_databases), `http_router.py`, `tests/fakes.py`, `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `runtime.read_json/json_response/to_py`, `http_router.route` 표
- Produces:
  - `domain.nickname`: `class InvalidNickname(ValueError)`, `def normalize_nickname(raw: str) -> str`
  - `CreateGuestCommand(nickname: str)`, `FindGuestQuery(guest_id: str)`, `GuestView(guest_id: str, nickname: str, color: int)`
  - `GuestUseCase`: `async create(cmd) -> GuestView`, `async find(query) -> GuestView | None`
  - `GuestRepository`: `async insert(view: GuestView, now: float) -> None`, `async get(guest_id: str) -> GuestView | None`, `async touch(guest_id: str, now: float) -> None`
  - `GuestInteractor(repo, new_id: Callable[[], str], clock: Callable[[], float], pick_color: Callable[[], int])`
  - `tests/fakes.py`: `FakeGuestRepository` (`rows: dict[str, tuple[GuestView, float]]`, `touched: list[tuple[str, float]]`)
  - 아바타 색 번호 0~7(8색 팔레트, 화면 `world/avatar.ts`와 같은 순서)

- [ ] **Step 1: D1을 만들고 스키마를 쓴다**

Run: `cd server && npx wrangler d1 create toycrane` → 출력된 `database_id`를 `wrangler.jsonc`에 `"d1_databases": [{"binding": "DB", "database_name": "toycrane", "database_id": "<출력값>", "migrations_dir": "migrations"}]`로 넣는다.
`0001_init.sql`:
```sql
CREATE TABLE guests (guest_id TEXT PRIMARY KEY, nickname TEXT NOT NULL, color INTEGER NOT NULL, created_at REAL NOT NULL, last_seen REAL NOT NULL);
CREATE TABLE store_occupancy (store_no INTEGER PRIMARY KEY, count INTEGER NOT NULL, updated_at REAL NOT NULL);
```
Run: `npx wrangler d1 migrations apply toycrane --local` → Expected: 2 tables created.

- [ ] **Step 2: 닉네임 규칙 테스트를 쓴다**

```python
def test_normalize_trims_and_collapses_spaces():
    assert normalize_nickname("  말랑   토끼 ") == "말랑 토끼"

def test_emoji_and_korean_allowed():
    assert normalize_nickname("토끼🐰") == "토끼🐰"

@pytest.mark.parametrize("raw", ["", "   ", "가나다라마바사아자차카", "a\u0000b", "a\nb"])
def test_rejects(raw):
    with pytest.raises(InvalidNickname):
        normalize_nickname(raw)
```

- [ ] **Step 3: 게스트 인터랙터·스키마 테스트를 쓴다**

```python
async def test_create_normalizes_and_assigns_color():
    repo = FakeGuestRepository()
    uc = GuestInteractor(repo, new_id=lambda: "g-1", clock=lambda: 100.0, pick_color=lambda: 3)
    view = await uc.create(CreateGuestCommand(nickname="  말랑   토끼 "))
    assert view == GuestView(guest_id="g-1", nickname="말랑 토끼", color=3)
    assert repo.rows["g-1"] == (view, 100.0)

async def test_create_bad_nickname_stores_nothing():
    repo = FakeGuestRepository()
    with pytest.raises(InvalidNickname):
        await GuestInteractor(repo, lambda: "g-1", lambda: 0.0, lambda: 0).create(CreateGuestCommand(nickname=" "))
    assert repo.rows == {}

async def test_find_known_touches_last_seen():
    repo = FakeGuestRepository(); repo.rows["g-1"] = (GuestView("g-1", "토끼", 3), 100.0)
    uc = GuestInteractor(repo, lambda: "x", lambda: 200.0, lambda: 0)
    assert await uc.find(FindGuestQuery("g-1")) == GuestView("g-1", "토끼", 3)
    assert repo.touched == [("g-1", 200.0)]

async def test_find_unknown_returns_none():
    assert await GuestInteractor(FakeGuestRepository(), lambda: "x", lambda: 0.0, lambda: 0).find(FindGuestQuery("nope")) is None
```
`test_guest_schema.py`: `parse_create({"nickname": "토끼"}) == CreateGuestCommand("토끼")`, `parse_create({}) is None`, `parse_create({"nickname": 5}) is None`, `to_json(GuestView("g-1","토끼",3)) == {"guestId":"g-1","nickname":"토끼","color":3}`.

- [ ] **Step 4: 실패를 확인한다** — Run: `uv run pytest tests/domain/test_nickname.py tests/adapter/test_guest_schema.py tests/app/use_cases/test_guest_interactor.py -q` / Expected: FAIL (모듈 없음)

- [ ] **Step 5: 구현한다**

`normalize_nickname`: `" ".join(raw.split())` 후 길이 1~10(파이썬 `len`, 코드포인트 기준) 아니거나 `unicodedata.category(ch) == "Cc"`인 글자가 원문에 있으면 `InvalidNickname`. 라우터: `POST /api/guest` → 201/400(`{"error":"nickname"}`·본문 깨짐도 400), `GET /api/guest/{id}` → 200/404, `GET /api/guest/myself` → `{"name":"게스트","description":"로그인 없이 닉네임만으로 게스트를 만들고, 같은 브라우저가 다시 오면 되찾습니다. 닉네임은 1~10자, 아바타 색은 8색 중 하나가 자동으로 정해집니다.","endpoints":[...]}`. 프로바이더는 `uuid.uuid4().hex`, `time.time`, `random.randrange(8)`을 넣는다. D1 저장소는 `env.DB.prepare(...).bind(...)` + `runtime.to_py`.

- [ ] **Step 6: 테스트 통과** — Run: `uv run pytest -q && uv run lint-imports` / Expected: PASS, 2 kept

- [ ] **Step 7: 스모크** — `smoke.mjs`에 `guest` 케이스: 생성 201 → 같은 id 조회 200 → 공백 닉네임 400 → 모르는 id 404. Run: `node server/scripts/smoke.mjs http://localhost:8787 guest` / Expected: `OK guest`

- [ ] **Step 8: Commit** — `git commit -am "feat: 게스트 만들기·되찾기 (D1)"` (새 파일은 `git add` 먼저)

---

### Task 4: 매장 배정 `POST /api/admission`

**Files:**
- Create: `domain/store_rules.py`, `app/dtos/admission_dto.py`, `app/ports/input/admission_use_case.py`, `app/ports/output/occupancy_port.py`, `app/use_cases/admission_interactor.py`, `adapter/inbound/http/schemas/admission_schema.py`, `adapter/inbound/http/admission_router.py`, `adapter/outbound/d1_occupancy_adapter.py`, `dependencies/admission_provider.py`
- Test: `tests/domain/test_store_rules.py`, `tests/app/use_cases/test_admission_interactor.py`
- Modify: `http_router.py`, `tests/fakes.py`

**Interfaces:**
- Consumes: `GuestRepository.get`
- Produces:
  - `domain.store_rules`: `STORE_CAPACITY = 50`, `def choose_store(counts: dict[int, int], max_stores: int) -> int | None` (1..max_stores 중 인원 50 미만인 가장 작은 번호, 없으면 None)
  - `AdmissionQuery(guest_id: str)`, `AdmissionResult(store_no: int | None)`, `class UnknownGuest(LookupError)`
  - `AdmissionUseCase.admit(query) -> AdmissionResult` (async)
  - `OccupancyPort`: `async counts() -> dict[int, int]`, `async write(store_no: int, count: int, now: float) -> None` (Task 5의 매장도 같은 포트로 쓴다)
  - `tests/fakes.py`: `FakeOccupancy` (`counts_value: dict[int,int]`, `writes: list[tuple[int,int,float]]`)

- [ ] **Step 1: 테스트를 쓴다**

```python
def test_fills_lowest_open_store():          assert choose_store({1: 50, 2: 12}, max_stores=4) == 2
def test_opens_next_store_when_all_full():   assert choose_store({1: 50, 2: 50}, max_stores=4) == 3
def test_empty_starts_at_one():              assert choose_store({}, max_stores=4) == 1
def test_full_when_every_store_full():       assert choose_store({1: 50, 2: 50, 3: 50, 4: 50}, max_stores=4) is None

async def test_admit_unknown_guest_raises():
    with pytest.raises(UnknownGuest):
        await AdmissionInteractor(FakeGuestRepository(), FakeOccupancy(), max_stores=4).admit(AdmissionQuery("nope"))

async def test_admit_returns_store():
    guests = FakeGuestRepository(); guests.rows["g-1"] = (GuestView("g-1", "토끼", 3), 0.0)
    occ = FakeOccupancy(counts_value={1: 50})
    assert await AdmissionInteractor(guests, occ, max_stores=4).admit(AdmissionQuery("g-1")) == AdmissionResult(store_no=2)
```

- [ ] **Step 2: 실패 확인** — Run: `uv run pytest tests/domain/test_store_rules.py tests/app/use_cases/test_admission_interactor.py -q` / Expected: FAIL

- [ ] **Step 3: 구현한다** — 라우터: `POST /api/admission {guestId}` → `{"store": n}` 또는 `{"full": true}`(200), 모르는 게스트 404 `{"error":"guest"}`, 본문 깨짐 400. `GET /api/admission/myself` 실기능 소개("자리가 있는 가장 작은 번호의 매장을 정해 줍니다. 매장 하나 50명, 최대 매장 수는 MAX_STORES"). `max_stores`는 프로바이더가 `int(env.MAX_STORES)`로 넣는다. D1 어댑터 `counts()`는 `SELECT store_no, count FROM store_occupancy`.

- [ ] **Step 4: 테스트 통과** — Run: `uv run pytest -q && uv run lint-imports` / Expected: PASS

- [ ] **Step 5: Commit** — `git commit -m "feat: 매장 배정 /api/admission"`

---

### Task 5: 매장 Durable Object — 들어오기·나가기 (enter / leave)

**Files:**
- Create: `domain/value_objects/position.py`, `domain/value_objects/heading.py`, `domain/entities/player.py`, `app/dtos/player_view.py`, `app/dtos/enter_dto.py`, `app/dtos/leave_dto.py`, `app/ports/input/enter_use_case.py`, `app/ports/input/leave_use_case.py`, `app/ports/output/player_registry_port.py`, `app/ports/output/connections_port.py`, `app/use_cases/enter_interactor.py`, `app/use_cases/leave_interactor.py`, `adapter/inbound/ws/store_durable_object.py`, `adapter/inbound/ws/ws_router.py`, `adapter/inbound/ws/enter_handler.py`, `adapter/inbound/ws/leave_handler.py`, `adapter/inbound/ws/schemas/server_messages.py`, `adapter/inbound/http/store_gateway_router.py`, `adapter/outbound/attachment_player_registry.py`, `adapter/outbound/ws_connections_adapter.py`, `dependencies/enter_provider.py`, `dependencies/leave_provider.py`, `shared/protocol_fixtures.json`
- Test: `tests/app/use_cases/test_enter_interactor.py`, `tests/app/use_cases/test_leave_interactor.py`, `tests/adapter/test_server_messages.py`, `tests/domain/test_store_rules.py`(추가)
- Modify: `domain/store_rules.py`, `entry.py`, `http_router.py`, `tests/fakes.py`, `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `OccupancyPort.write`, `GuestRepository.get`, `STORE_CAPACITY`
- Produces:
  - `Position(x: float, z: float)`, `Heading(dx: float, dz: float)` (frozen; `Heading.STOP = Heading(0, 0)`)
  - `Player(player_id: str, guest_id: str, nickname: str, color: int, position: Position, heading: Heading, updated_at: float)`
  - `store_rules`: `MAP_HALF = 12.6`, `TOWER_HALF = 1.3`, `SPAWN_RADIUS = 2.4`, `WALK_SPEED = 3.2`, `def spawn_position(seed: int) -> Position` (각도 = seed × 2.399963, 반지름 2.4), `def clamp_to_floor(p: Position) -> Position` (±12.6로 자르고, 탑 안이면 가장 가까운 변으로 밀어냄)
  - `PlayerView(id: str, nick: str, color: int, x: float, z: float, dx: float, dz: float)` + `PlayerView.of(player: Player) -> PlayerView`
  - `EnterCommand(conn_id: str, guest_id: str, nickname: str, color: int, store_no: int, now: float, seed: int)`, `EnterResult(you: PlayerView, others: tuple[PlayerView, ...])`, `class StoreFull(Exception)`
  - `EnterUseCase.enter(cmd) -> EnterResult`, `LeaveCommand(conn_id: str, store_no: int, now: float)`, `LeaveUseCase.leave(cmd) -> None`
  - `PlayerRegistryPort`: `entries() -> list[tuple[str, Player]]`, `put(conn_id: str, player: Player) -> None`, `remove(conn_id: str) -> Player | None` (동기 — attachment는 동기 API)
  - `EnterInteractor(registry: PlayerRegistryPort, connections: ConnectionsPort, occupancy: OccupancyPort, new_player_id: Callable[[], str])`, `LeaveInteractor(registry, connections, occupancy)`
  - `ConnectionsPort`: `send_to(conn_id: str, message: dict) -> None`, `send_to_all_except(conn_id: str | None, message: dict) -> None`, `kick(conn_id: str, code: int, reason: str) -> None`
  - `server_messages`: `welcome(store_no: int, you: PlayerView, players: list[PlayerView]) -> dict`, `join(p: PlayerView) -> dict`, `leave(player_id: str) -> dict`, `move(p: PlayerView) -> dict`, `correct(x: float, z: float) -> dict`
  - `tests/fakes.py`: `FakeRegistry`, `FakeConnections` (`broadcasts: list[tuple[str | None, dict]]` = `send_to_all_except(제외 conn, msg)` 기록, `direct: list[tuple[str, dict]]` = `send_to` 기록, `kicked: list[tuple[str, int]]`), `player(player_id: str, guest: str = "g-x", at: Position = Position(0, 0), heading: Heading = Heading.STOP, updated_at: float = 0.0) -> Player` (닉네임 "토끼", 색 0)

- [ ] **Step 1: 메시지 견본(계약)을 쓴다** — `shared/protocol_fixtures.json`에 위 "메시지 형식" 표의 예시를 키 `client_move`, `server_welcome`, `server_join`, `server_move`, `server_correct`, `server_leave`, `bad_client_moves`(Task 6에서 사용: `{"t":"move","x":"a","z":0,"dx":0,"dz":0}`, `{"t":"move","x":1,"z":1,"dx":2,"dz":0}`, `{"t":"move","x":1e400,"z":0,"dx":0,"dz":0}`, `{"t":"jump"}`, `"not json"`)로 넣는다.

- [ ] **Step 2: 테스트를 쓴다**

```python
def test_spawn_on_ring():
    p = spawn_position(7)
    assert math.isclose(math.hypot(p.x, p.z), 2.4)
    assert spawn_position(7) != spawn_position(8)

def test_clamp_to_floor_bounds_and_tower():
    assert clamp_to_floor(Position(13.0, -20.0)) == Position(12.6, -12.6)
    assert clamp_to_floor(Position(0.5, 1.0)) == Position(0.5, 1.3)

async def test_enter_spawns_and_returns_others():
    reg = FakeRegistry(); reg.put("c-1", player("p-1", guest="g-1"))
    conns, occ = FakeConnections(), FakeOccupancy()
    result = await EnterInteractor(reg, conns, occ, new_player_id=lambda: "p-2").enter(EnterCommand("c-2", "g-2", "토끼", 3, 1, now=10.0, seed=7))
    assert result.you.id == "p-2" and math.isclose(math.hypot(result.you.x, result.you.z), 2.4)
    assert [o.id for o in result.others] == ["p-1"]
    assert conns.broadcasts == [("c-2", join(result.you))]    # 본인 제외 전체에게 join
    assert occ.writes == [(1, 2, 10.0)]

async def test_enter_full_store_raises_and_adds_nothing():
    reg = FakeRegistry()
    for i in range(50): reg.put(f"c-{i}", player(f"p-{i}", guest=f"g-{i}"))
    with pytest.raises(StoreFull):
        await EnterInteractor(reg, FakeConnections(), FakeOccupancy(), lambda: "p-x").enter(EnterCommand("c-new", "g-new", "토끼", 0, 1, 0.0, 0))
    assert len(reg.entries()) == 50

async def test_same_guest_second_tab_kicks_first():
    reg = FakeRegistry(); reg.put("c-old", player("p-old", guest="g-1"))
    conns = FakeConnections()
    await EnterInteractor(reg, conns, FakeOccupancy(), lambda: "p-new").enter(EnterCommand("c-new", "g-1", "토끼", 3, 1, 0.0, 0))
    assert conns.kicked == [("c-old", 4003)]
    assert [c for c, _ in reg.entries()] == ["c-new"]
    assert ("c-new", leave("p-old")) in conns.broadcasts

async def test_leave_removes_broadcasts_and_writes_count():
    reg = FakeRegistry(); reg.put("c-1", player("p-1")); reg.put("c-2", player("p-2"))
    conns, occ = FakeConnections(), FakeOccupancy()
    await LeaveInteractor(reg, conns, occ).leave(LeaveCommand("c-1", 1, now=5.0))
    assert conns.broadcasts == [("c-1", leave("p-1"))] and occ.writes == [(1, 1, 5.0)]

async def test_leave_unknown_connection_is_noop():
    conns = FakeConnections()
    await LeaveInteractor(FakeRegistry(), conns, FakeOccupancy()).leave(LeaveCommand("c-x", 1, 0.0))
    assert conns.broadcasts == []
```
`test_server_messages.py`: `welcome/join/move/correct/leave` 출력이 `protocol_fixtures.json`의 해당 견본과 같다(`player_view` 값은 견본에서 만든다).

- [ ] **Step 3: 실패 확인** — Run: `uv run pytest -q` / Expected: 새 테스트 FAIL

- [ ] **Step 4: 도메인·인터랙터·메시지를 구현한다** — 정원 판단은 "같은 게스트 내보내기 후 남은 인원 ≥ 50 → StoreFull". 인원 기록은 들어오기 후 인원 수.

- [ ] **Step 5: 매장 DO와 관문 라우터를 구현한다**

`store_gateway_router.open_store(request, env)`: 경로 `/ws/store/{n}`(1 ≤ n ≤ MAX_STORES 아니면 404), `guest` 질의로 게스트 조회(없으면 404) → `env.STORE.getByName(f"store-{n}")`의 `fetch`로 넘기며 헤더 `X-Guest-Id`·`X-Nickname`(URL 인코딩)·`X-Color`·`X-Store-No`를 붙인다.
`Store(DurableObject)`:
- `fetch`: `WebSocketPair` 만들고 `self.ctx.acceptWebSocket(server)` → 저장소에 `store_no` 기록(`await self.ctx.storage.put("store_no", n)`) → `enter_handler.handle(...)`; `StoreFull`이면 `server.close(4001, "full")`, 성공이면 `welcome` 전송; 101 응답.
- `webSocketMessage`: `ws_router.dispatch(self, ws, message)` — JSON 아니거나 `t`가 표에 없으면 무시.
- `webSocketClose`: `leave_handler.handle(...)` 후 `ws.close(1000 if code in (1005, 1006) else code, reason)`.
`attachment_player_registry`: 접속 식별자·플레이어를 JSON으로 `serializeAttachment`, `list()`는 `getWebSockets()`를 돌며 복원. `ws_connections_adapter.kick`은 해당 소켓 `close(code, reason)`.
`entry.py`에 `from toycrane.adapter.inbound.ws.store_durable_object import Store`.

- [ ] **Step 6: 테스트·계층 검사** — Run: `uv run pytest -q && uv run lint-imports` / Expected: PASS, 2 kept

- [ ] **Step 7: 스모크** — `smoke.mjs` 케이스 `together`: 게스트 2명 생성 → 둘 다 배정(같은 매장) → A 접속(welcome, players 0명) → B 접속(B welcome에 A 있음, A는 join 받음) → B 닫기(A는 leave 받음). 케이스 `twotabs`: 같은 게스트로 두 번 접속 → 첫 접속 4003으로 닫힘. 케이스 `idle`: A·B 접속 후 20초 쉬고 C 접속 → C의 welcome에 A·B가 그대로 있음(깨어난 뒤 attachment 복원).
Run: `node server/scripts/smoke.mjs http://localhost:8787 together twotabs idle` / Expected: `OK together`, `OK twotabs`, `OK idle`

- [ ] **Step 8: Commit** — `git commit -m "feat: 매장 DO 들어오기·나가기, 같은 게스트 중복 접속 정리"`

---

### Task 6: 이동 중계 (move)

**Files:**
- Create: `domain/movement.py`, `app/dtos/move_dto.py`, `app/ports/input/move_use_case.py`, `app/use_cases/move_interactor.py`, `adapter/inbound/ws/move_handler.py`, `adapter/inbound/ws/schemas/move_schema.py`, `dependencies/move_provider.py`
- Test: `tests/domain/test_movement.py`, `tests/adapter/test_move_schema.py`, `tests/adapter/test_ws_router.py`, `tests/app/use_cases/test_move_interactor.py`
- Modify: `ws_router.py`, `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `PlayerRegistryPort`, `ConnectionsPort`, `server_messages.move/correct`, `clamp_to_floor`, `WALK_SPEED`
- Produces:
  - `domain.movement`: `def accept_move(last: Position, heading: Heading, last_at: float, claimed: Position, now: float) -> Position`
  - `MoveCommand(conn_id: str, x: float, z: float, dx: float, dz: float, now: float)`, `MoveUseCase.move(cmd) -> None`
  - `move_schema.parse(data: dict, conn_id: str, now: float) -> MoveCommand | None`
  - `ws_router.decode(raw: str) -> dict | None` (JSON 객체이고 `t`가 문자열일 때만 dict, 아니면 None — 순수 함수), `ws_router.dispatch(store, ws, raw: str) -> None` (모르는 `t`는 무시)
  - `MoveInteractor(registry: PlayerRegistryPort, connections: ConnectionsPort)`

- [ ] **Step 1: 테스트를 쓴다**

```python
def test_within_speed_is_accepted():
    assert accept_move(Position(0, 3), Heading(1, 0), 0.0, Position(1.5, 3), now=0.5) == Position(1.5, 3)

def test_teleport_snaps_to_expected():
    assert accept_move(Position(0, 3), Heading(1, 0), 0.0, Position(9, 3), now=0.5) == Position(1.6, 3)

def test_clamped_to_floor_edge():
    assert accept_move(Position(12.5, 0), Heading(1, 0), 0.0, Position(12.9, 0), now=0.5) == Position(12.6, 0)

def test_pushed_out_of_tower():
    assert accept_move(Position(0.5, 1.5), Heading(0, -1), 0.0, Position(0.5, 1.0), now=0.2) == Position(0.5, 1.3)
```
(허용 거리 = `WALK_SPEED × 경과 × 1.5 + 0.6`, 넘으면 `last + heading × WALK_SPEED × 경과`로 대체 후 `clamp_to_floor`.)

```python
async def test_move_updates_and_broadcasts_to_others():
    reg = FakeRegistry(); reg.put("c-1", player("p-1", at=Position(0, 3), updated_at=0.0))
    conns = FakeConnections()
    await MoveInteractor(reg, conns).move(MoveCommand("c-1", 1.5, 3, 1, 0, now=0.5))
    moved = dict(reg.entries())["c-1"]
    assert moved.position == Position(1.5, 3) and moved.heading == Heading(1, 0) and moved.updated_at == 0.5
    assert conns.broadcasts == [("c-1", move(PlayerView.of(moved)))] and conns.direct == []

async def test_snapped_move_sends_correction_to_sender():
    reg = FakeRegistry(); reg.put("c-1", player("p-1", at=Position(0, 3), heading=Heading(1, 0), updated_at=0.0))
    conns = FakeConnections()
    await MoveInteractor(reg, conns).move(MoveCommand("c-1", 9, 3, 1, 0, now=0.5))
    assert conns.direct == [("c-1", correct(1.6, 3))]
```
`test_move_schema.py`: `client_move` 견본 → `MoveCommand` 값 일치; `bad_client_moves`의 dict 항목 → `None`(문자 좌표, |dx|>1, 무한대, 모르는 `t`). heading이 (0,0)이 아니면 길이 1로 정규화.
`test_ws_router.py`: `decode("not json") is None`, `decode("[1]") is None`, `decode('{"x":1}') is None`, `decode('{"t":"move","x":1}') == {"t": "move", "x": 1}`.

- [ ] **Step 2: 실패 확인** — Run: `uv run pytest tests/domain/test_movement.py tests/adapter/test_move_schema.py tests/adapter/test_ws_router.py tests/app/use_cases/test_move_interactor.py -q` / Expected: FAIL

- [ ] **Step 3: 구현** — 등록 안 된 접속의 move는 무시. 보정이 일어난 경우(받아들인 위치와 보낸 위치 차이 > 0.01)에만 `correct` 전송.

- [ ] **Step 4: 테스트 통과** — Run: `uv run pytest -q && uv run lint-imports` / Expected: PASS

- [ ] **Step 5: 스모크** — 케이스 `walk`: A·B 접속 → A가 `client_move` 견본 전송 → B가 같은 id의 `move` 수신; A가 순간이동 좌표 전송 → A가 `correct` 수신; A가 `"not json"` 전송 → 접속 유지(이후 move 정상 중계).
Run: `node server/scripts/smoke.mjs http://localhost:8787 walk` / Expected: `OK walk`

- [ ] **Step 6: Commit** — `git commit -m "feat: 이동 중계와 위치 검증"`

---

### Task 7: 매장 겉모습 + 아바타 (화면)

**Files:**
- Create: `client/src/world/layout.ts`, `client/src/world/storeScene.ts`, `client/src/world/avatar.ts`, `client/src/world/label.ts`
- Test: `client/src/world/layout.test.ts`
- Modify: `client/src/main.ts` (임시 확인용: 매장 + 아바타 하나)

**Interfaces:**
- Produces:
  - `layout.ts`: `MAP_HALF = 12.6`, `ROOM_HALF = 13`, `HUB_HALF = 5`, `TOWER_HALF = 1.3`, `SPAWN_RADIUS = 2.4`, `WALK_SPEED = 3.2`, `type Zone = 'big' | 'mini' | 'figure' | 'hub' | 'path'`, `zoneAt(x: number, z: number): Zone`
  - `storeScene.ts`: `buildStore(scene: THREE.Scene): void` — 대리석 바닥, 어두운 벽, 천장 분홍 네온, 구역 바닥 색과 구역 이름(큰인형·미니·피규어), 허브 4면 전광판 탑(화면엔 "toycrane"), 스폰 링 표시
  - `avatar.ts`: `AVATAR_COLORS: number[]`(8색, 서버 색 번호 0~7 순서), `makeAvatar(color: number, nickname: string): Avatar`, `interface Avatar { root: THREE.Group; setWalking(on: boolean): void; update(t: number): void }`
  - `label.ts`: `makeLabel(text: string): THREE.Sprite`

- [ ] **Step 1: 구역 판정 테스트를 쓴다**

```ts
test.each([[0, 0, 'hub'], [0, -10, 'big'], [-10, 0, 'mini'], [10, 0, 'figure'], [-3, 10, 'mini'], [3, 10, 'figure'], [0, 10, 'path'], [-5.2, 0, 'path']])(
  'zoneAt(%d,%d) = %s', (x, z, zone) => expect(zoneAt(x, z)).toBe(zone));
```
규칙: hub `|x|≤5 && |z|≤5` → big `z < -5.5` → mini `x < -5.5 || (z > 5.5 && x < -0.5)` → figure `x > 5.5 || (z > 5.5 && x > 0.5)` → 나머지 path. (위에서부터 먼저 맞는 것)

- [ ] **Step 2: 실패 확인** — Run: `npm --prefix client test -- layout` / Expected: FAIL

- [ ] **Step 3: 구현** — 겉모습은 `docs/reference/prototypes/spike-arcade-big-v3.html`의 바닥 대리석 텍스처·벽·천장 네온·툰 셰이딩·외곽선·`makeAvatar`를 옮겨 온다(손 떠 있는 캐릭터, 걷기 들썩임). 매장 크기만 26m로, 기계는 아직 없음. 구역 바닥은 큰인형 분홍·미니 보라·피규어 하늘 반투명 판(`map-layout-v3.html` 색).

- [ ] **Step 4: 테스트 통과 + 눈으로 확인** — Run: `npm --prefix client test && npm --prefix client run dev` → 브라우저 `http://localhost:5173`. Expected: 위에서 내려다본 배치가 `map-layout-v3.html`과 같은 모양(위 큰인형, 왼쪽 미니, 오른쪽 피규어, 가운데 탑과 스폰 링), 탑 옆에 아바타 하나.

- [ ] **Step 5: Commit** — `git commit -m "feat: 매장 겉모습과 아바타"`

---

### Task 8: 내 캐릭터 조작 (키보드·가상 조이스틱·카메라)

**Files:**
- Create: `client/src/game/movement.ts`, `client/src/game/inputSampler.ts`, `client/src/game/localPlayer.ts`, `client/src/input/keyboard.ts`, `client/src/input/joystick.ts`
- Test: `client/src/game/movement.test.ts`, `client/src/game/inputSampler.test.ts`, `client/src/input/joystick.test.ts`

**Interfaces:**
- Consumes: `layout.ts` 상수, `makeAvatar`
- Produces:
  - `type Vec2 = { x: number; z: number }`
  - `movement.ts`: `step(pos: Vec2, dir: Vec2, dt: number): Vec2` (속도 3.2, 끝에 `clampToFloor`), `clampToFloor(p: Vec2): Vec2` (서버 `clamp_to_floor`와 같은 규칙)
  - `inputSampler.ts`: `class InputSampler { shouldSend(dir: Vec2, nowMs: number): boolean }` — 방향을 16방위로 양자화(멈춤은 따로)해 바뀌면 true, 움직이는 중 마지막 전송 후 3000ms면 true, 보내면 내부 기록 갱신
  - `joystick.ts`: `joystickVector(start: Vec2, current: Vec2, radius: number): Vec2` (반경 밖은 길이 1, 반경 15% 안은 0)
  - `keyboard.ts`: `readKeyboard(): Vec2` (WASD·방향키, 대각선 정규화, 화면 위쪽 = -z)
  - `localPlayer.ts`: `class LocalPlayer { pos: Vec2; dir: Vec2; tick(dt: number): void; correct(p: Vec2): void }`

- [ ] **Step 1: 테스트를 쓴다**

```ts
test('step walks at 3.2m/s', () => expect(step({ x: 0, z: 3 }, { x: 1, z: 0 }, 0.5)).toEqual({ x: 1.6, z: 3 }));
test('clamps to floor edge', () => expect(clampToFloor({ x: 13, z: -20 })).toEqual({ x: 12.6, z: -12.6 }));
test('pushes out of tower', () => expect(clampToFloor({ x: 0.5, z: 1.0 })).toEqual({ x: 0.5, z: 1.3 }));

test('sampler: idle sends nothing, start/turn/stop send, same dir waits 3s', () => {
  const s = new InputSampler();
  expect(s.shouldSend({ x: 0, z: 0 }, 0)).toBe(false);
  expect(s.shouldSend({ x: 1, z: 0 }, 100)).toBe(true);
  expect(s.shouldSend({ x: 0.99, z: 0.05 }, 200)).toBe(false);   // 같은 방위
  expect(s.shouldSend({ x: 1, z: 0 }, 3099)).toBe(false);
  expect(s.shouldSend({ x: 1, z: 0 }, 3100)).toBe(true);           // 3초 보정
  expect(s.shouldSend({ x: 0, z: 1 }, 3200)).toBe(true);           // 방향 바뀜
  expect(s.shouldSend({ x: 0, z: 0 }, 3300)).toBe(true);           // 멈춤
});

test('joystick dead zone and saturation', () => {
  expect(joystickVector({ x: 0, z: 0 }, { x: 5, z: 0 }, 50)).toEqual({ x: 0, z: 0 });
  expect(joystickVector({ x: 0, z: 0 }, { x: 100, z: 0 }, 50)).toEqual({ x: 1, z: 0 });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm --prefix client test -- movement inputSampler joystick` / Expected: FAIL

- [ ] **Step 3: 구현** — 카메라는 내 캐릭터 뒤 위(오프셋 0, 7, 9)에서 따라가며 바라본다. 조이스틱은 화면 왼쪽 아래 절반을 누르면 생기는 원(터치 기기에서만 보임).

- [ ] **Step 4: 테스트 통과 + 눈으로 확인** — Run: `npm --prefix client test && npm --prefix client run dev` / Expected: 키보드로 걸어 다니고 벽·탑을 못 뚫음, 휴대폰 크기(개발자 도구 기기 모드)에서 조이스틱으로 이동.

- [ ] **Step 5: Commit** — `git commit -m "feat: 내 캐릭터 조작과 카메라"`

---

### Task 9: 접속·배정·다른 사람 보기·재접속 (화면 ↔ 서버)

**Files:**
- Create: `client/src/net/protocol.ts`, `client/src/net/api.ts`, `client/src/net/storeSocket.ts`, `client/src/net/reconnect.ts`, `client/src/game/remote.ts`, `client/src/ui/entry.ts`, `client/src/ui/status.ts`
- Test: `client/src/net/protocol.test.ts`, `client/src/net/reconnect.test.ts`, `client/src/game/remote.test.ts`
- Modify: `client/src/main.ts`

**Interfaces:**
- Consumes: 서버 HTTP·웹소켓(메시지 형식 표), `shared/protocol_fixtures.json`, `LocalPlayer`, `InputSampler`, `makeAvatar`
- Produces:
  - `protocol.ts`: `type PlayerView = { id: string; nick: string; color: number; x: number; z: number; dx: number; dz: number }`, `type ServerMsg = Welcome | Join | Move | Correct | Leave`, `decode(raw: string): ServerMsg | null`, `encodeMove(p: Vec2, d: Vec2): string` (x,z 소수 2자리, dx,dz 3자리)
  - `api.ts`: `createGuest(nickname: string): Promise<Guest | 'bad_nickname'>`, `getGuest(id: string): Promise<Guest | null>`, `admit(guestId: string): Promise<{ store: number } | { full: true }>`
  - `reconnect.ts`: `nextDelay(attempt: number): number` (`min(500 × 2^attempt, 8000)` ms)
  - `remote.ts`: `type RemoteState = { pos: Vec2; dir: Vec2; receivedAt: number }`, `extrapolate(s: RemoteState, nowMs: number): Vec2` (`step`과 같은 속도, `clampToFloor`)
  - `storeSocket.ts`: `class StoreSocket { constructor(url: string, handlers: { onMessage(m: ServerMsg): void; onClose(code: number): void }); send(raw: string): void; close(): void }`

- [ ] **Step 1: 테스트를 쓴다**

```ts
import fx from '../../../shared/protocol_fixtures.json';
test('decodes every server fixture', () => {
  for (const k of ['server_welcome', 'server_join', 'server_move', 'server_correct', 'server_leave'])
    expect(decode(JSON.stringify(fx[k]))).toEqual(fx[k]);
});
test('rejects garbage', () => { expect(decode('not json')).toBeNull(); expect(decode('{"t":"jump"}')).toBeNull(); });
test('encodeMove matches client fixture shape', () =>
  expect(JSON.parse(encodeMove({ x: 1.504, z: -2 }, { x: 0.70712, z: -0.70712 }))).toEqual({ t: 'move', x: 1.5, z: -2, dx: 0.707, dz: -0.707 }));
test('backoff', () => expect([0, 1, 2, 3, 4, 10].map(nextDelay)).toEqual([500, 1000, 2000, 4000, 8000, 8000]));
test('extrapolate', () => expect(extrapolate({ pos: { x: 0, z: 3 }, dir: { x: 1, z: 0 }, receivedAt: 1000 }, 1500)).toEqual({ x: 1.6, z: 3 }));
```

- [ ] **Step 2: 실패 확인** — Run: `npm --prefix client test -- protocol reconnect remote` / Expected: FAIL

- [ ] **Step 3: 구현**

- 첫 화면(`ui/entry.ts`): `localStorage['toycrane.guestId']`가 있고 `getGuest`가 성공하면 "○○ 님 어서 오세요" 후 바로 입장, 없으면 닉네임 입력(1~10자, 400이면 "닉네임은 1~10자로 해 주세요").
- 입장: `admit` → `{full:true}`면 만석 화면("지금 매장이 모두 찼어요. 잠시 후 다시 시도해 주세요" + 다시 시도 버튼) → 아니면 `wss://<같은 호스트>/ws/store/{n}?guest={id}` 접속.
- `welcome`: 내 위치를 `you`로, `players`로 아바타 생성. `join`/`leave`로 추가·제거. `move`로 `RemoteState` 갱신, 매 프레임 `extrapolate`한 목표로 아바타를 부드럽게(프레임당 20%) 이동. `correct`면 `LocalPlayer.correct`.
- 매 프레임 `InputSampler.shouldSend(dir, now)`가 true면 `encodeMove` 전송.
- 닫힘: 4001 → 다시 `admit`(다른 매장) · 4003 → "다른 창에서 접속해서 이 창은 멈췄어요" 표시 후 재접속 안 함 · 그 밖(배포·네트워크) → `status`에 "다시 연결 중…" 표시, `nextDelay(시도)` 뒤 `admit`부터 다시.

- [ ] **Step 4: 테스트 통과** — Run: `npm --prefix client test` / Expected: PASS

- [ ] **Step 5: 둘이서 확인** — `uv run pywrangler dev` + `npm --prefix client run build`(정적 자산) 후 브라우저 창 두 개로 `http://localhost:8787`. Expected: 서로 다른 닉네임으로 들어가 서로 걷는 모습이 보임, 한 창을 닫으면 다른 창에서 사라짐, 같은 게스트로 새 탭을 열면 이전 탭에 4003 안내, 서버를 재시작하면 두 창 모두 "다시 연결 중…" 뒤 복귀.

- [ ] **Step 6: Commit** — `git commit -m "feat: 매장 입장·다른 사람 보기·재접속"`

---

### Task 10: 실제 배포와 확인

**Files:**
- Modify: `README.md` (배포 주소·확인 결과)

**Interfaces:**
- Consumes: Task 1~9 전부

- [ ] **Step 1: 원격 D1에 스키마를 올린다** — Run: `cd server && npx wrangler d1 migrations apply toycrane --remote` / Expected: 2 tables

- [ ] **Step 2: 화면을 빌드하고 배포한다** — Run: `npm --prefix client run build && (cd server && uv run pywrangler deploy)` / Expected: `https://toycrane.<계정>.workers.dev`

- [ ] **Step 3: 배포 주소에 스모크를 돌린다** — Run: `node server/scripts/smoke.mjs https://toycrane.<계정>.workers.dev myself guest together twotabs walk idle` / Expected: 6개 모두 `OK`

- [ ] **Step 4: 사람이 확인한다** — PC 한 대와 휴대폰 한 대(카톡으로 주소를 보내 인앱 브라우저로 열기)로 같은 매장에 들어가 서로 걷는 모습 확인. 걷는 동안 다시 배포해서 두 기기 모두 자동 재접속되는지 확인.

- [ ] **Step 5: 기록하고 커밋** — README에 배포 주소·확인 날짜·기기. `git commit -am "docs: 1단계 배포 확인"`

---

## 실행 결과 (2026-10-31)

10개 태스크 완료, https://toycrane.toycrane.workers.dev 에 배포. 실행 중 판단과 리뷰 결과는 커밋 메시지와 README "확인 기록"에 있고, 다음 단계가 이어받을 미룬 항목은 아래와 같다.

**다음 단계로 넘긴 판단**
- 이동 검증은 계획의 허용 거리 공식 대신 "이동 예산"(충전 4.8m/s, 상한 10.2m, 시작 0.6m) — Plan 2 줄 서기에 상한이 크면 줄인다.
- Plan 5: 휴대폰 그리기 비용 측정, D1 하루 쓰기 예산(last_seen·인원 기록), 접속당 메시지 속도 제한·IP 제한, 첫 입장 5~6초(파이썬 DO 깨어나기).
- 반쯤 열린 연결의 서버 쪽 감지는 하지 않음(매장을 깨워 두면 무료 사용 시간을 씀) — 유령 캐릭터가 정원 1칸을 차지할 수 있다.
- 프로토콜 버전·배포 뒤 옛 화면 강제 새로고침은 메시지 형식이 바뀌는 단계에서.

**미룬 작은 문제**
- 스폰 자리가 탑 뒤쪽이면 따라가는 카메라에서 내 캐릭터가 전광판 탑에 가려짐 — Plan 2 전에.
- 닉네임에 보이지 않는 글자(한글 채움 U+3164 등)·방향 제어 문자·외톨이 서러게이트 허용.
- 재접속하면 스폰 위치로 돌아감, 재시도 간격에 지터 없음, 만석 카드 아래 상태 표시가 남음.
- 조이스틱이 방위 경계에서 떨리면 초당 여러 번 전송(최소 간격·히스테리시스 없음).
- 같은 게스트가 서로 다른 매장 두 곳에 동시에 있을 수 있음.
- 4002로 닉네임 화면에 돌아오면 WASD 키 처리가 입력칸 타자를 막음(한글 ㅈㅁㄴㅇ 포함).
- attachment·연결 어댑터 단위 테스트 없음(스모크로만), 이벤트마다 attachment 전부 다시 읽기 — 50명 부하 미측정.
- 화면 하트비트 없음, idle 스모크는 자동 완료 명령에 없음(직접 돌려 통과).
