import random

from toycrane.app.ports.output.ring_boards_port import RingBoardsPort
from toycrane.domain.layout import RINGS
from toycrane.domain.ring import Card, new_board


async def ensure_rings(port: RingBoardsPort, rng: random.Random) -> dict[str, tuple[Card, ...]]:
    """저장된 카드를 읽고, 카드가 없는 고리 기계에는 새 판을 걸어 저장한다."""
    boards = await port.load()
    missing = [m for m in RINGS if m not in boards]
    for m in missing:
        boards[m] = new_board(rng)
    if missing:
        await port.save(boards)
    return boards
