import random

from toycrane.app.dtos.done_dto import DoneCommand
from toycrane.app.ports.input.done_use_case import DoneUseCase
from toycrane.app.ports.output.bag_port import BagPort
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.machine_contents_port import MachineContentsPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.app.use_cases.machine_contents import ensure_contents
from toycrane.app.use_cases.report_lock import take_report
from toycrane.domain.report import check_report, won_dolls, won_views
from toycrane.domain.stock import due

ZONE = "big"


class DoneInteractor(DoneUseCase):
    """판 보고 (물리 뽑기 설계 §4.5): 서버는 판정하지 않는다. 잠근 사람의 보고를 상식만 확인해 저장하고, 구멍에 빠진 인형은 모두 가방에,
    모두에게 결과와 새 배치를 알린다. 거절(치명 규칙)이면 done_no를 보내고 기계는 판 시작 전 그대로. 어느 쪽이든 판 사이 자리는 남는다."""

    def __init__(
        self, registry: PlayerRegistryPort, locks: PlayLockPort, contents: MachineContentsPort, bag: BagPort, connections: ConnectionsPort,
    ) -> None:
        self._registry = registry
        self._locks = locks
        self._contents = contents
        self._bag = bag
        self._connections = connections
        self._rng = random.Random()  # 저장된 기계가 없을 때만(배포 직후) 새로 채우는 데 쓴다

    def _take(self, cmd: DoneCommand):
        return take_report(cmd, self._registry, self._locks, self._connections)

    async def refuse(self, cmd: DoneCommand) -> None:
        if self._take(cmd) is not None:
            self._connections.send_done_no(cmd.conn_id, cmd.machine_id, "bad")

    async def done(self, cmd: DoneCommand) -> None:
        taken = self._take(cmd)
        if taken is None:
            return
        me, machine_id = taken
        stocks = await ensure_contents(self._contents, self._rng)
        before = stocks[machine_id]
        after = check_report(before, cmd.report, cmd.now)
        if isinstance(after, str):
            self._connections.send_done_no(cmd.conn_id, machine_id, after)
            return
        stocks[machine_id] = after
        await self._contents.save(stocks)
        when = due(stocks)
        self._connections.broadcast_stock(None if when is None else max(0.0, when - cmd.now))
        total = None
        for doll in won_dolls(before, cmd.report.won):
            total = await self._bag.add(me.guest_id, doll.kind, doll.color, doll.rare, ZONE, cmd.now)
        if total is not None:
            self._connections.send_bag(cmd.conn_id, total)
        self._connections.broadcast_result(machine_id, me.player_id, won_views(before, cmd.report.won))
        self._connections.broadcast_machine(machine_id, after.dolls)
