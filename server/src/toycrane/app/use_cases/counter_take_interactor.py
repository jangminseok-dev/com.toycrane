import math

from toycrane.app.dtos.counter_take_dto import CounterTakeCommand
from toycrane.app.ports.input.counter_take_use_case import CounterTakeUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.app.ports.output.wallet_port import WalletPort
from toycrane.domain.coins import TAKE_LIMIT, WINDOW_REACH, take_amount
from toycrane.domain.layout import COUNTERS


class CounterTakeInteractor(CounterTakeUseCase):
    """교환소 코인 받기 (설계 2026-10-31 교환소 개편 §4.1): 줄 없이 창구 1.5m 안에서 누르면 바로 5개 — 15개까지만."""

    def __init__(self, registry: PlayerRegistryPort, wallet: WalletPort, connections: ConnectionsPort) -> None:
        self._registry = registry
        self._wallet = wallet
        self._connections = connections

    async def take(self, cmd: CounterTakeCommand) -> None:
        me = dict(self._registry.entries()).get(cmd.conn_id)
        if me is None:
            return
        window = COUNTERS[cmd.counter].window
        if math.hypot(me.position.x - window.x, me.position.z - window.z) > WINDOW_REACH:
            self._connections.send_take_no(cmd.conn_id, cmd.counter, "far")
            return
        before = await self._wallet.balance(me.guest_id)
        amount = take_amount(before)
        if amount == 0:
            self._connections.send_take_no(cmd.conn_id, cmd.counter, "enough")
            return
        total = await self._wallet.add(me.guest_id, amount, TAKE_LIMIT, cmd.now)
        self._connections.send_coins(cmd.conn_id, total, total - before)
