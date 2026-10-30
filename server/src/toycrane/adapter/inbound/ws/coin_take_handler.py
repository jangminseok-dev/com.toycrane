"""take 메시지(coin_take 슬라이스의 인바운드 어댑터)."""

import time

from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.take_dto import TakeCommand
from toycrane.dependencies.coin_take_provider import get_coin_take_use_case


async def handle(ctx, env, ws, data: dict) -> None:
    conn_id = ws_attachment.read(ws).get("conn")
    if conn_id:
        await get_coin_take_use_case(ctx, env).take(TakeCommand(conn_id, time.time()))
