"""cbeg 메시지(counter_beg 슬라이스의 인바운드 어댑터): 교환소 조르기."""

import time

from toycrane.adapter.inbound.ws.schemas.counter_beg_schema import parse
from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.counter_beg_dto import CounterBegCommand
from toycrane.dependencies.counter_beg_provider import get_counter_beg_use_case


async def handle(ctx, env, ws, data: dict) -> None:
    conn_id = ws_attachment.read(ws).get("conn")
    counter = parse(data)
    if conn_id and counter is not None:
        await get_counter_beg_use_case(ctx, env).beg(CounterBegCommand(conn_id, counter, time.time()))
