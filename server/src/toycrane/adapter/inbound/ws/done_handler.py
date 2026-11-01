"""done 메시지(done 슬라이스의 인바운드 어댑터)."""

import time

from toycrane.adapter.inbound.ws.schemas.done_schema import parse
from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.done_dto import DoneCommand
from toycrane.dependencies.done_provider import get_done_use_case
from toycrane.dependencies.figure_done_provider import get_figure_done_use_case
from toycrane.domain.layout import FIGURES, machine_spot
from toycrane.domain.report import Report


def _use_case(ctx, env, machine_id: str):
    """피규어 기계(9단계)는 상자 한 개 보고, 인형 기계는 인형 무더기 보고."""
    return get_figure_done_use_case(ctx, env) if machine_id in FIGURES else get_done_use_case(ctx, env)


async def handle(ctx, env, ws, data: dict) -> None:
    conn_id = ws_attachment.read(ws).get("conn")
    parsed = parse(data)
    if conn_id and parsed:
        await _use_case(ctx, env, parsed[0]).done(DoneCommand(conn_id, parsed[0], parsed[1], time.time()))
    elif conn_id and isinstance(data.get("m"), str) and machine_spot(data["m"]) is not None:  # 읽을 수 없는 보고 — 잠근 사람이면 done_no (최종 리뷰 I2)
        await _use_case(ctx, env, data["m"]).refuse(DoneCommand(conn_id, data["m"], Report((), ()), time.time()))
