import random

from toycrane.app.dtos.drop_dto import DropCommand, ResultView
from toycrane.app.ports.input.drop_use_case import DropUseCase
from toycrane.app.ports.output.bag_port import BagPort
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.machine_contents_port import MachineContentsPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.app.use_cases.machine_contents import ensure_contents
from toycrane.domain.crane import clamp_claw, drop_nearby, judge, sway, take_out
from toycrane.domain.play_rules import expired

ZONE = "big"  # 2단계는 큰인형 구역만


class DropInteractor(DropUseCase):
    """내리기: 서버가 판정해 모두에게 결과를 알린다. 성공이면 인형을 가방에 넣고 기계를 다시 채운다. 기계는 판 사이 자리로 그 사람에게 남는다."""

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
        if lock is None or me is None or self._locks.is_between(cmd.conn_id):
            return
        machine_id, started = lock
        if expired(started, cmd.now):
            self._locks.release(cmd.conn_id)
            self._connections.broadcast_free(machine_id)
            return
        self._locks.hold(cmd.conn_id, machine_id, cmd.now)  # 판 사이로 바꿔 두 번째 내리기는 무시되고, 이어서 할 자리는 남는다
        x, z = clamp_claw(*sway(cmd.x, cmd.z, self._rng))  # 흔들린 자리로 판정하고 모두에게 그 자리를 알린다
        contents = await ensure_contents(self._contents, self._rng)
        spots = contents[machine_id]
        grab = judge(spots, x, z, self._rng.random())
        kind = spots[grab.index].kind if grab.index is not None else None
        if grab.outcome == "win":
            contents[machine_id] = take_out(spots, grab.index)  # 뽑힌 자리는 비워 둔다 — 아무도 안 할 때 채운다
            await self._contents.save(contents)
            self._connections.send_bag(cmd.conn_id, await self._bag.add(me.guest_id, kind, ZONE, cmd.now))
        elif grab.outcome == "slip":
            contents[machine_id] = drop_nearby(spots, grab.index, self._rng)  # 떨어져 굴러간 자리
            await self._contents.save(contents)
        self._connections.broadcast_result(ResultView(machine_id, me.player_id, x, z, grab.outcome, grab.part, kind, grab.index))
        if grab.outcome in ("win", "slip"):
            self._connections.broadcast_machine(machine_id, contents[machine_id])
