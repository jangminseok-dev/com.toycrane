# toycrane 2단계 — 코인 교환소 + 큰인형 기계 한 판 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 허브의 코인 교환소에서 실제 줄을 서서 무료 코인을 받고, 위쪽 큰인형 구역의 기계 35대 중 하나에 코인을 넣어 집게를 움직여 내리면, 서버가 판정한 결과(성공·들었다 놓침·헛잡음)에 맞는 모션과 연출이 매장 모두에게 보인다. 뽑은 인형은 가방에 쌓이고, 희귀는 전광판에 닉네임과 함께 뜬다.

**Architecture:** 1단계 구조를 그대로 넓힌다. 매장 DO가 줄·기계 잠금을 웹소켓 attachment에, 기계 속 인형 배치를 DO 저장소에, 코인·가방을 D1에 둔다. 판정은 서버 도메인(`crane.py`)이 확률로 정하고, 화면은 결과 메시지에 맞춰 미리 만든 모션을 재생한다. 인형 목록과 매장 배치는 `shared/*.json` 한 곳에 두고, 화면은 JSON을 바로 읽고 서버는 생성 스크립트가 만든 파이썬 모듈을 읽는다(계약 테스트로 일치 확인). 기계·인형은 시제품 코드를 옮기고, 그리기 호출을 줄이려고 행(벽 줄·섬)마다 재질별로 합쳐 그린다.

**Tech Stack:** 1단계와 같음 — Python 3.14(Pyodide) · uv · workers-py(pywrangler) · pytest · import-linter · Cloudflare Workers / Durable Objects(SQLite, 저장소 KV) / D1 / Static Assets · TypeScript · Vite · three@0.169.0(`BufferGeometryUtils.mergeGeometries`) · vitest · Web Audio

**Spec:** `docs/superpowers/specs/2026-10-30-toycrane-design.md` (§3.2 배치, §3.3 코인 교환소, §4.3 화면 UI, §5 뽑기, §6.1 인형, §8.1 저장)

## 로드맵에서의 위치

1. 함께 걷는 매장 — 완료(2026-10-31, `docs/superpowers/plans/2026-10-30-toycrane-plan1-walk-together.md`)
2. **코인 교환소 + 큰인형 기계 한 판 (이 문서)**
3. 도감 + 콘텐츠 — 미니·피규어 구역 기계, 도감 NPC·화면, 희귀 진열장, 이어하기 코드
4. 재미 요소 — 피버, 근성 게이지, 더블 집기, 오늘의 기계·한정, 업고 다니기, **구경 + 리액션(남의 집게 실시간 보기 포함)**
5. 공개 준비 — 자랑 카드, 무료 예산 배분, IP 제한, 휴대폰 성능, 방문 측정

**이번에 하지 않는 것:** 남이 하는 동안 집게가 실시간으로 움직이는 모습(4단계 "구경"에서 — 지금은 결과 때 집게가 내려가는 모습만 모두에게), 기계 앞 대기 줄(설계 §5.2대로 만들지 않음), 도감 화면(3단계), 근성·피버 보정(4단계).

## 실행 준비

- 탑 반투명 수정(`fix-tower-fade` 브랜치, `client/src/game/occlusion.ts`)이 아직 `main`에 없다. 이 계획은 그 위에서 시작한다: `git checkout fix-tower-fade && git checkout -b plan2-coin-crane`. Task 4가 `occlusion.ts`를 넓혀 쓴다.
- 로컬 D1에 새 표를 만든다: Task 6의 `npx wrangler d1 migrations apply toycrane --local`.

## Global Constraints

- 1단계 Global Constraints 전부 그대로(무료만·유료 전환 금지, 파이썬 3.14, SQLite DO, hibernation API만·알람/타이머로 매장 깨워 두지 않기, attachment 16KB 이하, 닫기 코드 1005·1006 → 1000, `adapter → app → domain` 단방향·런타임 import 위치 제한, 슬라이스 1:1, `/myself`, 오리지널 인형·상표명 금지).
- **결과는 서버가 정한다.** 화면은 집게 위치만 보내고, 성공 여부·잡은 부위·인형·코인·가방은 서버 메시지로만 바뀐다(설계 §2 안티목표).
- **시간 제한은 타이머 없이 "다음 메시지가 올 때 확인"으로 지킨다.** 줄 맨 앞 8초, 한 판 20초(+여유 3초)는 저장된 시각과 지금을 비교해서 판단한다.
- 코인: 1판 = 1코인, 교환소에서 한 번에 **5개**, 지갑 최대 **15개**(넘는 만큼은 버림), 창구 처리 **2초**(여유 0.3초). [내 판단 — 설계 §3.3 [빌더]]
- 줄: 교환소마다 자리 **6칸**, 맨 앞이 **8초** 안에 안 받으면 다음 사람으로. 창구에서 **1.0m** 안에 서 있어야 받는다. [내 판단]
- 한 판: **20초** 안에 내리기(화면이 0초에 자동으로 내림), 기계 앞 **1.15m** 자리에서 **1.2m** 안에 서 있어야 시작. 집게 속도 **0.35m/s**. [내 판단]
- 판정(설계 §5.3, 수치는 [내 판단]): 집게와 가장 가까운 인형 중심까지 거리 **≤0.05 머리, ≤0.10 몸통, ≤0.14 팔, 그 밖은 빈 곳**. 부위별 (성공, 놓침) 확률 — 머리 (0.40, 0.40) · 몸통 (0.25, 0.45) · 팔 (0.10, 0.45) · 빈 곳 (0, 0), 나머지는 헛잡음. 희귀는 성공 확률 × **0.35**, 줄어든 만큼 놓침으로.
- 기계 속: 기계마다 인형 **9개**, 기계마다 세트 하나(배치 순서대로 4세트 돌아가며), 새 인형이 희귀일 확률 **0.06**. 뽑힌 자리는 같은 세트에서 하나 채운다.
- 하는 도중 접속이 끊기면(창 닫기·배포) **쓴 코인 1개를 돌려준다.**
- 화면 UI는 리퀴드 글라스(설계 §4.3, `client/src/ui/glass.ts`의 `backdropBlur`), 조작은 숨기지 않는다. 휴대폰 내리기 버튼은 오른쪽 아래, 조이스틱은 왼쪽 아래 그대로.
- 희귀 알림 문구: `★ 희귀 등장! ★` / `{닉네임} 님이 {인형 이름}을(를) 뽑았어요` — 받침에 따라 "을"/"를"을 고른다.

## Review Focus

1. **두 사람이 같은 기계에 거의 동시에 코인을 넣는다** — 코인 차감(D1)을 기다리는 사이 두 번째 요청이 끼어들어도 한 사람만 `play_ok`, 다른 사람은 `play_no busy`, 코인은 한 사람만 줄어야 한다. (Task 9 `test_second_start_during_coin_spend_is_busy`)
2. **하는 도중 창을 닫거나 배포로 끊긴다** — 쓴 코인 1개를 돌려주고, 기계를 풀고, 모두에게 `free`를 보낸다. 남은 사람 화면에서 그 기계가 영원히 "하는 중"으로 남으면 안 된다. (Task 9 `test_leave_mid_play_refunds_and_frees`)
3. **줄 맨 앞 사람이 사라지거나 가만히 있다** — 창을 닫으면 바로, 가만히 있으면 8초 뒤 다음 사람 차례가 된다. (Task 7 `test_stale_head_is_skipped_after_8s`, `test_leave_removes_from_queue`)
4. **이상한 내리기** — 시간(20+3초) 지나서 옴, 두 번 옴, 기계를 안 잡고 옴, 좌표가 범위 밖·무한대·문자·참거짓 → 결과 없이 무시하거나 범위 안으로 자르고, 서버 오류 없이 접속 유지. (Task 9 `test_late_drop_frees_without_result`, `test_double_drop_is_ignored`, 스키마 테스트)
5. **저장된 기계 속 인형 id가 목록에 없다**(배포로 목록이 바뀜) — 화면은 그 인형만 건너뛰고, 서버는 그 인형을 일반 인형으로 판정한다. (Task 4 `setContents skips unknown dolls`, Task 9 `test_unknown_kind_is_judged_as_normal`)

---

## 파일 구조 (새로 생기거나 바뀌는 것)

```
shared/
├── catalog.json                 # 인형 28종: id·이름·세트·희귀
├── store_layout.json            # 기계 35대·교환소 2곳·줄 자리·장애물·기계 안 치수
├── clamp_fixtures.json          # 바닥·장애물 밀어내기 계약 견본(서버·화면 같은 결과)
└── protocol_fixtures.json       # (수정) 2단계 메시지 견본 추가
server/
├── migrations/0002_coins_bag.sql
├── scripts/gen_shared.py        # shared/*.json → src/toycrane/domain/shared_data.py
├── scripts/smoke.mjs            # (수정) coins·play·busy·nocoins·refund 케이스
└── src/toycrane/
    ├── domain/shared_data.py    # 생성 파일(손으로 고치지 않음)
    ├── domain/catalog.py  layout.py  coins.py  play_rules.py  crane.py  coin_queue.py
    ├── domain/store_rules.py    # (수정) 장애물 목록으로 밀어내기
    ├── app/dtos/store_snapshot.py  queue_dto.py  take_dto.py  play_dto.py  drop_dto.py
    ├── app/ports/input/{queue_join,queue_leave,coin_take,play_start,drop}_use_case.py
    ├── app/ports/output/wallet_port.py  bag_port.py  machine_contents_port.py
    │   queue_registry_port.py  play_lock_port.py  connections_port.py(수정)
    ├── app/use_cases/{queue_join,queue_leave,coin_take,play_start,drop}_interactor.py
    │   machine_contents.py(없는 기계 채우기 도우미)  enter_interactor.py·leave_interactor.py(수정)
    ├── adapter/inbound/ws/{queue_join,queue_leave,coin_take,play_start,drop}_handler.py  ws_router.py(수정)
    ├── adapter/inbound/ws/schemas/{queue_schema,play_schema,drop_schema}.py  server_messages.py(수정)
    ├── adapter/outbound/d1_wallet_adapter.py  d1_bag_adapter.py  do_storage_machine_contents.py
    │   attachment_queue_registry.py  attachment_play_locks.py  ws_connections_adapter.py(수정)
    └── dependencies/{queue_join,queue_leave,coin_take,play_start,drop}_provider.py  enter·leave_provider(수정)
client/
├── vite.config.ts               # (수정) server.fs.allow로 ../shared 읽기
├── dev/dolls.html  dev/dolls.ts # 개발용 인형 28종 줄 세워 보기(빌드에 안 들어감)
├── e2e/shot.mjs                 # 휴대폰·PC 화면으로 들어가 캡처하는 도구
└── src/
    ├── data/catalog.ts  storeLayout.ts
    ├── test/canvasStub.ts       # 노드 테스트에서 캔버스 텍스처를 흉내
    ├── world/dolls.ts  dollTextures.ts  machine.ts  bake.ts  bigZone.ts  coinCounter.ts  effects.ts  motions.ts
    ├── world/avatar.ts  storeScene.ts  # (수정) 모션용 손잡이, 탑 전광판 문구 바꾸기
    ├── game/occlusion.ts        # (수정) 여러 가림막을 각각 흐리게
    ├── game/movement.ts         # (수정) 장애물 목록으로 밀어내기
    ├── game/tween.ts  queueClient.ts  playSession.ts  machineCamera.ts
    ├── audio/sfx.ts
    ├── ui/hud.ts  actionButton.ts  playControls.ts  winCard.ts  josa.ts
    ├── net/protocol.ts          # (수정) 2단계 메시지
    └── main.ts                  # (수정) 연결
```

## 메시지 형식 (2단계에 추가되는 것)

| 방향 | 메시지 |
|---|---|
| 화면→서버 | `{"t":"queue","c":0}` 교환소 c(0·1) 줄 서기 · `{"t":"unqueue"}` 줄에서 나가기 · `{"t":"take"}` 맨 앞에서 코인 받기 |
| 화면→서버 | `{"t":"play","m":"A-3"}` 코인 넣고 시작 · `{"t":"drop","x":0.12,"z":-0.05}` 내리기(기계 안 좌표, 소수 3자리) |
| 서버→화면 | welcome에 추가: `"coins":5,"bag":2,"machines":{"A-1":[["bunny",0.12,-0.05,1.57],…],…},"queues":[["p1"],[]],"plays":{"A-3":"p2"}` |
| 서버→모두 | `{"t":"queue","c":0,"ids":["p1","p2"]}` 줄 순서(맨 앞이 0번) |
| 서버→본인 | `{"t":"queue_no","c":0,"why":"full"}` · `{"t":"coins","n":10,"got":5}` (got=0이면 지갑이 가득) · `{"t":"bag","n":3}` |
| 서버→본인 | `{"t":"play_ok","m":"A-3","coins":9,"limit":20}` · `{"t":"play_no","m":"A-3","why":"busy"\|"coins"\|"far"\|"playing"}` |
| 서버→다른 사람 | `{"t":"play","m":"A-3","id":"p1"}` |
| 서버→모두 | `{"t":"result","m":"A-3","id":"p1","x":0.12,"z":-0.05,"o":"win"\|"slip"\|"miss","part":"head"\|"body"\|"arm"\|"none","k":"bunny"}` (k는 잡은 인형, 빈 곳이면 null) |
| 서버→모두 | `{"t":"machine","m":"A-3","dolls":[["bunny",x,z,r],…]}` 성공 뒤 새 배치 · `{"t":"free","m":"A-3"}` 끊김·시간 초과로 풀림 |

인형 배치 한 칸 `[id, x, z, r]`: 기계 안 좌표(m, 소수 3자리), r은 몸 돌림(라디안, 소수 2자리). 희귀 여부는 `catalog.json`으로 판단해서 따로 보내지 않는다.

---

### Task 1: 공용 데이터 — 인형 목록·매장 배치

설계 §6.1 "목록 정보는 데이터 파일 한 곳".

**Files:**
- Create: `shared/catalog.json`, `shared/store_layout.json`
- Create: `server/scripts/gen_shared.py`, `server/src/toycrane/domain/shared_data.py`(생성), `server/src/toycrane/domain/catalog.py`, `server/src/toycrane/domain/layout.py`
- Create: `client/src/data/catalog.ts`, `client/src/data/storeLayout.ts`, `client/src/data/data.test.ts`
- Modify: `client/vite.config.ts` — `server: { fs: { allow: ['..'] } }`(개발 서버가 `../shared`를 읽게)
- Test: `server/tests/domain/test_shared_data.py`

**Interfaces:**
- Produces (파이썬): `catalog.DOLLS: dict[str, Doll]`(`Doll(id, name, set, rare, base)` frozen), `catalog.SET_IDS: tuple[str, ...]`, `catalog.set_kinds(set_id) -> tuple[list[str], str]`(일반 6종, 희귀 1종), `catalog.is_rare(kind) -> bool`(목록에 없으면 False) · `layout.MACHINES: dict[str, Machine]`(`Machine(id, x, z, ry, set, row)`), `layout.MACHINE_IDS: tuple[str, ...]`(배치 순서), `layout.COUNTERS: tuple[Counter, ...]`(`Counter(id, x, z, ry, window: Position, queue: tuple[Position, ...])`), `layout.OBSTACLES: tuple[tuple[float, float, float, float], ...]`(x0, z0, x1, z1), `layout.MACHINE_SPEC`(`front, reach, play_half: tuple[float,float], hole: tuple[float,float,float], claw_speed, play_seconds`), `layout.front_spot(m: Machine) -> Position`
- Produces (TS): `DOLLS: Record<string, DollInfo>`(`{id,name,set,rare,base?}`), `SETS: SetInfo[]`(`{id,name,color}`), `isRare(id): boolean` · `MACHINES: MachineSpot[]`(`{id,x,z,ry,set,row}`), `COUNTERS: CounterSpot[]`(`{id,x,z,ry,window:[x,z],queue:[x,z][]}`), `OBSTACLES: [number,number,number,number][]`, `MACHINE_SPEC`, `frontSpot(m): Vec2`

**데이터 값:**
- `catalog.json`: `sets` = `soft 말랑 동물 #ff7ab6` · `forest 숲속 친구들 #2fbf8f` · `water 물가 친구들 #3fa8f0` · `dream 꿈동산 친구들 #9a6bff`. `dolls` 28개 — soft: bunny 토끼, bear 곰돌이, cat 고양이, dog 강아지, panda 판다, hamster 햄찌, ★starbunny 별빛 토끼(base bunny) / forest: fox 여우, raccoon 너구리, squirrel 다람쥐, owl 부엉이, deer 아기사슴, hedgehog 고슴도치, ★goldfox 황금 여우(base fox) / water: penguin 펭귄, frog 개구리, duck 오리, seal 물범, octopus 문어, whale 고래, ★pearlpenguin 진주 펭귄(base penguin) / dream: chick 병아리, pig 꿀꿀이, sheep 양, cow 젖소, dino 공룡, unicorn 유니콘, ★rainbowdino 무지개 공룡(base dino). 각 항목 `{"id","name","set","rare"[, "base"]}`.
- `store_layout.json`:
  - `"machine": {"front": 1.15, "reach": 1.2, "play_half": [0.44, 0.38], "hole": [-0.36, 0.27, 0.24], "claw_speed": 0.35, "play_seconds": 20}`
  - `"machines"` 35대, 이 순서로: 벽 줄 A-1…A-13 `x=(i-7)*1.85, z=-12.35, ry=0, row="wall"` · 섬 앞줄 B-1…B-11 `x=(j-6)*1.85, z=-7.6, ry=3.141593, row="island"`(벽 쪽을 봄) · 섬 뒷줄 C-1…C-11 `x=(j-6)*1.85, z=-6.55, ry=0, row="island"`(허브 쪽을 봄). `set`은 이 순서의 번호 k(0부터)로 `SET_IDS[k % 4]`. x는 소수 2자리.
  - `"counters"`: `{"id":0,"x":-2.9,"z":-3.7,"ry":0,"window":[-2.9,-2.6],"queue":[[-2.9,-2.6],[-3.65,-2.6],[-4.4,-2.6],[-5.15,-2.6],[-5.9,-2.6],[-6.65,-2.6]]}`, `{"id":1,"x":2.9,"z":3.7,"ry":3.141593,"window":[2.9,2.6],"queue":[[2.9,2.6],[3.65,2.6],[4.4,2.6],[5.15,2.6],[5.9,2.6],[6.65,2.6]]}` (서로 마주 봄, 설계 §3.2)
  - `"obstacles"`: 탑 `[-1.3,-1.3,1.3,1.3]` · 벽 줄 `[-11.75,-13,11.75,-11.55]` · 섬 `[-9.9,-8.4,9.9,-5.75]` · 교환소 `[-4.1,-4.2,-1.7,-3.2]`, `[1.7,3.2,4.1,4.2]`
- 기계 앞자리: `(x + sin(ry)·front, z + cos(ry)·front)`.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```python
# server/tests/domain/test_shared_data.py
SHARED = Path(__file__).resolve().parents[3] / "shared"

def test_generated_module_matches_shared_json():
    assert shared_data.CATALOG == json.loads((SHARED / "catalog.json").read_text(encoding="utf-8"))
    assert shared_data.LAYOUT == json.loads((SHARED / "store_layout.json").read_text(encoding="utf-8"))

def test_catalog_has_four_sets_of_six_plus_one_rare():
    assert len(catalog.DOLLS) == 28
    for s in catalog.SET_IDS:
        normals, rare = catalog.set_kinds(s)
        assert len(normals) == 6 and catalog.DOLLS[rare].rare
    assert catalog.is_rare("starbunny") and not catalog.is_rare("bunny") and not catalog.is_rare("nope")

def test_layout_has_35_big_machines_in_three_rows():
    ids = layout.MACHINE_IDS
    assert len(ids) == 35 and ids[0] == "A-1" and ids[13] == "B-1" and ids[-1] == "C-11"
    a1, b1 = layout.MACHINES["A-1"], layout.MACHINES["B-1"]
    assert (a1.x, a1.z, a1.ry, a1.set, a1.row) == (-11.1, -12.35, 0, "soft", "wall")
    assert (b1.x, b1.z, b1.set) == (-9.25, -7.6, "forest")   # 14번째 → 13 % 4 = 1

def test_front_spot_is_in_front_of_the_machine():
    f = layout.front_spot(layout.MACHINES["A-1"]); assert (round(f.x, 2), round(f.z, 2)) == (-11.1, -11.2)
    f = layout.front_spot(layout.MACHINES["B-1"]); assert (round(f.x, 2), round(f.z, 2)) == (-9.25, -8.75)

def test_counters_have_six_slots_starting_at_the_window():
    assert len(layout.COUNTERS) == 2
    for c in layout.COUNTERS:
        assert len(c.queue) == 6 and c.queue[0] == c.window
```

```ts
// client/src/data/data.test.ts
test('catalog and layout match the shared files', () => {
  expect(Object.keys(DOLLS)).toHaveLength(28);
  expect(isRare('pearlpenguin')).toBe(true);
  expect(MACHINES).toHaveLength(35);
  const b1 = MACHINES.find((m) => m.id === 'B-1')!;
  const f = frontSpot(b1);
  expect([+f.x.toFixed(2), +f.z.toFixed(2)]).toEqual([-9.25, -8.75]);
  expect(COUNTERS.map((c) => c.queue.length)).toEqual([6, 6]);
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd server && uv run pytest tests/domain/test_shared_data.py -q; npm --prefix client test -- data` / Expected: 모듈 없음으로 FAIL

- [ ] **Step 3: JSON 두 개를 위 값대로 쓰고, `gen_shared.py`를 만든다** — `python scripts/gen_shared.py`가 두 JSON을 읽어 `CATALOG = {...}`, `LAYOUT = {...}`를 `pprint.pformat`으로 쓴 `shared_data.py`를 만든다(맨 위에 "생성 파일 — shared/*.json을 고치고 다시 생성" 주석). `catalog.py`·`layout.py`는 `shared_data`를 읽어 위 Interfaces의 frozen dataclass로 바꾼다. TS는 `import catalog from '../../../shared/catalog.json'`로 읽어 타입을 붙인다.

- [ ] **Step 4: 통과 확인** — Run: `cd server && uv run python scripts/gen_shared.py && uv run pytest -q && PYTHONPATH=src uv run lint-imports; npm --prefix client test && npm --prefix client run build` / Expected: 전부 통과, 계약 2개 유지

- [ ] **Step 5: 커밋** — `git add shared server/scripts/gen_shared.py server/src/toycrane/domain server/tests/domain client/src/data client/vite.config.ts && git commit -m "feat: 인형 목록·매장 배치 공용 데이터"`

---

### Task 2: 기계·교환소에 막히기 (서버·화면 같은 규칙)

지금은 탑에만 막힌다. 기계 줄·섬·교환소를 지나가지 못하게 한다.

**Files:**
- Create: `shared/clamp_fixtures.json`
- Modify: `server/src/toycrane/domain/store_rules.py` (`clamp_to_floor`가 `layout.OBSTACLES`를 차례로 적용, `TOWER_HALF` 상수는 스폰·기존 테스트용으로 남김)
- Modify: `client/src/game/movement.ts` (`clampToFloor`가 `OBSTACLES`를 적용)
- Test: `server/tests/domain/test_store_rules.py`, `client/src/game/movement.test.ts`

**Interfaces:**
- Consumes: Task 1 `OBSTACLES`
- Produces: `clamp_to_floor(p) -> Position` / `clampToFloor(p): Vec2` — 시그니처 그대로, 규칙만 넓어짐

**규칙:** 바닥 ±12.6으로 자른 뒤, 점이 상자 안(경계 제외)에 있는 장애물마다 덜 파고든 축으로 가까운 변까지 밀어낸다. 파고든 깊이 `dz = min(z-z0, z1-z)`, `dx = min(x-x0, x1-x)`; `dz <= dx`면 z를, 아니면 x를 민다. 양쪽 변까지 거리가 같으면 상자 가운데 기준 부호로(−0은 음수 쪽 — 1단계 탑 규칙과 같음).

- [ ] **Step 1: 계약 견본과 실패하는 테스트를 쓴다** — `shared/clamp_fixtures.json`:

```json
[
  {"in": [0.5, 1.0], "out": [0.5, 1.3], "why": "탑"},
  {"in": [0.0, -12.0], "out": [0.0, -11.55], "why": "벽 줄 기계"},
  {"in": [3.0, -6.0], "out": [3.0, -5.75], "why": "섬 허브 쪽"},
  {"in": [3.0, -8.2], "out": [3.0, -8.4], "why": "섬 벽 쪽"},
  {"in": [-2.9, -3.4], "out": [-2.9, -3.2], "why": "교환소"},
  {"in": [20.0, 0.0], "out": [12.6, 0.0], "why": "바닥 밖"},
  {"in": [5.0, 5.0], "out": [5.0, 5.0], "why": "빈 바닥"}
]
```

```python
@pytest.mark.parametrize("case", json.loads((SHARED / "clamp_fixtures.json").read_text(encoding="utf-8")))
def test_clamp_matches_shared_fixture(case):
    p = clamp_to_floor(Position(*case["in"]))
    assert (round(p.x, 3), round(p.z, 3)) == tuple(case["out"]), case["why"]
```

```ts
test.each(fixtures)('clamp matches shared fixture: $why', ({ in: [x, z], out }) => {
  const p = clampToFloor({ x, z });
  expect([+p.x.toFixed(3), +p.z.toFixed(3)]).toEqual(out);
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd server && uv run pytest tests/domain/test_store_rules.py -q; npm --prefix client test -- movement` / Expected: 벽 줄·섬·교환소 케이스 FAIL, 탑·바닥 케이스 PASS

- [ ] **Step 3: 두 쪽 `clamp`를 위 규칙으로 바꾼다**

- [ ] **Step 4: 통과 확인** — Run: `cd server && uv run pytest -q; npm --prefix client test` / Expected: 전부 통과(1단계 이동 예산·스폰 테스트 포함)

- [ ] **Step 5: 커밋** — `git commit -am "feat: 기계·교환소에 막히기(서버·화면 같은 규칙)"` (+ `git add shared/clamp_fixtures.json`)

---

### Task 3: 인형 28종 모양 (화면)

시제품 `docs/reference/prototypes/spike-arcade-big-v3.html`의 `makeDoll`(225~536행)과 텍스처 함수를 TypeScript로 옮긴다. 키 이름만 바꾼다: `rare→starbunny`, `rainbow→rainbowdino`(나머지 그대로).

**Files:**
- Create: `client/src/world/dolls.ts`, `client/src/world/dollTextures.ts`, `client/src/test/canvasStub.ts`, `client/src/world/dolls.test.ts`
- Create: `client/dev/dolls.html`, `client/dev/dolls.ts` (개발 서버에서만 여는 줄 세우기 화면, `vite build` 입력에 넣지 않음)
- Modify: `client/src/world/toon.ts` (`SPH_LO`, `SPH`, `cap` 등 인형이 쓰는 공용 도형이 없으면 추가)

**Interfaces:**
- Consumes: Task 1 `DOLLS`
- Produces: `makeDoll(id: string, lite?: boolean): THREE.Group | null` — 목록에 없는 id는 `null`. 희귀 인형의 왕관 그룹 이름은 `'crown'`. `lite`는 기계 속 무더기용(면 수 낮춤, 볼터치·눈 반짝이·팔다리 잔부품 생략).
- Produces: `stubCanvas(): void` — 테스트에서 `document.createElement('canvas')`를 아무 그리기 호출이나 받아 주는 가짜로 바꾼다(텍스처 만드는 코드가 노드에서 돌게).

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
beforeAll(stubCanvas);
const meshes = (g: THREE.Object3D) => { let n = 0; g.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; }); return n; };

test('every catalog doll builds a model', () => {
  for (const id of Object.keys(DOLLS)) expect(meshes(makeDoll(id)!)).toBeGreaterThan(5);
});
test('rare dolls wear a crown', () => {
  expect(makeDoll('starbunny')!.getObjectByName('crown')).toBeDefined();
  expect(makeDoll('bunny')!.getObjectByName('crown')).toBeUndefined();
});
test('lite dolls skip small parts', () => {
  expect(meshes(makeDoll('bear', true)!)).toBeLessThan(meshes(makeDoll('bear')!));
});
test('unknown doll id gives null', () => expect(makeDoll('nope')).toBeNull());
```

- [ ] **Step 2: 실패 확인** — Run: `npm --prefix client test -- dolls` / Expected: FAIL(모듈 없음)

- [ ] **Step 3: 옮긴다** — 시제품 코드를 그대로 옮기되 `toon`·`part`·`canvasTex`는 `world/toon.ts`의 것을 쓴다. 텍스처(별·진주·무지개·다람쥐 무늬)는 `dollTextures.ts`에서 처음 쓸 때 한 번만 만든다. `spinners`(희귀 반짝이 회전)는 `makeDoll`이 그룹의 `userData.spin = [{obj, speed}]`로 돌려주고, 돌리는 쪽(Task 11)이 처리한다.

- [ ] **Step 4: 통과 확인** — Run: `npm --prefix client test && npm --prefix client run build` / Expected: 통과

- [ ] **Step 5: 눈으로 확인** — `npm --prefix client run dev` 후 `http://localhost:5173/dev/dolls.html`(4세트 × 7종을 4줄로)을 헤드리스 크롬으로 캡처해서 시제품과 비교한다. 다람쥐 무늬·희귀 재질·왕관이 보여야 한다.

- [ ] **Step 6: 커밋** — `git add client/src/world/dolls.ts client/src/world/dollTextures.ts client/src/test client/src/world/dolls.test.ts client/dev client/src/world/toon.ts && git commit -m "feat: 인형 28종 모양"`

---

### Task 4: 큰인형 기계 35대 + 가리면 반투명 (화면)

시제품 `makeMachine`(642~711행), `fillDolls`, `bake`(111~129행), `marqueeTex`·`plateTex`·`makeFlag`를 옮긴다. 기계 이름표는 시제품 `NAMES`·`TOPS`를 배치 순서대로 돌려 쓴다(오리지널 이름). 깃발은 홀수 번째 기계에.

**Files:**
- Create: `client/src/world/machine.ts`, `client/src/world/bake.ts`, `client/src/world/bigZone.ts`, `client/src/world/bigZone.test.ts`, `client/src/world/bake.test.ts`
- Modify: `client/src/game/occlusion.ts` (+ `Occluder`, `OcclusionFader`), `client/src/game/occlusion.test.ts`, `client/src/world/storeScene.ts` (탑을 `Occluder`로 돌려줌), `client/src/main.ts`
- Create: `client/e2e/shot.mjs`

**Interfaces:**
- Consumes: Task 1 `MACHINES`, `MACHINE_SPEC`; Task 3 `makeDoll`
- Produces: `bakeByMaterial(root: THREE.Object3D): THREE.Mesh[]` — 같은 재질끼리 월드 좌표로 합친 메시들(`mergeGeometries`)
- Produces: `buildBigZone(scene): BigZone` —
  `setContents(machineId: string, dolls: DollSpot[]): void`(`DollSpot = [id, x, z, r]`, 목록에 없는 id는 건너뜀, 그 기계가 속한 행의 인형 묶음만 다시 합침) ·
  `clawOf(machineId): THREE.Object3D` · `flash(machineId: string, gold: boolean, seconds: number): void` ·
  `update(t: number): void`(깜빡임) · `occluders: Occluder[]`(행 2개: `wall`, `island`) · `worldOf(machineId): THREE.Object3D`(기계 위치·방향, 모션·카메라가 씀)
- Produces: `interface Occluder { box: THREE.Box3; setOpacity(o: number): void }`, `class OcclusionFader { constructor(occluders: Occluder[]); update(dt: number, eye: THREE.Vector3, at: Vec2): void }` — 머리(1.2m)·몸통(0.4m) 중 하나라도 가리는 가림막만 0.25까지 흐리고 나머지는 1로(각각 따로 부드럽게)
- 그리기 구성: 행마다 고정 부분은 재질별로 하나씩 합치고(행 전용 재질 복제 — 흐려질 때 다른 행에 번지지 않게), 기계마다 LED는 재질별로(파랑·분홍·흰색) 합쳐 기계별로 깜빡일 수 있게, 집게는 기계마다 따로, 기계 속 인형은 행마다 lite 인형을 재질별로 합친다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
test('bake merges meshes that share a material', () => {
  const root = new THREE.Group(), a = toon(0xff0000), b = toon(0x00ff00);
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), a), new THREE.Mesh(new THREE.BoxGeometry(), a), new THREE.Mesh(new THREE.BoxGeometry(), b));
  expect(bakeByMaterial(root)).toHaveLength(2);
});
test('big zone builds 35 machines in two fade rows', () => {
  stubCanvas();
  const zone = buildBigZone(new THREE.Scene());
  expect(zone.occluders).toHaveLength(2);
  expect(MACHINES.every((m) => zone.worldOf(m.id))).toBe(true);
});
test('setContents skips unknown dolls', () => {
  stubCanvas();
  const zone = buildBigZone(new THREE.Scene());
  expect(() => zone.setContents('A-1', [['bunny', 0, 0, 0], ['gone-doll', 0.1, 0.1, 0]])).not.toThrow();
});
test('fader fades only the occluder that blocks', () => {
  const ops: Record<string, number> = {};
  const box = (name: string, b: THREE.Box3) => ({ box: b, setOpacity: (o: number) => { ops[name] = o; } });
  const fader = new OcclusionFader([box('tower', tower), box('far', new THREE.Box3(v(8, 0, 8), v(9, 3, 9)))]);
  for (let i = 0; i < 60; i++) fader.update(1 / 30, v(0, 11, 4), { x: 0, z: -2 });
  expect(ops.tower).toBeCloseTo(0.25); expect(ops.far).toBe(1);
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm --prefix client test` / Expected: 새 테스트 FAIL

- [ ] **Step 3: 구현** — `main.ts`의 `fadeTowerIfBlocking`은 `OcclusionFader`(탑 + 행 2개, Task 5에서 교환소 추가)로 바꾼다. 매장에 들어오기 전 기계 속은 비워 두고, welcome의 `machines`(Task 6)가 오면 `setContents`로 채운다 — 이 태스크에서는 확인용으로 `main.ts`가 아직 welcome에 `machines`가 없으면 기계마다 같은 세트 인형 9개를 임시로 놓는다(Task 6에서 지움).

- [ ] **Step 4: 통과 확인** — Run: `npm --prefix client test && npm --prefix client run build` / Expected: 통과

- [ ] **Step 5: `client/e2e/shot.mjs`를 만들고 눈으로 확인** — 사용: `node client/e2e/shot.mjs <port> <url> <out.png> [phone|pc] [walkTo=x,z]` (저장소 비우고 닉네임 넣고 들어가서, `walkTo`가 있으면 조이스틱·키로 그 지점까지 걸어가 캡처, 화면 위에서 3초 동안 센 초당 프레임을 함께 출력). 확인할 것: 허브에서 위를 보면 기계 줄이 보임(PC), 벽 줄과 섬 사이 통로 `walkTo=0,-10`에서 섬이 반투명해져 내 캐릭터가 보임(휴대폰), 기계 몸통을 걸어서 통과하지 못함, 헤드리스 크롬 휴대폰 화면 초당 프레임 30 이상.

- [ ] **Step 6: 커밋** — `git add client && git commit -m "feat: 큰인형 기계 35대, 가리는 행 반투명"`

---

### Task 5: 코인 교환소 2곳 (화면)

시제품의 교환소(창살 카운터·간판 "코인 교환소"·황동 차단봉, 829~850행)를 옮겨 `COUNTERS` 자리에 둔다. 줄 자리 6칸 바닥에 작은 발자국 표시.

**Files:**
- Create: `client/src/world/coinCounter.ts`, `client/src/world/coinCounter.test.ts`
- Modify: `client/src/main.ts` (교환소를 `OcclusionFader`에 추가)

**Interfaces:**
- Consumes: Task 1 `COUNTERS`, Task 4 `Occluder`
- Produces: `buildCoinCounters(scene): Occluder[]` (교환소마다 하나)

- [ ] **Step 1: 실패하는 테스트** — `test('two counters face each other', ...)`: `buildCoinCounters(scene)` 길이 2, 첫째 상자 중심 (-2.9, -3.7), 둘째 (2.9, 3.7).
- [ ] **Step 2: 실패 확인** — Run: `npm --prefix client test -- coinCounter` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인 + 캡처** — Run: `npm --prefix client test && npm --prefix client run build`, `node client/e2e/shot.mjs … pc` / Expected: 허브 왼쪽 위·오른쪽 아래에 마주 보는 교환소와 차단봉 줄
- [ ] **Step 5: 커밋** — `git commit -m "feat: 코인 교환소 2곳"`

---

### Task 6: 지갑·가방 저장과 입장 정보 (서버)

**Files:**
- Create: `server/migrations/0002_coins_bag.sql`:
  `CREATE TABLE wallets (guest_id TEXT PRIMARY KEY, coins INTEGER NOT NULL, updated_at REAL NOT NULL);`
  `CREATE TABLE bag (guest_id TEXT NOT NULL, doll TEXT NOT NULL, zone TEXT NOT NULL, count INTEGER NOT NULL, first_at REAL NOT NULL, PRIMARY KEY (guest_id, doll, zone));`
- Create: `server/src/toycrane/domain/crane.py` (이번엔 배치 만들기만), `domain/coins.py`(상수)
- Create: `app/ports/output/{wallet_port,bag_port,machine_contents_port,queue_registry_port,play_lock_port}.py`, `app/dtos/store_snapshot.py`, `app/use_cases/machine_contents.py`
- Create: `adapter/outbound/{d1_wallet_adapter,d1_bag_adapter,do_storage_machine_contents,attachment_queue_registry,attachment_play_locks}.py`
- Modify: `app/use_cases/enter_interactor.py`, `app/ports/output/connections_port.py`(`send_welcome`에 `snapshot` 인자), `adapter/inbound/ws/schemas/server_messages.py`, `adapter/outbound/ws_connections_adapter.py`, `dependencies/enter_provider.py`, `shared/protocol_fixtures.json`(`server_welcome`에 새 필드)
- Modify (화면): `client/src/net/protocol.ts`(welcome 새 필드 타입), `client/src/net/protocol.test.ts`(갱신된 견본 decode), `client/src/main.ts`(welcome `machines`로 기계 속 채우기, `coins`·`bag`은 Task 8 HUD 전까지 보관만)
- Test: `tests/domain/test_crane.py`, `tests/app/use_cases/test_enter_interactor.py`, `tests/adapter/test_attachment_state.py`, `tests/adapter/test_server_messages.py`, `tests/fakes.py`

**Interfaces:**
- Produces (domain): `DollSpot(kind: str, x: float, z: float, r: float)` frozen, `DOLLS_PER_MACHINE = 9`, `RARE_CHANCE = 0.06`, `generate_contents(set_id: str, rng: random.Random) -> list[DollSpot]` — 놀이 영역(`play_half`) 안, 상품 구멍(`hole` 원) 밖, 소수 3자리(r은 2자리). `coins.py`: `COINS_PER_TAKE = 5`, `WALLET_CAP = 15`, `TAKE_SECONDS = 2.0`, `TAKE_SLACK = 0.3`, `HEAD_TIMEOUT = 8.0`, `WINDOW_REACH = 1.0`
- Produces (ports):
  - `WalletPort`: `async balance(guest_id) -> int`(없으면 0) · `async add(guest_id, n, cap, now) -> int`(새 잔액, cap 넘는 만큼 버림) · `async spend_one(guest_id, now) -> int | None`(0개면 None)
  - `BagPort`: `async total(guest_id) -> int` · `async add(guest_id, doll, zone, now) -> int`(새 합계)
  - `MachineContentsPort`: `async load() -> dict[str, list[DollSpot]]` · `async save(contents: dict[str, list[DollSpot]]) -> None` (DO 저장소 키 `"machines"`, 값은 JSON 문자열)
  - `QueueRegistryPort`: `members(counter: int) -> list[QueueMember]`(들어온 순서, `QueueMember(conn_id, player_id, joined_at, head_since: float | None)`) · `counter_of(conn_id) -> int | None` · `join(conn_id, counter, now)` · `remove(conn_id)` · `mark_head(conn_id, now)` — attachment 키 `"queue": {"c", "at", "head"}`
  - `PlayLockPort`: `holder(machine_id) -> tuple[str, float] | None`(conn_id, 시작 시각) · `lock_of(conn_id) -> tuple[str, float] | None` · `lock(conn_id, machine_id, now)` · `release(conn_id)` · `plays() -> dict[str, str]`(기계 id → 하는 사람 player_id, welcome용) — attachment 키 `"play": {"m", "at"}`
  - `ensure_contents(port, rng) -> dict[str, list[DollSpot]]` — 저장된 것에 없는 기계만 만들어 채우고, 새로 만든 게 있으면 한 번 저장
- Produces (DTO): `StoreSnapshot(coins: int, bag: int, machines: dict[str, list[DollSpot]], queues: list[list[str]], plays: dict[str, str])` — queues는 교환소 순서대로 player_id 목록, plays는 기계 id → player_id
- EnterInteractor 생성자에 `wallet, bag, contents, queues, locks, rng` 추가. welcome에 snapshot을 담는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```python
# test_crane.py
def test_generated_contents_stay_in_play_area_and_out_of_hole():
    spots = generate_contents("soft", random.Random(1))
    assert len(spots) == 9
    hx, hz, hr = MACHINE_SPEC.hole
    for s in spots:
        assert abs(s.x) <= 0.44 and abs(s.z) <= 0.38
        assert math.hypot(s.x - hx, s.z - hz) >= hr
        assert DOLLS[s.kind].set == "soft"

def test_generated_contents_are_repeatable_for_a_seed():
    assert generate_contents("water", random.Random(7)) == generate_contents("water", random.Random(7))

# test_enter_interactor.py (가짜: FakeWallet(balance), FakeBag(total), FakeContents, FakeQueues, FakeLocks)
async def test_welcome_carries_coins_bag_and_machines():
    contents = FakeContents()
    it = enter_interactor(wallet=FakeWallet({"g-1": 7}), bag=FakeBag({"g-1": 2}), contents=contents)
    await it.enter(cmd("c-1", "g-1"))
    snap = conns.direct[0][1]
    assert snap["coins"] == 7 and snap["bag"] == 2
    assert len(snap["machines"]) == 35 and all(len(v) == 9 for v in snap["machines"].values())
    assert snap["queues"] == [[], []] and snap["plays"] == {}
    assert contents.saves == 1

async def test_second_enter_reuses_saved_machines():
    contents = FakeContents()
    await enter_interactor(contents=contents).enter(cmd("c-1", "g-1"))
    await enter_interactor(contents=contents).enter(cmd("c-2", "g-2"))
    assert contents.saves == 1

# test_attachment_state.py (FakeWs: serializeAttachment/deserializeAttachment, FakeCtx: getWebSockets)
def test_queue_members_come_in_join_order():
    ctx = FakeCtx(conn("c-1", "p1"), conn("c-2", "p2"))
    q = AttachmentQueueRegistry(ctx)
    q.join("c-2", 0, 5.0); q.join("c-1", 0, 6.0)
    assert [m.player_id for m in q.members(0)] == ["p2", "p1"]

def test_play_lock_round_trip():
    locks = AttachmentPlayLocks(FakeCtx(conn("c-1", "p1")))
    locks.lock("c-1", "A-3", 10.0)
    assert locks.holder("A-3") == ("c-1", 10.0) and locks.lock_of("c-1") == ("A-3", 10.0)
    locks.release("c-1"); assert locks.holder("A-3") is None
```

`test_server_messages.py`: `welcome(...)`가 갱신된 `server_welcome` 견본과 같다.

- [ ] **Step 2: 실패 확인** — Run: `cd server && uv run pytest -q` / Expected: 새 테스트 FAIL
- [ ] **Step 3: 구현** — D1 어댑터 SQL: 잔액 `SELECT coins FROM wallets WHERE guest_id=?` · 더하기 `INSERT INTO wallets VALUES (?1, MIN(?2, ?3), ?4) ON CONFLICT(guest_id) DO UPDATE SET coins = MIN(coins + ?2, ?3), updated_at = ?4 RETURNING coins` · 하나 쓰기 `UPDATE wallets SET coins = coins - 1, updated_at = ?2 WHERE guest_id = ?1 AND coins >= 1 RETURNING coins` · 가방 `INSERT INTO bag VALUES (?1, ?2, ?3, 1, ?4) ON CONFLICT DO UPDATE SET count = count + 1` 뒤 `SELECT COALESCE(SUM(count), 0) FROM bag WHERE guest_id=?`. DO 저장소는 `await ctx.storage.get("machines")`/`put("machines", json)`. `main.ts`의 임시 인형 채우기(Task 4)를 지우고 welcome의 `machines`로 채운다.
- [ ] **Step 4: 통과 확인** — Run: `cd server && npx wrangler d1 migrations apply toycrane --local && uv run pytest -q && PYTHONPATH=src uv run lint-imports && cd .. && npm --prefix client test && npm --prefix client run build` / Expected: 통과. 로컬 서버 다시 띄우고 `node server/scripts/smoke.mjs http://localhost:8787 together walk` OK(welcome 형식이 바뀌어도 1단계 케이스 유지)
- [ ] **Step 5: 커밋** — `git add server shared client && git commit -m "feat: 지갑·가방 저장, 입장 정보에 코인·기계 속 인형"`

---

### Task 7: 코인 교환소 줄 (서버)

슬라이스 3개: `queue_join`, `queue_leave`, `coin_take`. 그리고 `leave_interactor`가 나간 사람을 줄에서 뺀다.

**Files:**
- Create: `domain/coin_queue.py`, `app/dtos/{queue_dto,take_dto}.py`, `app/ports/input/{queue_join,queue_leave,coin_take}_use_case.py`, `app/use_cases/{queue_join,queue_leave,coin_take}_interactor.py`, `adapter/inbound/ws/{queue_join,queue_leave,coin_take}_handler.py`, `adapter/inbound/ws/schemas/queue_schema.py`, `dependencies/{queue_join,queue_leave,coin_take}_provider.py`
- Modify: `ws_router.py`(`queue`·`unqueue`·`take`), `connections_port.py`(+ `broadcast_queue(counter, player_ids)`, `send_queue_no(conn_id, counter, why)`, `send_coins(conn_id, total, got)`), `server_messages.py`, `ws_connections_adapter.py`, `leave_interactor.py`, `dependencies/leave_provider.py`, `shared/protocol_fixtures.json`
- Test: `tests/domain/test_coin_queue.py`, `tests/app/use_cases/test_{queue_join,queue_leave,coin_take,leave}_interactor.py`, `tests/adapter/test_queue_schema.py`

**Interfaces:**
- Consumes: Task 6 `WalletPort`, `QueueRegistryPort`, `coins.py`, `layout.COUNTERS`, `PlayerRegistryPort`(위치 확인)
- Produces (domain): `stale_head(members: list[QueueMember], now: float) -> bool`(맨 앞의 `head_since`가 있고 `now - head_since > HEAD_TIMEOUT`) · `can_take(head: QueueMember, now: float) -> bool`(`now >= head_since + TAKE_SECONDS - TAKE_SLACK`)
- Produces (app, 공통 규칙 — 세 인터랙터가 줄을 바꾼 뒤 꼭 거치는 도우미 `settle_queue(queues, connections, counter, now)`): 오래된 맨 앞을 빼고(여러 명이면 반복), 새 맨 앞의 `head_since`가 없으면 지금으로 표시하고, `broadcast_queue`로 순서를 모두에게 알린다.
- 동작:
  - `join(conn, c, now)`: 교환소 번호가 아니면 무시. 이미 어느 줄에 있으면 무시. `settle` 뒤 6명이 차 있으면 `send_queue_no(conn, c, "full")`. 아니면 넣고 `settle`.
  - `leave(conn, now)`: 줄에 없으면 무시. 빼고 `settle`.
  - `take(conn, now)`: 줄 맨 앞이 아니거나, `can_take`가 아니거나, 창구에서 1.0m 밖이면 무시. 잔액을 읽고 `add(guest, 5, 15, now)` → `send_coins(conn, total, total - before)`. 줄에서 빼고 `settle`.
  - `leave_interactor`: 나가는 사람이 줄에 있었으면 빼고 `settle`.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```python
async def test_join_lines_up_in_order_and_marks_the_head():
    q, conns = FakeQueues(), FakeConnections()
    await join(q, conns).join(JoinCommand("c-1", 0, now=1.0))
    await join(q, conns).join(JoinCommand("c-2", 0, now=2.0))
    assert conns.broadcasts[-1] == (None, queue_msg(0, ["p1", "p2"]))
    assert q.head_since("c-1") == 1.0 and q.head_since("c-2") is None

async def test_seventh_person_is_told_the_line_is_full(): ...   # send_queue_no(c-7, 0, "full")

async def test_take_gives_five_coins_after_two_seconds_at_the_window():
    # c-1이 맨 앞(1.0에 표시), 창구(-2.9,-2.6)에 서 있음, 지갑 3개
    await take(...).take(TakeCommand("c-1", now=2.8))
    assert conns.direct[-1] == ("c-1", coins_msg(8, 5))
    assert q.members(0) == []

async def test_take_too_early_or_away_from_window_is_ignored():
    # now=2.6(1.0+2.0-0.3=2.7 전) → 무시 / 창구에서 1.5m 떨어짐 → 무시. 지갑 그대로, 줄 그대로

async def test_full_wallet_takes_nothing_but_leaves_the_line():
    # 지갑 15 → coins_msg(15, 0), 줄에서 빠짐

async def test_stale_head_is_skipped_after_8s():
    # c-1 맨 앞(1.0), c-2 둘째. now=9.5에 c-3이 join → c-1 빠지고 c-2가 맨 앞(9.5), 순서 [p2, p3]

async def test_leave_removes_from_queue():
    # leave_interactor로 c-1이 나감 → 줄 [p2], c-2가 맨 앞으로 표시
```

`test_queue_schema.py`: `{"t":"queue","c":0}` → 0, `{"t":"queue","c":2}`·`"0"`·`true`·없음 → `None`.

- [ ] **Step 2: 실패 확인** — Run: `cd server && uv run pytest -q` / Expected: 새 테스트 FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `cd server && uv run pytest -q && PYTHONPATH=src uv run lint-imports` / Expected: 통과, 계약 2개 유지
- [ ] **Step 5: 커밋** — `git add server shared && git commit -m "feat: 코인 교환소 줄(서버)"`

---

### Task 8: 코인 받기 (화면)

**Files:**
- Create: `client/src/game/queueClient.ts`, `client/src/game/queueClient.test.ts`, `client/src/ui/hud.ts`, `client/src/ui/actionButton.ts`
- Modify: `client/src/net/protocol.ts`(+ 2단계 메시지 타입·`decode`·인코더 `encodeQueue(c)`, `encodeUnqueue()`, `encodeTake()`), `client/src/net/protocol.test.ts`, `client/src/game/localPlayer.ts`(`autoTarget: Vec2 | null` — 있으면 입력 대신 그쪽으로 걷기), `client/src/main.ts`

**Interfaces:**
- Consumes: Task 1 `COUNTERS`, Task 7 메시지
- Produces: `class QueueClient` —
  `onQueue(c: number, ids: string[], myId: string, now: number): void` ·
  `entryNear(pos: Vec2): number | null`(줄 맨 끝 빈자리에서 1.5m 안인 교환소 번호, 이미 줄에 있으면 null) ·
  `target(): Vec2 | null`(내 자리) ·
  `tick(pos: Vec2, now: number): 'take' | 'unqueue' | null` — 내 자리에서 1.5m 넘게 벗어나면 `'unqueue'` 한 번, 내가 맨 앞이 된 뒤 창구 1.0m 안에서 2.0초 지나면 `'take'` 한 번 ·
  `status(): { kind: 'none' } | { kind: 'waiting'; place: number } | { kind: 'taking'; progress: number }`
- Produces: `setHud(coins: number, bag: number): void`(왼쪽 위 유리 알약 `🪙 5` · `🎒 2`), `setAction(label: string | null, onPress?: () => void): void`(오른쪽 아래 유리 버튼 하나, 휴대폰·PC 같은 자리, null이면 숨김)
- 화면 흐름: 교환소 근처 → 버튼 "줄 서기" → `queue` 보냄 → 내 자리로 자동으로 걸어감(조이스틱·키를 움직이면 자동 걷기를 멈추고 손으로 걷기) → 상태 알약 "줄 서는 중 · 3번째" → 맨 앞이면 "코인 받는 중…" → `take` → `coins` 오면 HUD 갱신·알약 "🪙 +5"(got=0이면 "코인이 가득 찼어요") · `queue_no full` → "줄이 꽉 찼어요".

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
test('walks to my place in line', () => {
  const q = new QueueClient(); q.onQueue(0, ['p9', 'me'], 'me', 0);
  expect(q.target()).toEqual({ x: -3.65, z: -2.6 });
});
test('walking off the line unqueues once', () => {
  const q = new QueueClient(); q.onQueue(0, ['me'], 'me', 0);
  expect(q.tick({ x: -2.9, z: -0.8 }, 1)).toBe('unqueue');
  expect(q.tick({ x: -2.9, z: -0.8 }, 2)).toBeNull();
});
test('take is sent two seconds after reaching the window at the head', () => {
  const q = new QueueClient(); q.onQueue(0, ['me'], 'me', 10);
  expect(q.tick({ x: -2.9, z: -2.6 }, 11.9)).toBeNull();
  expect(q.tick({ x: -2.9, z: -2.6 }, 12.05)).toBe('take');
  expect(q.tick({ x: -2.9, z: -2.6 }, 12.5)).toBeNull();
});
test('2단계 server messages decode from fixtures', () => { /* server_queue, server_coins, server_queue_no … decode가 null 아님 */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm --prefix client test` / Expected: FAIL
- [ ] **Step 3: 구현** — `take` 시각은 "맨 앞이 된 순간(내 화면 기준)"부터 센다. 서버가 0.3초 여유를 두므로 화면은 2.0초 뒤 보낸다.
- [ ] **Step 4: 통과 확인** — Run: `npm --prefix client test && npm --prefix client run build` / Expected: 통과. 스모크에 `coins` 케이스(Task 12 목록)를 먼저 추가해 로컬에서 OK.
- [ ] **Step 5: 눈으로 확인** — 브라우저 두 개(PC 크기)로 같은 교환소에 줄을 서서 서로 순서대로 서는지, 앞사람이 받고 나가면 뒷사람이 앞으로 걸어오는지, 휴대폰 화면에서 버튼·알약이 조이스틱과 겹치지 않는지 캡처.
- [ ] **Step 6: 커밋** — `git add client server/scripts && git commit -m "feat: 코인 받기(줄 서기·자동으로 걷기·HUD)"`

---

### Task 9: 기계 한 판 판정 (서버)

슬라이스 2개: `play_start`, `drop`. 그리고 `leave_interactor`의 환불.

**Files:**
- Create: `domain/play_rules.py`, `app/dtos/{play_dto,drop_dto}.py`, `app/ports/input/{play_start,drop}_use_case.py`, `app/use_cases/{play_start,drop}_interactor.py`, `adapter/inbound/ws/{play_start,drop}_handler.py`, `adapter/inbound/ws/schemas/{play_schema,drop_schema}.py`, `dependencies/{play_start,drop}_provider.py`
- Modify: `domain/crane.py`(판정·다시 채우기), `ws_router.py`(`play`·`drop`), `connections_port.py`(+ `send_play_ok`, `send_play_no`, `broadcast_play(except_conn, machine_id, player_id)`, `broadcast_result(view: ResultView)`, `broadcast_machine(machine_id, spots)`, `broadcast_free(machine_id)`, `send_bag(conn_id, total)`), `server_messages.py`, `ws_connections_adapter.py`, `leave_interactor.py`, `shared/protocol_fixtures.json`
- Test: `tests/domain/test_crane.py`, `tests/app/use_cases/test_{play_start,drop,leave}_interactor.py`, `tests/adapter/test_{play,drop}_schema.py`

**Interfaces:**
- Consumes: Task 6 포트 전부, `layout.front_spot`, `MACHINE_SPEC`
- Produces (domain `crane.py`): `PART_RADII = (("head", 0.05), ("body", 0.10), ("arm", 0.14))`, `ODDS = {"head": (0.40, 0.40), "body": (0.25, 0.45), "arm": (0.10, 0.45)}`, `RARE_WIN_FACTOR = 0.35` · `clamp_claw(x, z) -> tuple[float, float]`(놀이 영역 안으로) · `Grab(outcome: "win"|"slip"|"miss", part: "head"|"body"|"arm"|"none", index: int | None)` · `judge(spots, x, z, roll: float) -> Grab` — 가장 가까운 인형 중심까지 거리로 부위, `roll < 성공`이면 win, `< 성공+놓침`이면 slip, 아니면 miss(희귀면 성공×0.35, 줄어든 만큼 놓침에 더함, 목록에 없는 인형은 일반) · `restock(spots, index, set_id, rng) -> list[DollSpot]`(index를 빼고 같은 세트에서 하나 새로)
- Produces (domain `play_rules.py`): `PLAY_SECONDS = 20`, `DROP_SLACK = 3.0`, `expired(started, now) -> bool`
- Produces (DTO): `ResultView(machine_id, player_id, x, z, outcome, part, kind: str | None)`
- 동작:
  - `start(conn, m, now)`: 모르는 기계면 무시. 내가 이미 하는 중이면 `play_no playing`. 다른 사람이 잡고 있고 `expired`가 아니면 `play_no busy`(만료면 먼저 그 잠금을 풀고 `broadcast_free`). 기계 앞자리에서 1.2m 밖이면 `play_no far`. **코인을 쓰기 전에 먼저 잠근다**(D1을 기다리는 사이 끼어든 요청이 `busy`를 받게). `spend_one`이 None이면 잠금을 풀고 `play_no coins`. 아니면 `send_play_ok(conn, m, 잔액, 20)`, `broadcast_play(conn, m, 내 player_id)`.
  - `drop(conn, x, z, now)`: 잠금이 없으면 무시. `expired`면 잠금 풀고 `broadcast_free`(결과 없음). 아니면 **먼저 잠금을 푼다**(두 번째 내리기 무시). `clamp_claw` → 저장된 배치에서 `judge(spots, x, z, rng.random())`. win이면 `restock` → 저장 → `bag.add(guest, kind, "big", now)` → `send_bag`. `broadcast_result`(모두). win이면 `broadcast_machine`.
  - `leave_interactor`: 나가는 사람이 잠금을 쥐고 있었으면 `wallet.add(guest, 1, WALLET_CAP, now)`(환불), 잠금 풀고 `broadcast_free`.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```python
# test_crane.py
SPOTS = [DollSpot("bunny", 0.0, 0.0, 0.0), DollSpot("starbunny", 0.3, 0.2, 0.0)]

@pytest.mark.parametrize("x, part", [(0.0, "head"), (0.08, "body"), (0.12, "arm"), (-0.35, "none")])
def test_part_depends_on_distance_to_the_nearest_doll(x, part):
    assert judge(SPOTS, x, -0.0, roll=0.99).part == part

@pytest.mark.parametrize("roll, outcome", [(0.39, "win"), (0.79, "slip"), (0.81, "miss")])
def test_head_odds(roll, outcome):
    assert judge(SPOTS, 0.0, 0.0, roll).outcome == outcome

def test_rare_wins_less_and_slips_more():
    assert judge(SPOTS, 0.3, 0.2, roll=0.15).outcome == "slip"      # 0.40×0.35 = 0.14
    assert judge(SPOTS, 0.3, 0.2, roll=0.13).outcome == "win"

def test_empty_spot_always_misses():
    assert judge(SPOTS, -0.35, -0.3, roll=0.0) == Grab("miss", "none", None)

def test_unknown_kind_is_judged_as_normal():
    assert judge([DollSpot("gone-doll", 0, 0, 0)], 0, 0, roll=0.39).outcome == "win"

def test_restock_keeps_nine_from_the_same_set():
    spots = generate_contents("dream", random.Random(3))
    after = restock(spots, 0, "dream", random.Random(4))
    assert len(after) == 9 and after[:8] == spots[1:] and all(DOLLS[s.kind].set == "dream" for s in after)

def test_claw_is_clamped_into_the_play_area():
    assert clamp_claw(5.0, -5.0) == (0.44, -0.38)

# test_play_start_interactor.py — 플레이어 c-1(p1)이 A-1 앞자리(-11.1,-11.2)에 서 있음
async def test_start_spends_a_coin_and_locks():
    # 지갑 3 → play_ok(A-1, coins=2, limit=20), 다른 사람에게 play(A-1, p1), holder("A-1") == ("c-1", now)

async def test_busy_far_and_no_coins():
    # 다른 접속이 잠금 → play_no busy / 앞자리에서 2m → play_no far / 지갑 0 → play_no coins, 잠금 없음

async def test_expired_lock_is_taken_over():
    # c-2가 0.0에 잠금, now=24.0 → broadcast_free(A-1) 뒤 c-1이 play_ok

async def test_second_start_during_coin_spend_is_busy():
    wallet = SlowWallet({"g-1": 3, "g-2": 3})          # spend_one 안에서 await asyncio.sleep(0)
    await asyncio.gather(start("c-1", "A-1"), start("c-2", "A-1"))   # 둘 다 앞자리에 서 있음
    oks = [m for _, m in conns.direct if m["t"] == "play_ok"]
    nos = [m for _, m in conns.direct if m["t"] == "play_no"]
    assert len(oks) == 1 and nos[0]["why"] == "busy" and wallet.spent == 1

# test_drop_interactor.py — c-1이 A-1을 10.0에 잠금, 저장된 A-1 배치 = SPOTS 가운데 bunny(0,0) 포함
async def test_winning_drop_moves_the_doll_into_the_bag():
    # rng.random() → 0.1, drop(0,0) at 15.0 → result(o=win, part=head, k=bunny) 모두에게,
    # machine(A-1, 9개, bunny 하나 빠지고 새로 채움), bag 합계 send_bag, 잠금 풀림

async def test_late_drop_frees_without_result():
    # now=33.5 (10+20+3 지남) → broadcast_free(A-1), result 없음, 가방 그대로

async def test_double_drop_is_ignored():
    # 두 번째 drop은 아무 메시지도 없음

async def test_drop_without_a_lock_is_ignored(): ...

# test_leave_interactor.py
async def test_leave_mid_play_refunds_and_frees():
    # c-1이 A-1 잠금, 지갑 2 → 나가면 지갑 3, broadcast_free(A-1), holder 없음
```

`test_play_schema.py`: `{"t":"play","m":"A-1"}` → "A-1"; `"Z-9"`·숫자·없음 → None. `test_drop_schema.py`: 유한한 숫자만(참거짓·문자·무한대·없음 → None), 소수 3자리로 반올림.

- [ ] **Step 2: 실패 확인** — Run: `cd server && uv run pytest -q` / Expected: 새 테스트 FAIL
- [ ] **Step 3: 구현** — 인터랙터는 난수 `rng: random.Random`을 받는다(프로바이더는 `random.Random()`).
- [ ] **Step 4: 통과 확인** — Run: `cd server && uv run pytest -q && PYTHONPATH=src uv run lint-imports` / Expected: 통과
- [ ] **Step 5: 커밋** — `git add server shared && git commit -m "feat: 기계 한 판 판정·잠금·환불(서버)"`

---

### Task 10: 기계 한 판 조작 (화면)

**Files:**
- Create: `client/src/game/playSession.ts`, `client/src/game/playSession.test.ts`, `client/src/game/machineCamera.ts`, `client/src/ui/playControls.ts`
- Modify: `client/src/net/protocol.ts`(+ `encodePlay(m)`, `encodeDrop(x, z)` 소수 3자리), `client/src/main.ts`

**Interfaces:**
- Consumes: Task 1 `MACHINE_SPEC`·`frontSpot`, Task 4 `BigZone.clawOf`·`worldOf`, Task 8 `setAction`, Task 9 메시지
- Produces: `class PlaySession` — `constructor(machineId: string, limit: number)` · `update(dt: number, input: Vec2): 'drop' | null`(집게를 `claw_speed`로 움직이고 `play_half` 안으로 자름, 남은 시간이 0이 되면 `'drop'` 한 번) · `requestDrop(): 'drop' | null`(한 번만) · `claw: Vec2` · `remaining: number`
- Produces: `machineCameraPose(m: MachineSpot): { pos: THREE.Vector3; look: THREE.Vector3 }` — 기계 앞 위(기계 좌표 (0, 2.0, 1.7))에서 유리 칸 가운데(0, 1.2, 0)를 봄. 들어갈 때·나올 때 0.6초 동안 부드럽게.
- Produces: `showPlayControls(onDrop: () => void): void` / `hidePlayControls(): void` / `setTimer(seconds: number): void` — 오른쪽 아래 큰 분홍 유리 "내리기" 버튼(PC는 스페이스도), 위쪽 가운데 유리 알약 "18초"
- 화면 흐름: 기계 앞자리 1.2m 안 + 그 기계가 비어 있음 → 버튼 "🪙1 넣고 하기"(코인 0이면 "코인이 없어요 · 교환소로", 누르면 안내만) → `play` → `play_ok`: 걷기 멈추고 기계 카메라, 조이스틱·WASD가 집게를 움직임, 타이머 → 내리기/0초 → `drop` 보내고 결과를 기다림(Task 11이 재생) → 끝나면 걷기 카메라로. `play_no`: busy "다른 사람이 하는 중이에요", coins "코인이 없어요 · 교환소에서 받아요", far "기계 앞에 서 주세요", playing은 무시. 다른 사람이 하는 기계(welcome `plays`·`play`·`free`·`result`로 추적) 앞에서는 버튼 대신 "구경 중".

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
test('claw moves at claw speed and stays inside the play area', () => {
  const s = new PlaySession('A-1', 20);
  s.update(1, { x: 1, z: 0 }); expect(s.claw.x).toBeCloseTo(0.35);
  s.update(1, { x: 1, z: 0 }); expect(s.claw.x).toBeCloseTo(0.44);
});
test('drops once when time runs out', () => {
  const s = new PlaySession('A-1', 20);
  expect(s.update(19.9, { x: 0, z: 0 })).toBeNull();
  expect(s.update(0.2, { x: 0, z: 0 })).toBe('drop');
  expect(s.update(0.2, { x: 0, z: 0 })).toBeNull();
  expect(s.requestDrop()).toBeNull();
});
test('pressing drop works once', () => {
  const s = new PlaySession('A-1', 20);
  expect(s.requestDrop()).toBe('drop'); expect(s.requestDrop()).toBeNull();
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm --prefix client test -- playSession` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm --prefix client test && npm --prefix client run build` / Expected: 통과
- [ ] **Step 5: 눈으로 확인** — 로컬에서 코인 받고 C-6 앞(`walkTo=0,-5.4`)에서 한 판(PC·휴대폰 캡처: 기계 카메라, 내리기 버튼, 타이머). 휴대폰은 조이스틱으로 집게가 움직여야 한다.
- [ ] **Step 6: 커밋** — `git commit -am "feat: 기계 한 판 조작(집게·내리기·기계 카메라)"` (+ 새 파일 add)

---

### Task 11: 모션 8종과 당첨 연출 (화면)

시제품 트윈·자세 표(`P`, 922~944행)·`play()` 순서(1100~1185행)·`burst`·`makeCloud`·`tone`/`sfx`·전광판 `drawBoard`를 옮긴다.

**Files:**
- Create: `client/src/game/tween.ts`, `client/src/game/tween.test.ts`, `client/src/world/motions.ts`, `client/src/world/motions.test.ts`, `client/src/world/effects.ts`, `client/src/audio/sfx.ts`, `client/src/ui/winCard.ts`, `client/src/ui/josa.ts`, `client/src/ui/josa.test.ts`
- Modify: `client/src/world/avatar.ts`(모션용 손잡이), `client/src/world/storeScene.ts`(`HubTower.showMessage(line1, line2, gold, seconds)`), `client/src/game/remotePlayers.ts`(아바타 꺼내기 `rigOf(id)`), `client/src/main.ts`

**Interfaces:**
- Consumes: Task 3 `makeDoll`, Task 4 `BigZone`(`clawOf`, `flash`, `setContents`, `worldOf`), Task 9 메시지, Task 10 `PlaySession` 끝
- Produces: `class Tweens { tween(dur: number, fn: (k: number) => void, ease?: Ease): Promise<void>; update(dt: number): void }`, `ease.{inOut,out,in,back,lin}`
- Produces (avatar): `Avatar.rig: { handL: THREE.Vector3; handR: THREE.Vector3; crouch: number; head: THREE.Object3D; bob: THREE.Object3D; backpack: THREE.Object3D; held: THREE.Object3D | null; holdMode: 'none'|'right'|'both' }` — `update`가 걷지 않을 때 `handL/handR`(몸 기준 목표)로 손을 놓고, `held`를 손에 붙인다.
- Produces (motions): `startPlaying(rig, tw): { stop(): void }`(코인 넣기 → 조이스틱 흔들기 반복) · `playResult(rig, tw, o: 'win'|'slip'|'miss', doll: THREE.Group | null, fx: { bonk(): void; claw(seconds: number): Promise<void>; win(rare: boolean): void }): Promise<void>` — 순서: 내리기 쾅 → 두근두근(집게 1.7초와 함께) → win이면 꺼내기 → 들어 보이기 → 번쩍 → (잠깐) → 가방에 쏙 / slip·miss면 털썩(먹구름). 자세 값은 시제품 `P` 표 그대로(기계를 바라보는 방향으로 아바타를 돌린 뒤).
- Produces (motions, 테스트용): `resultSteps(o): string[]` — win `['bonk','nervous','takeout','show','lift','bag']`, slip·miss `['bonk','nervous','slump']`
- Produces: `eulReul(name: string): '을' | '를'`(마지막 글자 받침 있으면 "을")
- Produces: `showWinCard(name: string, setName: string, rare: boolean, bag: number): void` — 본인만, 가운데 유리 카드("짠! 토끼" / "★ 희귀! 별빛 토끼", 세트 이름, "가방 n개째"), 2초 뒤 저절로 닫힘·눌러도 닫힘
- Produces (effects): `burst(scene, pos, colors, n)`, `sfx.{coin,bonk,win,rare,fail,pop}()` — 첫 터치·클릭("들어가기")에서 `AudioContext`를 연다(아이폰)
- 연결: 나는 `play_ok`, 다른 사람은 `play`에서 `startPlaying`(그 사람을 기계 앞자리에 기계 쪽으로 세움). `result`가 오면 `stop()` 뒤 `playResult` — 집게는 `x,z` 위치로 내려갔다 올라옴(win이면 인형이 집게에 매달려 올라갔다 사라짐), win이면 기계 깜빡임(희귀는 금색) + 터짐 + 소리, 희귀면 모두의 탑 4면 전광판에 6초 동안 `★ 희귀 등장! ★` / `{닉네임} 님이 {이름}{을/를} 뽑았어요`, 본인이면 당첨 카드. `machine` 메시지는 그 기계 결과 연출이 끝난 뒤 `setContents`(먼저 오면 기다렸다가). `free`면 그 사람 모션을 멈추고 기계를 비었다고 표시.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
test('tween resolves after its duration', async () => {
  const tw = new Tweens(); let k = 0; let done = false;
  tw.tween(1, (v) => { k = v; }, ease.lin).then(() => { done = true; });
  tw.update(0.5); expect(k).toBeCloseTo(0.5);
  tw.update(0.6); await Promise.resolve(); expect(k).toBe(1); expect(done).toBe(true);
});
test('result motions follow the prototype order', () => {
  expect(resultSteps('win')).toEqual(['bonk', 'nervous', 'takeout', 'show', 'lift', 'bag']);
  expect(resultSteps('miss')).toEqual(['bonk', 'nervous', 'slump']);
});
test('object particle follows the final consonant', () => {
  expect(eulReul('별빛 토끼')).toBe('를'); expect(eulReul('진주 펭귄')).toBe('을');
  expect(eulReul('무지개 공룡')).toBe('을'); expect(eulReul('황금 여우')).toBe('를');
});
test('avatar exposes a rig for motions', () => {
  stubCanvas();
  const a = makeAvatar(0, '토끼');
  expect(a.rig.head).toBeDefined(); expect(a.rig.held).toBeNull();
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm --prefix client test` / Expected: 새 테스트 FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm --prefix client test && npm --prefix client run build` / Expected: 통과
- [ ] **Step 5: 눈으로 확인** — 로컬에서 브라우저 두 개(나·구경꾼)로 같은 기계: 내 화면은 코인 넣기 → 조이스틱 → 쾅 → 두근 → 결과 모션·카드, 구경꾼 화면도 같은 모션과 기계 깜빡임. 성공이 나올 때까지 코인을 받아 몇 판(`client/e2e/shot.mjs`로 결과 장면 캡처). 희귀는 로컬 D1의 기계 배치를 손으로 바꾸지 말고, `judge`·전광판은 테스트로 확인했으니 전광판 문구는 개발자 도구에서 `showMessage`를 한 번 불러 캡처로 확인.
- [ ] **Step 6: 커밋** — `git add client && git commit -m "feat: 모션 8종·당첨 카드·기계 깜빡임·희귀 전광판"`

---

### Task 12: 스모크·배포·사람 확인

**Files:**
- Modify: `server/scripts/smoke.mjs` — 케이스 추가: `coins`(줄 서고 1.5초 뒤 `take` 무시 → 2초 뒤 `coins` got 5) · `play`(코인 받고 C-6 앞자리 (0, -5.4)까지 이동 예산 안에서 걸어가 `play_ok` → welcome 배치의 인형 위에 `drop` → 관찰자가 `result`를 받고 형식이 맞음, win이면 `machine`·`bag`) · `busy`(둘째 사람이 같은 기계 `play_no busy`) · `nocoins`(새 게스트 `play_no coins`) · `refund`(`play_ok` 뒤 소켓 닫기 → 다시 들어오면 welcome `coins`가 줄기 전과 같음, 관찰자는 `free`)
- Modify: `README.md` (2단계 확인 기록, 로컬 `migrations apply --local`은 이미 있음)

- [ ] **Step 1: 로컬 스모크** — Run: `node server/scripts/smoke.mjs http://localhost:8787 myself guest admission together twotabs walk unknown coins play busy nocoins refund` / Expected: 전부 `OK`
- [ ] **Step 2: 원격 D1 표** — Run: `cd server && npx wrangler d1 migrations apply toycrane --remote` / Expected: `0002_coins_bag.sql ✅`
- [ ] **Step 3: 배포** — Run: `npm --prefix client run build && (cd server && CI=1 uv run pywrangler deploy)` / Expected: `https://toycrane.toycrane.workers.dev`
- [ ] **Step 4: 배포 주소 스모크** — Run: Step 1 케이스 + `idle`을 `https://toycrane.toycrane.workers.dev`로 / Expected: 전부 `OK`
- [ ] **Step 5: 사람이 확인한다** — PC 하나와 휴대폰 하나(카톡 인앱): 둘이 같은 교환소에 줄 서서 코인 받기, 서로 다른 기계에서 한 판씩, 같은 기계를 동시에 누르면 한 사람만 되는지, 남이 하는 모습(코인·조이스틱·결과 모션) 보이는지, 성공하면 당첨 카드·가방 숫자, 하는 도중 휴대폰 창을 닫았다 열면 코인이 돌아오는지.
- [ ] **Step 6: 기록하고 커밋** — README에 확인 날짜·기기·결과. `git commit -am "docs: 2단계 배포 확인"`
