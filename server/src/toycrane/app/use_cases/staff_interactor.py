import random

from toycrane.app.dtos.staff_dto import StaffCommand
from toycrane.app.ports.input.staff_use_case import StaffUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.figure_boxes_port import FigureBoxesPort
from toycrane.app.ports.output.machine_contents_port import MachineContentsPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.app.ports.output.staff_board_port import StaffBoardPort
from toycrane.app.use_cases.figure_boxes import ensure_figures
from toycrane.app.use_cases.machine_contents import ensure_contents
from toycrane.domain.figure import FIGURE_RULES, FigureState
from toycrane.domain.hook import HOOK_RULES
from toycrane.domain.layout import MACHINES, PUSHERS
from toycrane.domain.play_rules import hold_over
from toycrane.domain.pusher_crane import redrop_mixed
from toycrane.domain.reposition import redrop_all
from toycrane.domain.staff import back_at, calls_left, plan_call, prune, zone_of


class StaffInteractor(StaffUseCase):
    """직원 부르기(상주 직원 설계 2026-11-24): 판 사이 자리를 잡은 손님만. 그 구역 직원의 일정을 정하고(줄·5판에 한 번), 기계 안을 전부 다시 놓아
    그 자리에서 저장한 뒤 일정과 결과를 모두에게 한 번에 보낸다 — 서버는 그 뒤 깨어날 필요가 없고, 화면들이 put 시각에 결과를 그린다.
    부른 손님의 판 사이 자리는 put 뒤 판 사이 자리 시간까지 잡아 두고, 그 사이 기계 시작과 새 인형 채우기는 staff.pending이 막는다."""

    def __init__(
        self, registry: PlayerRegistryPort, locks: PlayLockPort, contents: MachineContentsPort, figures: FigureBoxesPort, hooks: FigureBoxesPort,
        board: StaffBoardPort, connections: ConnectionsPort, rng: random.Random | None = None,
    ) -> None:
        self._registry = registry
        self._locks = locks
        self._contents = contents
        self._figures = figures
        self._hooks = hooks
        self._board = board
        self._connections = connections
        self._rng = rng or random.Random()

    async def call(self, cmd: StaffCommand) -> None:
        zone, me = zone_of(cmd.machine_id), dict(self._registry.entries()).get(cmd.conn_id)
        if zone is None or me is None:
            return
        seat = self._locks.lock_of(cmd.conn_id)
        if seat is None or seat[0] != cmd.machine_id or not self._locks.is_between(cmd.conn_id) or hold_over(seat[1], cmd.now):
            self._connections.send_staff_no(cmd.conn_id, cmd.machine_id, "seat", 0)
            return
        board = prune(await self._board.load(), cmd.now)
        planned = plan_call(board, cmd.machine_id, me.guest_id, cmd.now)
        if isinstance(planned, str):
            self._connections.send_staff_no(cmd.conn_id, cmd.machine_id, planned, calls_left(board, cmd.machine_id, me.guest_id))
            return
        board, job = planned
        dolls, box = await self._redrop(cmd.machine_id)
        await self._board.save(board)
        self._locks.hold(cmd.conn_id, cmd.machine_id, job.put)
        jobs = board.jobs[zone]
        self._connections.broadcast_staff_plan(zone, jobs, back_at(jobs, zone) or job.end, cmd.now, cmd.machine_id, dolls, box)

    async def _redrop(self, machine_id: str):
        """기계 안을 전부 다시 놓아 저장하고 (인형들, 상자) 중 하나를 돌려준다."""
        if machine_id in MACHINES or machine_id in PUSHERS:
            stocks = await ensure_contents(self._contents, self._rng)
            stocks[machine_id] = (redrop_mixed if machine_id in PUSHERS else redrop_all)(stocks[machine_id], self._rng)
            await self._contents.save(stocks)
            return stocks[machine_id].dolls, None
        port, rules = (self._figures, FIGURE_RULES) if machine_id in FIGURE_RULES.machines else (self._hooks, HOOK_RULES)
        states = await ensure_figures(port, self._rng, rules)
        states[machine_id] = FigureState(rules.start_box(self._rng, machine_id), 0)
        await port.save(states)
        return None, states[machine_id].box
