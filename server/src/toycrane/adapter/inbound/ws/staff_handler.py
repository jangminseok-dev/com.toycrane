"""staff 메시지(staff 슬라이스의 인바운드 어댑터): 판 사이에 "직원 부르기"."""

import time

from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.staff_dto import StaffCommand
from toycrane.dependencies.staff_provider import get_staff_use_case


async def handle(ctx, env, ws, data: dict) -> None:
    conn_id = ws_attachment.read(ws).get("conn")
    if conn_id and isinstance(data.get("m"), str):
        await get_staff_use_case(ctx, env).call(StaffCommand(conn_id, data["m"], time.time()))
