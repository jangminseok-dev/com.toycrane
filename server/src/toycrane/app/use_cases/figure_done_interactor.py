import random

from toycrane.app.dtos.done_dto import DoneCommand
from toycrane.app.ports.input.done_use_case import DoneUseCase
from toycrane.app.ports.output.bag_port import BagPort
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.figure_boxes_port import FigureBoxesPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.app.use_cases.figure_boxes import ensure_figures
from toycrane.app.use_cases.report_lock import take_report
from toycrane.domain.figure import after_play, check_report, roll_prize
from toycrane.domain.layout import FIGURES

ZONE = "figure"


class FigureDoneInteractor(DoneUseCase):
    """피규어 판 보고(9단계 설계 §4): 서버는 판정하지 않는다. 잠근 사람이 보고한 상자 자리(uid 0 한 줄)를 상식만 확인해 저장하고,
    막대 사이로 빠졌으면 그 순간 경품(캐릭터·희귀·황금)을 정해 가방에 — 그 전에는 경품이 어디에도 없다.
    여러 판 거의 안 움직인 상자는 살짝 옮긴다. 거절이면 done_no, 상자는 판 시작 전 그대로."""

    def __init__(
        self, registry: PlayerRegistryPort, locks: PlayLockPort, figures: FigureBoxesPort, bag: BagPort, connections: ConnectionsPort,
        rng: random.Random | None = None,
    ) -> None:
        self._registry = registry
        self._locks = locks
        self._figures = figures
        self._bag = bag
        self._connections = connections
        self._rng = rng or random.Random()

    async def refuse(self, cmd: DoneCommand) -> None:
        if take_report(cmd, self._registry, self._locks, self._connections) is not None:
            self._connections.send_done_no(cmd.conn_id, cmd.machine_id, "bad")

    async def done(self, cmd: DoneCommand) -> None:
        taken = take_report(cmd, self._registry, self._locks, self._connections)
        if taken is None:
            return
        me, machine_id = taken
        rows, won_ids = cmd.report.dolls, set(cmd.report.won)
        if len(rows) != 1 or rows[0].uid != 0 or not won_ids <= {0}:
            self._connections.send_done_no(cmd.conn_id, machine_id, "count")
            return
        r = rows[0]
        kind = FIGURES[machine_id].box
        checked = check_report((r.x, r.y, r.z, *r.q), 0 in won_ids, kind)
        if isinstance(checked, str):
            self._connections.send_done_no(cmd.conn_id, machine_id, checked)
            return
        box, won = checked
        states = await ensure_figures(self._figures, self._rng)
        state, nudged = after_play(states[machine_id], box, won, self._rng, kind)
        states[machine_id] = state
        await self._figures.save(states)
        prize: list[tuple[str, int, str, int]] = []
        if won:
            kind, rare = roll_prize(self._rng)
            total = await self._bag.add(me.guest_id, kind, 0, rare, ZONE, cmd.now)
            self._connections.send_bag(cmd.conn_id, total)
            prize = [(kind, 0, rare, 0)]
        self._connections.broadcast_result(machine_id, me.player_id, prize)
        self._connections.broadcast_figure(machine_id, state.box, nudged)
