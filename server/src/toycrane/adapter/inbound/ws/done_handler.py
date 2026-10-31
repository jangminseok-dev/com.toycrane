"""done 메시지(done 슬라이스의 인바운드 어댑터)."""

import time

from toycrane.adapter.inbound.ws.schemas.done_schema import parse
from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.done_dto import DoneCommand
from toycrane.dependencies.done_provider import get_done_use_case
from toycrane.domain.layout import MACHINES
from toycrane.domain.report import Report


async def handle(ctx, env, ws, data: dict) -> None:
    conn_id = ws_attachment.read(ws).get("conn")
    parsed = parse(data)
    if conn_id and parsed:
        await get_done_use_case(ctx, env).done(DoneCommand(conn_id, parsed[0], parsed[1], time.time()))
    elif conn_id and isinstance(data.get("m"), str) and data["m"] in MACHINES:  # 읽을 수 없는 보고 — 잠근 사람이면 done_no (최종 리뷰 I2)
        await get_done_use_case(ctx, env).refuse(DoneCommand(conn_id, data["m"], Report((), ()), time.time()))
