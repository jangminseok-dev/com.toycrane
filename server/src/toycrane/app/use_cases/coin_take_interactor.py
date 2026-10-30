import math

from toycrane.app.dtos.take_dto import TakeCommand
from toycrane.app.ports.input.coin_take_use_case import CoinTakeUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.app.ports.output.queue_registry_port import QueueRegistryPort
from toycrane.app.ports.output.wallet_port import WalletPort
from toycrane.app.use_cases.queue_settle import settle_queue
from toycrane.domain.coin_queue import can_take
from toycrane.domain.coins import COINS_PER_TAKE, WALLET_CAP, WINDOW_REACH
from toycrane.domain.layout import COUNTERS


class CoinTakeInteractor(CoinTakeUseCase):
    """창구에서 코인 받기: 줄 맨 앞 + 2초 지남 + 창구 앞에 서 있음 → 5개(지갑 15개까지), 줄에서 빠짐."""

    def __init__(self, queues: QueueRegistryPort, connections: ConnectionsPort, registry: PlayerRegistryPort, wallet: WalletPort) -> None:
        self._queues = queues
        self._connections = connections
        self._registry = registry
        self._wallet = wallet

    async def take(self, cmd: TakeCommand) -> None:
        counter = self._queues.counter_of(cmd.conn_id)
        me = dict(self._registry.entries()).get(cmd.conn_id)
        if counter is None or me is None:
            return
        members = self._queues.members(counter)
        if not members or members[0].conn_id != cmd.conn_id or not can_take(members[0].head_since, cmd.now):
            return
        window = COUNTERS[counter].window
        if math.hypot(me.position.x - window.x, me.position.z - window.z) > WINDOW_REACH:
            return
        before = await self._wallet.balance(me.guest_id)
        total = await self._wallet.add(me.guest_id, COINS_PER_TAKE, WALLET_CAP, cmd.now)
        self._connections.send_coins(cmd.conn_id, total, total - before)
        self._queues.remove(cmd.conn_id)
        settle_queue(self._queues, self._connections, counter, cmd.now)
