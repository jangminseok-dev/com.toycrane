# toycrane

같이 노는 온라인 인형뽑기방. 설계: `docs/superpowers/specs/2026-10-30-toycrane-design.md`

- `server/` — Cloudflare Python Workers(매장 Durable Object, D1)
- `client/` — TypeScript + three.js 화면(같은 Worker의 정적 자산으로 배포)
- `shared/` — 서버·화면이 같이 읽는 메시지 견본

## 준비

```bash
brew install uv            # 파이썬 3.14 + 도구
cd server && uv sync       # 서버 개발 의존성
npm --prefix client install
```

## 검사

```bash
cd server && uv run pytest                       # 서버 테스트
cd server && PYTHONPATH=src uv run lint-imports  # 계층 규칙
npm --prefix client test                         # 화면 테스트
```

## 로컬 실행

```bash
npm --prefix client run build      # 정적 자산(client/dist)
cd server && npx wrangler d1 migrations apply toycrane --local  # 처음 한 번(로컬 D1 표 만들기)
cd server && uv run pywrangler dev # http://localhost:8787
node server/scripts/smoke.mjs http://localhost:8787 myself
```

휴대폰 검사(헤드리스 크롬을 `--remote-debugging-port=<port>`로 띄운 뒤): `node client/e2e/mobile-entry.mjs <port> http://localhost:8787`, `node client/e2e/mobile-joystick.mjs <port> http://localhost:8787`

화면 캡처: `node client/e2e/shot.mjs <port> http://localhost:8787 out.png phone "go:-3.3,-1.7;press:4;go:0,-5.4;press:2;shot:playing"` (걷기·버튼 누르기·중간 캡처를 섞어 쓴다, 파일 위 주석 참고)

공용 데이터(`shared/catalog.json`, `shared/store_layout.json`)를 고치면 `cd server && uv run python scripts/gen_shared.py`로 서버용 모듈을 다시 만든다.

화면만 고칠 때는 `npm --prefix client run dev`(5173)를 함께 띄우면 `/api`·`/ws`가 8787로 넘어간다.

## 배포

```bash
npx wrangler login                 # 처음 한 번
cd server && npx wrangler d1 migrations apply toycrane --remote  # 표가 바뀔 때
npm --prefix client run build && (cd server && uv run pywrangler deploy)
```

주소: https://toycrane.toycrane.workers.dev (Workers Free, D1 `toycrane` APAC)

## 확인 기록

- 파이썬 DO 웹소켓 hibernation: 로컬 workerd(2026-10-30)와 실제 무료 계정(2026-10-31)에서 확인 — 20초 조용하면 인스턴스가 새로 깨어나도 접속 2개 유지·둘 다 수신(`spikes/py-do-hibernation`, 시험 Worker는 삭제).
- 1단계 배포(2026-10-31): 배포 주소 스모크 8개 OK(myself guest admission together twotabs walk unknown idle). PC(맥 크롬)와 휴대폰으로 같은 매장에서 서로 보임.
- 접속 중 다시 배포: 가만히 있던 접속은 끊기지 않고 이어짐(배포 뒤 들어온 사람과 서로 보이고 이동 주고받음). 걷던 접속은 1006으로 끊기고 화면이 2~4초 안에 다시 들어감.
- 배포 직후·오래 잠든 매장의 첫 입장은 5~6초(파이썬 서버 깨어나는 시간) — 5단계 성능 다듬기 대상.
- 2단계 배포(2026-10-31): 배포 주소 스모크 13개 OK(myself guest admission together twotabs walk unknown coins play busy nocoins refund idle). Worker 시작 시간 749ms.
- 2단계 로컬 화면 확인(헤드리스 크롬 PC·휴대폰): 교환소 줄 서기→코인 5개, 기계 35대·교환소 60fps, 기계 정면 카메라·겨냥 고리·내리기, 성공 연출(집게→번쩍 들기→당첨 카드), 희귀 무지개 공룡 성공 시 금색 기계·탑 전광판 알림이 구경꾼 화면에도 보임.
- 3단계 그래픽 개편 배포(2026-10-31, 밝은 일본 게임센터 + 만화 고급화, 사용자 2차 피드백 반영): 그리기 호출(30프레임 평균, `client/e2e/perf.mjs`) 개편 전→후 — PC 걷기 1047→883(0.84배), PC 기계 앞 388→440(1.13배), 휴대폰 걷기 455→607(1.33배), 휴대폰 기계 앞 217→253(1.17배) — 기준 1.5배 이하. 삼각형 수 휴대폰 걷기 57만→68만. 실제 휴대폰(카톡 인앱) 부드러움은 사람 확인 대상. e2e mobile-entry·mobile-joystick·버튼 두 개 한 판(PC 마우스·휴대폰 터치)·시간 초과 후 판 사이 버튼·교환소 저절로 걷기 로컬 PASS, 라이브 휴대폰 터치 한 판 PASS. 잡기는 C-6(숲)·C-7(물가, 동글이형) 실제 판 프레임으로 확인 — 모든 결과·모든 인형을 다 본 것은 아님.
