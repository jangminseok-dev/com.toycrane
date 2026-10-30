from fakes import FakeConnections, FakeQueues
from toycrane.adapter.inbound.ws.schemas.server_messages import queue as queue_msg
from toycrane.adapter.inbound.ws.schemas.server_messages import queue_no
from toycrane.app.dtos.queue_dto import QueueJoinCommand
from toycrane.app.use_cases.queue_join_interactor import QueueJoinInteractor


async def test_join_lines_up_in_order_and_marks_the_head():
    q, conns = FakeQueues(), FakeConnections()
    await QueueJoinInteractor(q, conns).join(QueueJoinCommand("c-1", 0, now=1.0))
    await QueueJoinInteractor(q, conns).join(QueueJoinCommand("c-2", 0, now=2.0))
    assert conns.broadcasts[-1] == (None, queue_msg(0, ["p1", "p2"]))
    assert q.head_since("c-1") == 1.0 and q.head_since("c-2") is None


async def test_seventh_person_is_told_the_line_is_full():
    q, conns = FakeQueues(), FakeConnections()
    for i in range(1, 7):
        await QueueJoinInteractor(q, conns).join(QueueJoinCommand(f"c-{i}", 0, now=float(i)))
    await QueueJoinInteractor(q, conns).join(QueueJoinCommand("c-7", 0, now=7.0))
    assert conns.direct == [("c-7", queue_no(0, "full"))] and q.counter_of("c-7") is None


async def test_joining_twice_or_a_wrong_counter_is_ignored():
    q, conns = FakeQueues(), FakeConnections()
    await QueueJoinInteractor(q, conns).join(QueueJoinCommand("c-1", 0, now=1.0))
    await QueueJoinInteractor(q, conns).join(QueueJoinCommand("c-1", 1, now=2.0))
    await QueueJoinInteractor(q, conns).join(QueueJoinCommand("c-2", 5, now=2.0))
    assert q.counter_of("c-1") == 0 and q.counter_of("c-2") is None and len(conns.broadcasts) == 1


async def test_stale_head_is_skipped_after_8s():
    q, conns = FakeQueues(), FakeConnections()
    await QueueJoinInteractor(q, conns).join(QueueJoinCommand("c-1", 0, now=1.0))
    await QueueJoinInteractor(q, conns).join(QueueJoinCommand("c-2", 0, now=2.0))
    await QueueJoinInteractor(q, conns).join(QueueJoinCommand("c-3", 0, now=9.5))
    assert conns.broadcasts[-1] == (None, queue_msg(0, ["p2", "p3"]))
    assert q.head_since("c-2") == 9.5
