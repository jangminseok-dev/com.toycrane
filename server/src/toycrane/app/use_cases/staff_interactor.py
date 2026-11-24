import random

from toycrane.app.dtos.staff_dto import StaffCommand
from toycrane.app.ports.input.staff_use_case import StaffUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.machine_contents_port import MachineContentsPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort
from toycrane.app.use_cases.machine_contents import ensure_contents
from toycrane.domain.layout import MACHINES
from toycrane.domain.reposition import move_unreachable


class StaffInteractor(StaffUseCase):
    """직원 부르기(인형 기계 재배치 설계 2026-11-24 나): 인형 기계에서 판 사이 자리를 잡은 사람만. 유리 쪽 못 닿는 인형을 바로 닿는 빈자리로
    옮겨(안 앉은 채) 모두에게 새 배치를 알리고, 부른 사람에게 옮긴 수(0이면 옮길 게 없음)를 보낸다. 인형이 떨어지는 걸 보는 사이
    자리를 뺏기지 않게 판 사이 자리 시간을 새로 잡는다. 못 닿는 인형만 옮기므로 몇 번 불러도 쉬워지지 않는다(횟수 제한 없음)."""

    def __init__(self, locks: PlayLockPort, contents: MachineContentsPort, connections: ConnectionsPort) -> None:
        self._locks = locks
        self._contents = contents
        self._connections = connections
        self._rng = random.Random()

    async def call(self, cmd: StaffCommand) -> None:
        seat = self._locks.lock_of(cmd.conn_id)
        if cmd.machine_id not in MACHINES or seat is None or seat[0] != cmd.machine_id or not self._locks.is_between(cmd.conn_id):
            return
        stocks = await ensure_contents(self._contents, self._rng)
        after, moved = move_unreachable(stocks[cmd.machine_id], self._rng)
        if moved:
            stocks[cmd.machine_id] = after
            await self._contents.save(stocks)
            self._connections.broadcast_machine(cmd.machine_id, after.dolls)
        self._locks.hold(cmd.conn_id, cmd.machine_id, cmd.now)
        self._connections.send_staffed(cmd.conn_id, cmd.machine_id, len(moved))
