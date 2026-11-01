"""미는 뽑기 선반 저장(DO pushers_v1): 기계마다 인형 자리 — 다시 읽어도 같다."""

import random

from fakes import FakeStorage
from toycrane.adapter.outbound.do_storage_pushers import KEY, DoStoragePusherShelves
from toycrane.app.use_cases.pushers import ensure_pushers
from toycrane.domain.layout import PUSHERS


async def test_every_pusher_gets_a_shelf_that_reloads_the_same():
    storage = FakeStorage()
    port = DoStoragePusherShelves(storage)
    shelves = await ensure_pushers(port, random.Random(1))
    assert KEY == "pushers_v1" and set(shelves) == set(PUSHERS)
    assert await port.load() == shelves
    assert await ensure_pushers(port, random.Random(2)) == shelves
