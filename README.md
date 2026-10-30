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
