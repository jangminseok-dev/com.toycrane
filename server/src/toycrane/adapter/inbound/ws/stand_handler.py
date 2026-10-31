"""stand 메시지(stand 슬라이스의 인바운드 어댑터): 판 사이에 "그만하기"."""

import time

from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.play_dto import StandCommand
from toycrane.dependencies.stand_provider import get_stand_use_case


async def handle(ctx, env, ws, data: dict) -> None:
    conn_id = ws_attachment.read(ws).get("conn")
    if conn_id:
        await get_stand_use_case(ctx, env).stand(StandCommand(conn_id, time.time()))
