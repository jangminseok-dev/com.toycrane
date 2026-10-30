"""queue 메시지(queue_join 슬라이스의 인바운드 어댑터)."""

import time

from toycrane.adapter.inbound.ws.schemas.queue_schema import parse_join
from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.queue_dto import QueueJoinCommand
from toycrane.dependencies.queue_join_provider import get_queue_join_use_case


async def handle(ctx, env, ws, data: dict) -> None:
    conn_id = ws_attachment.read(ws).get("conn")
    counter = parse_join(data)
    if conn_id and counter is not None:
        await get_queue_join_use_case(ctx, env).join(QueueJoinCommand(conn_id, counter, time.time()))
