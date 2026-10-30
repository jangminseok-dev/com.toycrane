"""매장 웹소켓 메시지를 종류(t)별 핸들러로 넘긴다. JSON 객체가 아니거나 모르는 종류는 무시한다(접속은 유지)."""

import json

from toycrane.adapter.inbound.ws import (
    coin_take_handler, drop_handler, move_handler, play_start_handler, queue_join_handler, queue_leave_handler,
)

HANDLERS = {
    "move": move_handler.handle,
    "queue": queue_join_handler.handle,
    "unqueue": queue_leave_handler.handle,
    "take": coin_take_handler.handle,
    "play": play_start_handler.handle,
    "drop": drop_handler.handle,
}


def decode(raw) -> dict | None:
    if not isinstance(raw, str):
        return None
    try:
        data = json.loads(raw)
    except ValueError:
        return None
    return data if isinstance(data, dict) and isinstance(data.get("t"), str) else None


async def dispatch(ctx, env, ws, raw) -> None:
    data = decode(raw)
    handler = HANDLERS.get(data["t"]) if data else None
    if handler is not None:
        await handler(ctx, env, ws, data)
