from fakes import FakeConnections, FakeLocks, FakeRegistry, player
from toycrane.adapter.inbound.ws.schemas.server_messages import pose
from toycrane.app.dtos.pose_dto import PoseCommand
from toycrane.app.use_cases.pose_interactor import PoseInteractor

C = (0.1, 1.6, 0.2, 0.4)
D = ((7, 0.2, 1.3, 0.1, 0.0, 0.0, 0.0, 1.0),)
F = ((0.1, C, D), (0.0, (0.1, 1.5, 0.2, 0.4), ()))  # 0.4초 묶음: [나이, 집게, 인형들]
WIRE = [[0.1, list(C), [list(D[0])]], [0.0, [0.1, 1.5, 0.2, 0.4], []]]


def setup():
    reg, conns, locks = FakeRegistry(), FakeConnections(), FakeLocks({"c-1": "p1", "c-2": "p2"})
    reg.put("c-1", player("p1", guest="g-1"))
    reg.put("c-2", player("p2", guest="g-2"))
    locks.lock("c-1", "A-1", 10.0)
    return reg, conns, locks, PoseInteractor(reg, locks, conns)


# 물리 뽑기 설계 §4.5: 판을 하는 사람의 집게·움직이는 인형 자리를 그대로 다른 사람들에게
async def test_pose_is_relayed_to_everyone_else():
    reg, conns, locks, it = setup()
    await it.relay(PoseCommand("c-1", "A-1", F, now=12.0))
    assert conns.broadcasts == [("c-1", pose("p1", "A-1", WIRE))]


# Review Focus 2: 잠근 사람이 아니거나(구경꾼), 다른 기계이거나, 판 사이면 버린다
async def test_pose_from_someone_else_is_dropped():
    reg, conns, locks, it = setup()
    await it.relay(PoseCommand("c-2", "A-1", F, now=12.0))
    await it.relay(PoseCommand("c-1", "A-2", F, now=12.0))
    locks.hold("c-1", "A-1", 12.0)
    await it.relay(PoseCommand("c-1", "A-1", F, now=12.0))
    assert conns.broadcasts == []


# 9단계 피규어 뽑기: 집게와 상자(uid 0) 자리를 인형 기계처럼 중계한다
async def test_pose_relays_for_figure_machine():
    reg, conns, locks, it = setup()
    locks.release("c-1")
    locks.lock("c-1", "F-1", 10.0)
    box = ((0, 0.01, 1.03, 0.02, 0.0, 0.0, 0.0, 1.0),)
    await it.relay(PoseCommand("c-1", "F-1", ((0.0, C, box),), now=12.0))
    assert conns.broadcasts == [("c-1", pose("p1", "F-1", [[0.0, list(C), [list(box[0])]]]))]
