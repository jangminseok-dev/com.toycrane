import json

from toycrane.adapter.outbound.attachment_play_locks import AttachmentPlayLocks
from toycrane.adapter.outbound.attachment_queue_registry import AttachmentQueueRegistry


class FakeWs:
    """웹소켓 attachment만 흉내 낸다(JSON 문자열을 붙였다 떼기)."""

    def __init__(self, data: dict) -> None:
        self._raw = json.dumps(data)

    def serializeAttachment(self, raw: str) -> None:
        self._raw = raw

    def deserializeAttachment(self) -> str:
        return self._raw


class FakeCtx:
    def __init__(self, *sockets: FakeWs) -> None:
        self._sockets = list(sockets)

    def getWebSockets(self) -> list:
        return self._sockets


def conn(conn_id: str, player_id: str) -> FakeWs:
    return FakeWs({"conn": conn_id, "store": 1, "player": {"id": player_id}})


def test_queue_members_come_in_join_order():
    ctx = FakeCtx(conn("c-1", "p1"), conn("c-2", "p2"))
    q = AttachmentQueueRegistry(ctx)
    q.join("c-2", 0, 5.0)
    q.join("c-1", 0, 6.0)
    assert [m.player_id for m in q.members(0)] == ["p2", "p1"]
    q.mark_head("c-2", 7.0)
    assert q.members(0)[0].head_since == 7.0 and q.counter_of("c-1") == 0
    q.remove("c-2")
    assert [m.conn_id for m in q.members(0)] == ["c-1"] and q.counter_of("c-2") is None


def test_play_lock_round_trip():
    locks = AttachmentPlayLocks(FakeCtx(conn("c-1", "p1")))
    locks.lock("c-1", "A-3", 10.0)
    assert locks.holder("A-3") == ("c-1", 10.0) and locks.lock_of("c-1") == ("A-3", 10.0)
    assert locks.plays() == {"A-3": "p1"}
    locks.release("c-1")
    assert locks.holder("A-3") is None and locks.plays() == {}
