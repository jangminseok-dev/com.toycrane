"""고리 뽑기 카드 저장(DO rings_v1): 기계마다 걸이 카드 — 다시 읽어도 같다."""

import json
import random

from fakes import FakeStorage
from toycrane.adapter.outbound.do_storage_rings import KEY, DoStorageRingBoards
from toycrane.app.use_cases.rings import ensure_rings
from toycrane.domain.layout import RINGS


async def test_every_ring_machine_gets_a_board_that_reloads_the_same():
    storage = FakeStorage()
    port = DoStorageRingBoards(storage)
    boards = await ensure_rings(port, random.Random(1))
    assert KEY == "rings_v1" and set(boards) == set(RINGS)
    raw = json.loads(storage.data[KEY])
    assert all(len(v) == 12 and all(len(c) == 3 for c in v) for v in raw.values())
    assert await port.load() == boards
    again = await ensure_rings(port, random.Random(2))
    assert again == boards  # 있는 카드는 그대로
