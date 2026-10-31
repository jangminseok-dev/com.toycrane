import random

from toycrane.app.dtos.stock_dto import StockCommand
from toycrane.app.ports.input.stock_use_case import StockUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.machine_contents_port import MachineContentsPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort
from toycrane.domain.catalog import GOLD
from toycrane.domain.layout import MACHINES
from toycrane.domain.play_rules import expired, hold_over
from toycrane.domain.stock import due, refill


def lock_active(locks: PlayLockPort, machine_id: str, now: float) -> bool:
    """그 기계를 지금 누가 잡고 있나 — 잠금은 다음 메시지가 와야 풀리므로 시간이 지난 잠금은 비어 있는 것으로 본다
    (아니면 판 사이 자리에 앉은 채 떠난 기계가 영영 안 채워진다)."""
    holder = locks.holder(machine_id)
    if holder is None:
        return False
    conn_id, since = holder
    return not (hold_over(since, now) if locks.is_between(conn_id) else expired(since, now))


class StockInteractor(StockUseCase):
    """인형 채우기 (설계 2026-10-31 인형 채우기 §4.1): 서버는 혼자 깨어나지 않으므로 매장이 받는 메시지마다 부른다.
    가장 이른 채울 시각만 보고, 때가 됐을 때만 기계들을 읽어 채운 뒤 한 번 저장하고 모두에게 알린다."""

    def __init__(self, contents: MachineContentsPort, locks: PlayLockPort, connections: ConnectionsPort, rng: random.Random) -> None:
        self._contents = contents
        self._locks = locks
        self._connections = connections
        self._rng = rng

    async def refill(self, cmd: StockCommand) -> None:
        when = await self._contents.due_at()
        if when is None or when > cmd.now:
            if cmd.newcomer:
                self._connections.send_stock(cmd.newcomer, _due_in(when, cmd.now))
            return
        stocks = await self._contents.load()
        gold = sum(d.rare == GOLD for s in stocks.values() for d in s.dolls)
        spawns, changed = [], []
        for machine_id, stock in stocks.items():
            after, added = refill(stock, MACHINES[machine_id].kind, cmd.now, lock_active(self._locks, machine_id, cmd.now), gold, self._rng)
            if after == stock:
                continue
            stocks[machine_id] = after
            gold += sum(d.rare == GOLD for d in added)
            spawns += [(machine_id, d) for d in added if d.rare]
            if added:
                changed.append(machine_id)
        await self._contents.save(stocks)
        for machine_id in changed:
            self._connections.broadcast_machine(machine_id, stocks[machine_id].dolls)
        for machine_id, doll in spawns:
            self._connections.broadcast_spawn(machine_id, doll.kind, doll.rare)
        self._connections.broadcast_stock(_due_in(due(stocks), cmd.now))


def _due_in(when: float | None, now: float) -> float | None:
    return None if when is None else max(0.0, when - now)
