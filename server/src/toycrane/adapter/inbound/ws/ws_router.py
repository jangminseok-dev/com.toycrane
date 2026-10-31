"""매장 웹소켓 메시지를 종류(t)별 핸들러로 넘긴다. JSON 객체가 아니거나 모르는 종류는 무시한다(접속은 유지).
그 전에 인형 채우기를 돌린다 — 서버는 혼자 깨어나지 않으므로 메시지가 올 때 때가 된 기계를 채운다(대개 메모리의 시각만 본다)."""

import json
import time

from toycrane.adapter.inbound.ws import (
    beg_handler, counter_beg_handler, counter_take_handler, done_handler, give_handler, move_handler, play_start_handler, pose_handler, stand_handler,
    tick_handler,
)
from toycrane.app.dtos.stock_dto import StockCommand
from toycrane.dependencies.stock_provider import get_stock_use_case

HANDLERS = {
    "move": move_handler.handle,
    "take": counter_take_handler.handle,
    "cbeg": counter_beg_handler.handle,
    "beg": beg_handler.handle,
    "give": give_handler.handle,
    "play": play_start_handler.handle,
    "done": done_handler.handle,
    "pose": pose_handler.handle,
    "stand": stand_handler.handle,
    "tick": tick_handler.handle,
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
        if data["t"] != "pose":  # 중계는 초당 10번 — 채우기 확인을 거치지 않는다
            await get_stock_use_case(ctx, env).refill(StockCommand(time.time()))
        await handler(ctx, env, ws, data)
