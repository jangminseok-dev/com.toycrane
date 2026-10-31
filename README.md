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
- 레버·하강 버튼 조작과 판 묶음(2026-10-31): 레버 잔상(고정 레버가 남음·겨냥 고리가 레버 위에 그려짐) 수정, 하강 버튼 윗면 '잡기'+화살표, '한 판 더'·'다섯 판 더'(판마다 코인 1, 그만하면 남은 코인 그대로). 라이브 PC 다섯 판 → 2/5판 → 그만하기 PASS.
- 4단계 인형 채우기·희귀·기계 24대 배포(2026-10-31): D1 마이그레이션 0003 원격 적용 — 가방 11행·인형 12개 그대로, 옛 진주 펭귄 → 펭귄+진주. 그리기 호출(`client/e2e/perf-stock.json`) PC 걷기 583, PC 기계 앞 248, 휴대폰 걷기 370, 휴대폰 기계 앞 152(직전 821/425/570/247보다 적음 — 기계 24대·꼭짓점 색). 로컬 e2e: mobile-entry·mobile-joystick PASS, 성공 → stock 30 → 아무도 안 움직인 채 30.5초 뒤 9개로 다시 참(화면 tick)·새 인형 떨어짐 확인, 체형 분포 109/56/51. 라이브: 레버 7판 결과·코인 차감 정상, 다섯 판 흐름 PASS, 캐릭터 간판·색 섞인 무더기 확인 — 라이브에서는 성공이 나오지 않아 채우기는 로컬에서만 봄. 황금 등장 전광판은 확률(0.5%)이라 아직 화면으로 못 봄.
- 5단계 교환소 개편·조르기·코인 주기·광고 간판 배포(2026-10-31): D1 마이그레이션 0004(begged_at) 원격 적용 — 적용 전 지갑 33행 백업. 그리기 호출(`client/e2e/perf-coins.json`) PC 걷기 529, PC 기계 앞 249, 휴대폰 걷기 360, 휴대폰 기계 앞 153. 로컬 e2e: mobile-entry·mobile-joystick PASS, 봇 5명 교환소 조르기 금액 22·47·36·38·16. 라이브: 코인 받기 3번 → 15·'코인이 넉넉해요', 교환소 조르기 → 3초 조르는 동안 코인 수 그대로 → 끝나고 +42, 연타해도 한 번만, 다시 조르면 모션 뒤 '10분 뒤에 다시 와요'(D1 왕복 포함 약 4.5초), 봇이 맵에서 조르면 '주기'·'조르기' 둘 다 뜨고 3개 주기 → 봇 3개·'코인 3개를 줬어요', 한 판 시작 정상.
- 6단계 물리 뽑기(2026-10-31 배포, Version 2871deb9): 서버 판정 대신 브라우저 Rapier 물리(`@dimforge/rapier3d-deterministic-compat` — 기기 사이 같은 결과를 보장하는 빌드). 시뮬레이션 1000판(`cd client && SIM_TRIALS=1000 npm run sim`): 머리 3~4/10·몸통 더 어려움·희귀·황금 더 어려움·구멍 가까운 쪽 < 먼 쪽 모두 통과(최종 리뷰 뒤 앉히기 기준을 엔진 잠듦으로 되돌린 상태), 고수의 장면 4개(탑 위 걸침·아랫부분 잡아 뒤집기·옮기다 떨어뜨려 걸치기·탑 유지) 통과. 그리기 호출(`client/e2e/perf-physics.json`, 최종 리뷰 C1 수정 뒤 재측정) PC 걷기 435·기계 앞 250·한 바퀴 중 244, 휴대폰 걷기 365·기계 앞 151·한 바퀴 중 145(직전 529/249/360/153), 물리 프레임당 PC 0.40ms·휴대폰(CPU 4배 느리게) 0.73ms. e2e: play(한 판·done 보고·13칸 배치) PASS, watch(두 판 연속 — 앞 판 결과 모션 중 "한 판 더"를 눌러도 구경이 이어짐, 중계 77·78개, 구경 화면 배치가 서버와 일치) PASS, determinism(창 둘이 각자 앉힌 기계 13대 자리·돌림 동일) PASS, mobile-entry·mobile-joystick PASS. 헤드리스 크롬은 Mac 화면이 꺼지면 창을 가려진 것으로 보고 멈추므로 `--disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling`로 띄운다. 라이브(배포 뒤, D1 마이그레이션 없음·기계 상태 v3→v4는 모두 안 앉은 채로 이주): welcome 24대 × 9개 모두 안 앉음 확인, play PASS(빈손 → done 보고 → 13칸 배치 9개 앉음), watch 두 판 연속 PASS(중계 73개), determinism PASS(창 둘이 각자 앉힌 5대 일치 — 첫 시도는 Rapier 첫 내려받기 중 60초 안에 못 앉혀 FAIL, 두 번째 PASS). 아이폰 사파리와 PC의 같은 기계 모양 비교는 사용자 확인 대상.
- 6단계 다듬기 배포(2026-11-01): 사용자 라이브 피드백 반영 — 채우기 때 구멍 위에 걸친 인형은 먼 빈 칸에 재낙하(판에서 끌어온 인형은 그대로), 항공샷 모니터가 바닥 아래 받는 상자를 안 보게, 쥔 공 안쪽에 붙여 머리가 손가락 우리 안에 들어오는 모양(ANCHOR_IN 0.5)·쥔 뒤 화면 손가락 파고듦(물리는 그대로), 레버를 유리에서 7cm 띄움, 희귀 배율 0.85→0.82(1000판 희귀 22.2%→기준 안), 이어 하는 중 판 도중에도 그만하기. 로컬 e2e play·watch·run(다섯 판) PASS. 라이브 play·run·watch PASS(Version 59b28a5a). 이어서 판 도중 그만하기를 화면 구석 글자 버튼 대신 조작대 위 파란 '그만' 버튼(레버와 잡기 사이, 이어 하는 중에만)으로 바꿔 배포(Version 07babde1).
- 6단계 다듬기 2차 배포(2026-11-01, Version c48c79dd): 그만하기는 오른쪽 아래 한 곳(이어 하는 중 내내, 누르면 이어 하기 멈춤); 인형이 구르지 않게 감쇠 20/1.8(누운 인형이 고깔처럼 5초 동안 40cm 돌던 것) → 흔들림이 줄어 끊김이 줄자 집게 힘 5.0·희귀 0.65·황금 0.55로 1000판 재조정(머리 3~4/10, 희귀 21%, 황금 10%, 몸통 겨냥 7% — 아랫선 0.03으로 완화), 허브가 얹힌 인형 우선 쥐기(탑 꼭대기). 라이브 play·run·determinism PASS. `sim/sweep.test.ts`는 SWEEP_OUT=<파일>로 결과를 파일에도 쓴다(vitest가 지나가는 테스트의 콘솔을 삼킴).
- 6단계 다듬기 3차 배포(2026-11-01, Version bcc313e0): 판 도중 그만하기 삭제(판 사이의 그만하기만, 누르면 다음 판을 안 시작하고 바로 묻기); 집게에 맞은 인형이 튕기지 않게 접촉 강성 30→12Hz(2.3→0.8m/s 미만); 들어 올리기는 멈춤 없이 꼭대기까지 smoothstep; 쥔 모습은 화면·중계에서만 다듬음(`game/holdLook.ts`: 손가락을 쥔 공 표면 안쪽까지, 인형은 우리 안으로 최대 12cm 끌어올림, 쥐는 순간 출렁); 집게 힘 4.8(1000판 10/10). 라이브 play·run PASS. 잡히는 장면은 자동 플레이로 못 찍어 사용자 확인 대상.
- 6단계 다듬기 4차 배포(2026-11-01, Version 30c37ba7): 이어 하는 둘째 판부터 그만하기가 내내 보이고 누르면 바로 일어남(서버 stand가 판 도중에도 자리를 풂, 환불 없음; 집게가 도는 중이면 결과까지 보고 묻기); 놓친 뒤 손가락을 오므리고 올라감; 쥔 손가락은 공 안쪽 30%(TIP_IN 0.7). 라이브 run·play PASS.
