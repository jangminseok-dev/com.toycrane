"""act 메시지(고리·미는 뽑기 한 판, 설계 2026-11-02 §8)의 인바운드 어댑터. 읽을 수 없으면 버린다 — 잠근 사람은 판 시간이 지나면 풀린다."""

import time

from toycrane.adapter.inbound.ws.schemas.act_schema import parse
from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.act_dto import ActCommand
from toycrane.dependencies.act_provider import get_act_use_case


async def handle(ctx, env, ws, data: dict) -> None:
    conn_id = ws_attachment.read(ws).get("conn")
    parsed = parse(data)
    if conn_id and parsed:
        await get_act_use_case(ctx, env).act(ActCommand(conn_id, parsed[0], parsed[1], parsed[2], time.time()))
