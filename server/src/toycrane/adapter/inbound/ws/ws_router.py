"""매장 웹소켓 메시지를 종류(t)별 핸들러로 넘긴다. 모르는 종류는 무시한다. (move는 Task 6에서 추가)"""

HANDLERS: dict = {}


async def dispatch(ctx, env, ws, raw) -> None:
    return None
