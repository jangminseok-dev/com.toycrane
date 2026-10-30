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
cd server && uv run pywrangler dev # http://localhost:8787
node server/scripts/smoke.mjs http://localhost:8787 myself
```

화면만 고칠 때는 `npm --prefix client run dev`(5173)를 함께 띄우면 `/api`·`/ws`가 8787로 넘어간다.

## 배포

```bash
npx wrangler login                 # 처음 한 번
npm --prefix client run build && (cd server && uv run pywrangler deploy)
```

## 확인 기록

- 파이썬 DO 웹소켓 hibernation: 로컬 workerd에서 확인(2026-10-30, `spikes/py-do-hibernation`). 실제 무료 계정 배포 확인은 대기 중.
