"""코인 교환소 규칙 (설계 §3.3, 수치는 2단계 계획의 [내 판단])."""

COINS_PER_TAKE = 5     # 교환소에서 한 번에 받는 코인
WALLET_CAP = 15        # 지갑 최대 (넘는 만큼은 버림)
TAKE_SECONDS = 2.0     # 창구 처리 시간
TAKE_SLACK = 0.3       # 화면·서버 시각 차이 여유
HEAD_TIMEOUT = 8.0     # 맨 앞이 이만큼 안 받으면 다음 사람 차례
WINDOW_REACH = 1.0     # 창구에서 이만큼 안에 서 있어야 받는다
QUEUE_SLOTS = 6        # 교환소마다 줄 자리
