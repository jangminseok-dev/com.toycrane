import random

from toycrane.app.dtos.act_dto import ActCommand
from toycrane.app.ports.input.act_use_case import ActUseCase
from toycrane.app.ports.output.bag_port import BagPort
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.app.ports.output.ring_boards_port import RingBoardsPort
from toycrane.app.use_cases.report_lock import take_report
from toycrane.app.use_cases.rings import ensure_rings
from toycrane.domain.layout import RINGS
from toycrane.domain.ring import hook, restock, valid_hook


class ActInteractor(ActUseCase):
    """고리·미는 뽑기 한 판(설계 2026-11-02 §3·§4): 판 잠금은 인형·피규어와 같고(take_report — 두 번째는 무시), 결과는 서버가 정한다.
    이상한 좌표는 done_no, 기계 상태는 그대로. 경품은 가방에, 모두에게 result와 기계 상태."""

    def __init__(
        self, registry: PlayerRegistryPort, locks: PlayLockPort, rings: RingBoardsPort, bag: BagPort, connections: ConnectionsPort,
        rng: random.Random | None = None,
    ) -> None:
        self._registry = registry
        self._locks = locks
        self._rings = rings
        self._bag = bag
        self._connections = connections
        self._rng = rng or random.Random()

    async def act(self, cmd: ActCommand) -> None:
        taken = take_report(cmd, self._registry, self._locks, self._connections)
        if taken is None:
            return
        me, machine_id = taken
        if machine_id in RINGS:
            await self._ring(cmd, me, machine_id)

    async def _ring(self, cmd: ActCommand, me, machine_id: str) -> None:
        if not valid_hook(cmd.x, cmd.y):
            self._connections.send_done_no(cmd.conn_id, machine_id, "bad")
            return
        boards = await ensure_rings(self._rings, self._rng)
        board = boards[machine_id]
        r = hook(board, cmd.x, cmd.y, self._rng)
        prize: list[tuple[str, int, str, int]] = []
        if r.caught and r.peg is not None:
            card = board[r.peg]
            total = await self._bag.add(me.guest_id, card.kind, card.color, card.rare, "ring", cmd.now)
            self._connections.send_bag(cmd.conn_id, total)
            prize = [(card.kind, card.color, card.rare, 0)]
            board = restock(board, r.peg, self._rng)
            boards[machine_id] = board
            await self._rings.save(boards)
        self._connections.broadcast_result(machine_id, me.player_id, prize)
        self._connections.broadcast_ring(machine_id, board, cmd.x, cmd.y, r.peg, r.caught)
