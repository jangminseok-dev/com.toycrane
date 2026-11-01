import random

from toycrane.app.ports.output.pusher_shelves_port import PusherShelvesPort
from toycrane.domain.layout import PUSHERS
from toycrane.domain.pusher import Item, new_shelf


async def ensure_pushers(port: PusherShelvesPort, rng: random.Random) -> dict[str, tuple[Item, ...]]:
    """저장된 선반을 읽고, 선반이 없는 미는 뽑기 기계에는 새 선반을 놓아 저장한다."""
    shelves = await port.load()
    missing = [m for m in PUSHERS if m not in shelves]
    for m in missing:
        shelves[m] = new_shelf(rng)
    if missing:
        await port.save(shelves)
    return shelves
