"""매장 인원 기록은 배정이 참고하는 값일 뿐이라, 쓰기에 실패해도(D1 한도·장애) 들어오기·나가기는 그대로 진행한다."""

import logging

from toycrane.app.ports.output.occupancy_port import OccupancyPort

logger = logging.getLogger(__name__)


async def note_occupancy(occupancy: OccupancyPort, store_no: int, count: int, now: float) -> None:
    try:
        await occupancy.write(store_no, count, now)
    except Exception:
        logger.warning("매장 %s 인원(%s) 기록 실패", store_no, count, exc_info=True)
