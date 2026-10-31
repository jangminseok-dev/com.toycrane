"""tick 메시지(stock 슬라이스의 인바운드 어댑터): 아무도 움직이지 않아도 제때 채우게, 다음 채울 시각이 지나면 화면이 보낸다.
채우기는 라우터가 모든 메시지 앞에서 이미 돌렸으므로 여기서는 할 일이 없다."""


async def handle(ctx, env, ws, data: dict) -> None:
    return None
