"""unqueue 메시지(queue_leave 슬라이스의 인바운드 어댑터)."""

import time

from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.queue_dto import QueueLeaveCommand
from toycrane.dependencies.queue_leave_provider import get_queue_leave_use_case


async def handle(ctx, env, ws, data: dict) -> None:
    conn_id = ws_attachment.read(ws).get("conn")
    if conn_id:
        await get_queue_leave_use_case(ctx, env).leave(QueueLeaveCommand(conn_id, time.time()))
