import random

from toycrane.app.dtos.drop_dto import DropCommand, ResultView
from toycrane.app.ports.input.drop_use_case import DropUseCase
from toycrane.app.ports.output.bag_port import BagPort
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.machine_contents_port import MachineContentsPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.app.use_cases.machine_contents import ensure_contents
from toycrane.domain.crane import clamp_claw, judge, restock, sway
from toycrane.domain.layout import MACHINES
from toycrane.domain.play_rules import expired

ZONE = "big"  # 2단계는 큰인형 구역만


class DropInteractor(DropUseCase):
    """내리기: 서버가 판정해 모두에게 결과를 알린다. 성공이면 인형을 가방에 넣고 기계를 다시 채운다."""

    def __init__(
        self, registry: PlayerRegistryPort, locks: PlayLockPort, contents: MachineContentsPort, bag: BagPort,
        connections: ConnectionsPort, rng: random.Random,
    ) -> None:
        self._registry = registry
        self._locks = locks
        self._contents = contents
        self._bag = bag
        self._connections = connections
        self._rng = rng

    async def drop(self, cmd: DropCommand) -> None:
        lock = self._locks.lock_of(cmd.conn_id)
        me = dict(self._registry.entries()).get(cmd.conn_id)
        if lock is None or me is None:
            return
        machine_id, started = lock
        self._locks.release(cmd.conn_id)  # 먼저 풀어 두 번째 내리기는 무시되게
        if expired(started, cmd.now):
            self._connections.broadcast_free(machine_id)
            return
        x, z = clamp_claw(*sway(cmd.x, cmd.z, self._rng))  # 흔들린 자리로 판정하고 모두에게 그 자리를 알린다
        contents = await ensure_contents(self._contents, self._rng)
        spots = contents[machine_id]
        grab = judge(spots, x, z, self._rng.random())
        kind = spots[grab.index].kind if grab.index is not None else None
        if grab.outcome == "win":
            contents[machine_id] = restock(spots, grab.index, MACHINES[machine_id].set, self._rng)
            await self._contents.save(contents)
            self._connections.send_bag(cmd.conn_id, await self._bag.add(me.guest_id, kind, ZONE, cmd.now))
        self._connections.broadcast_result(ResultView(machine_id, me.player_id, x, z, grab.outcome, grab.part, kind))
        if grab.outcome == "win":
            self._connections.broadcast_machine(machine_id, contents[machine_id])
