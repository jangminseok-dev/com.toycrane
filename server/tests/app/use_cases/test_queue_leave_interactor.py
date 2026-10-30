from fakes import FakeConnections, FakeQueues
from toycrane.adapter.inbound.ws.schemas.server_messages import queue as queue_msg
from toycrane.app.dtos.queue_dto import QueueLeaveCommand
from toycrane.app.use_cases.queue_leave_interactor import QueueLeaveInteractor


async def test_unqueue_moves_the_next_person_up():
    q, conns = FakeQueues(), FakeConnections()
    q.join("c-1", 0, 1.0); q.mark_head("c-1", 1.0); q.join("c-2", 0, 2.0)
    await QueueLeaveInteractor(q, conns).leave(QueueLeaveCommand("c-1", now=3.0))
    assert conns.broadcasts == [(None, queue_msg(0, ["p2"]))] and q.head_since("c-2") == 3.0


async def test_unqueue_when_not_in_line_is_ignored():
    conns = FakeConnections()
    await QueueLeaveInteractor(FakeQueues(), conns).leave(QueueLeaveCommand("c-1", now=3.0))
    assert conns.broadcasts == []
