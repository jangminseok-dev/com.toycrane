# 개발·배포 명령

원래 `README.md`에 있던 준비·검사·로컬 실행·배포 명령을 그대로 옮겼습니다.

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
