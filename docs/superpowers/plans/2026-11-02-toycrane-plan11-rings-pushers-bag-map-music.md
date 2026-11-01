# 고리·미는 뽑기 · 가방 보기 · 지도 · 배경음 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 북쪽 '준비 중' 자리를 진짜 고리 뽑기 10대·미는 뽑기 4대로 바꾸고, 가방 보기·매장 지도·배경음을 더한다.

**Architecture:** 새 두 기계는 결과를 서버가 정한다(브라우저 물리 없음). 화면은 `act {m, x, y}`로 멈춘 자리만 보내고, 서버가 판정·채우기 뒤 `ring`·`pusher`로 모두에게 알리면 화면이 같은 애니메이션을 그린다. 판 잠금·코인·결과·이어 하기는 기존 흐름(`play`/`play_ok`/`result`/`free`)을 그대로 쓴다. 가방은 HTTP `GET /api/bag/{guestId}`, 지도·배경음은 화면만.

**Tech Stack:** three.js/TS, vitest, WebAudio, Python Workers(DO, D1), pytest, import-linter.

**Spec:** `docs/superpowers/specs/2026-11-02-toycrane-rings-pushers-bag-map-music-design.md`

## Global Constraints

- 무료 요금제 안. 배포는 사용자 허락.
- 화면 일본어 금지, 문장을 가운데 점(·)으로 잇지 않음, 효과는 이름표·제자리 반짝임, 털 표현 금지.
- 경품 캐릭터는 우리 24종(`shared/catalog.json`), 희귀 3%·황금 0.5%.
- 휴대폰 관문: 걷기 그리기 호출 ≤ 400, 기계 앞 ≤ 160, 걷기 삼각형 ≤ 180만.
- 규약 12.
- 커밋 끝줄 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. 화면이 엉뚱한 `act`(남의 기계, 판 잠금 없이, 범위 밖·NaN 좌표, 같은 판에 두 번)를 보냄 → 서버가 거절하고 코인·경품·상태가 그대로(Task 2·3 시험).
2. 미는 뽑기 겹침 풀기가 끝나지 않거나 인형이 선반 옆·뒤로 빠짐 → 반복 상한, 옆·뒤 벽 안에 머묾(Task 3 시험).
3. 가방 API로 남의 가방을 봄 → 게스트 id를 아는 사람만(지금 게스트 모델과 같음), 없는 id는 빈 목록(Task 7 시험).
4. 배경음이 소리 끈 뒤에도 남거나 효과음보다 큼 → 끄면 바로 0, 다음 접속에도 꺼짐(Task 9 시험).
5. 지도가 기계 앞 화면에서 버튼·시간 표시를 가림 → 기계 앞에서는 숨김(Task 8 시험).

---

### Task 1: 자리와 공용 수치 — 고리 10대, 미는 뽑기 4대
- Files: `shared/ring.json`, `shared/pusher.json`, `shared/store_layout.json`(rings·pushers, 기계마다 장애물, 고리·미는 뽑기 decor 제거), `client/src/data/rings.ts`, `client/src/data/pushers.ts`, `server/src/toycrane/domain/layout.py`(RINGS, PUSHERS, `machine_spot`), gen_shared
- Produces:
  - `RingSpot {id, x, z, ry, row}`, `RINGS`, `RING`, `isRing`
  - `PusherSpot`, `PUSHERS`, `PUSHER`, `isPusher`
  - `nearestRing`·`nearestPusher`(앞자리 손 닿는 거리)
- 시험:
  - `client/src/data/rings.test.ts`: 'ten ring machines R-1 to R-10 face the plaza', 'every ring front is reachable', 'players can walk between ring machines'
  - 미는 뽑기도 같은 세 시험
  - 서버 `test_layout`: machine_spot이 R·P를 찾음
- 커밋: `feat: 고리·미는 뽑기 기계 자리와 공용 수치`

### Task 2: 서버 — 고리 뽑기 규칙·저장·판
- Files: `server/src/toycrane/domain/ring.py`, `adapter/outbound/do_storage_rings.py`(`rings_v1`), `app/use_cases/rings.py`(`ensure_rings`), `app/use_cases/act_interactor.py`(고리 분기), 포트·의존성·가짜
- Produces:
  - `peg_xy(i) -> (x, y)`
  - `new_board(rng) -> list[Card]`, `Card(kind, color, rare)`
  - `hook(board, x, y, rng) -> HookResult(peg: int | None, caught: bool)`
  - `restock(board, peg, rng) -> list[Card]`
  - ActInteractor: 잠근 사람만, 판마다 한 번, 범위 확인, 걸리면 가방(zone 'ring')·`result`, 모두에게 `ring`
- 시험:
  - 'hook inside the window can catch', 'hook outside the window always misses'
  - 'caught card is replaced'
  - 'act without a lock or twice is refused'
  - 'NaN or out-of-range act is refused'
  - 시뮬 'a careful player needs about 4 to 6 plays'(aim 오차 ±1.5cm, 2000판 50%선 4~6)
- 커밋: `feat: 서버 고리 뽑기 — 갈고리 판정, 채우기, 판`

### Task 3: 서버 — 미는 뽑기 규칙·저장·판
- Files: `server/src/toycrane/domain/pusher.py`, `do_storage_pushers.py`(`pushers_v1`), `app/use_cases/pushers.py`, ActInteractor 미는 뽑기 분기
- Produces:
  - `Item(kind, color, rare, x, z)`
  - `new_shelf(rng)`
  - `push(items, x) -> (after, fallen)`: 결정적, 겹침 풀기 상한 40회, 옆·뒤 벽 안
  - `refill(items, rng)`: 10개 유지
- 시험:
  - 'push moves items in front of the plate'
  - 'items past the front edge fall'
  - 'same push gives the same shelf'
  - 'items stay inside the side and back walls'
  - 'overlap relaxation always ends'
  - 시뮬 'a careful player needs about 4 to 6 plays'
- 커밋: `feat: 서버 미는 뽑기 — 2D 밀기, 채우기, 판`

### Task 4: 규약 12 — act·ring·pusher 메시지, welcome
- Files:
  - 서버: `server_messages.py`(ring, pusher, welcome rings·pushers, PROTOCOL 12), `ws/act_handler.py`, ws_router
  - 화면: `client/src/net/protocol.ts`(encodeAct, decode ring·pusher, Welcome)
  - 공용: `shared/protocol_fixtures.json`
- 시험:
  - 견본 왕복(서버 만들기 = 화면 읽기)
  - 'ring and pusher messages carry only what is shown'
  - PROTOCOL 12 양쪽
- 커밋: `feat: 규약 12 — 고리·미는 뽑기 메시지`

### Task 5: 화면 — 고리 기계 그림·조작·한 판
- Files: `client/src/world/ringMachine.ts`, `ringZone.ts`, `client/src/game/ringPlay.ts`, `figureControls`에 글씨 매개변수, `main.ts` 연결, `ringCamera`(정면)
- 시험:
  - 'ten ring machines draw in a few meshes'(≤ 60)
  - 'cards show their prize'
  - 'hook moves right then up and pokes on release'(세션)
  - 'a ring message replays the poke and swaps the card'
- 확인: e2e `client/e2e/ring.mjs`(한 판 → result·ring 받음, 콘솔 오류 0)
- 커밋: `feat: 고리 뽑기 기계 — 그림, 버튼, 한 판`

### Task 6: 화면 — 미는 뽑기 그림·조작·한 판
- Files: `client/src/world/pusherMachine.ts`, `pusherZone.ts`, `client/src/game/pusherPlay.ts`, `main.ts` 연결
- 시험:
  - 'four pushers draw in a few meshes'
  - 'the plate sweeps left and right'
  - 'a pusher message animates items from before to after and drops the fallen'
- 확인: e2e `client/e2e/pusher.mjs`
- 커밋: `feat: 미는 뽑기 기계 — 그림, 밀기 버튼, 한 판`

### Task 7: 가방 보기
- Files: 서버 `adapter/inbound/http/bag_router.py`(GET /api/bag/{guestId}), D1 어댑터 `list`; 화면 `client/src/net/api.ts`(getBag), `client/src/ui/bagSheet.ts`, `client/src/world/thumbs.ts`(작은 그림), hud 가방 칸 누르기
- 시험:
  - 서버 'bag lists items newest first', 'unknown guest gets an empty list'
  - 화면 'bag sheet groups by zone with counts and rare marks'(목록 만들기 함수)
- 확인: e2e `client/e2e/bag.mjs`(뽑은 뒤 가방 열면 그 이름이 보임)
- 커밋: `feat: 가방 보기 — 뽑은 것 목록`

### Task 8: 매장 지도
- Files: `client/src/ui/minimap.ts`(2D 캔버스, 오른쪽 위), `main.ts`
- 시험:
  - 'map places zones and me where they are'(좌표 변환 함수)
  - 'the map hides at a machine'
- 커밋: `feat: 매장 지도`

### Task 9: 배경음
- Files: `client/src/audio/music.ts`(WebAudio 반복 곡), hud 소리 버튼, `main.ts`
- 시험:
  - 'music is quieter than sound effects'
  - 'muting stops at once and is remembered'
  - 'the loop changes its melody each round'(음표 만들기 함수)
- 커밋: `feat: 게임장 배경음과 소리 버튼`

### Task 10: 연결·확인
- e2e:
  - ring, pusher, bag
  - figure F-1·F-8, figure-run
  - play, run, watch
  - mobile-entry, mobile-joystick
  - determinism
- 성능 `perf.mjs`(고리·미는 뽑기 기계 앞 수치 추가)
- 전체 시험
- PC·휴대폰 스크린샷: 북쪽 구역, 두 기계 판, 가방, 지도
- README '고리·미는 뽑기·가방·지도·배경음'
- 커밋

### Task 11: 최종 리뷰와 배포
- 가장 유능한 모델로 리뷰한다.
- Critical·Important를 한 번에 고친다.
- **사용자 허락**을 받는다(규약 12 새로 고침, D1 마이그레이션 없음).
- 배포·라이브 확인·README Version.
