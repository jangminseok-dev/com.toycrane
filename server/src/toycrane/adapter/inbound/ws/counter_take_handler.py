"""take 메시지(counter_take 슬라이스의 인바운드 어댑터): 교환소 코인 받기."""

import time

from toycrane.adapter.inbound.ws.schemas.counter_take_schema import parse
from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.counter_take_dto import CounterTakeCommand
from toycrane.dependencies.counter_take_provider import get_counter_take_use_case


async def handle(ctx, env, ws, data: dict) -> None:
    conn_id = ws_attachment.read(ws).get("conn")
    counter = parse(data)
    if conn_id and counter is not None:
        await get_counter_take_use_case(ctx, env).take(CounterTakeCommand(conn_id, counter, time.time()))
