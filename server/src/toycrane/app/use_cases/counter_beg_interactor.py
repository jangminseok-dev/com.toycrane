import math
import random

from toycrane.app.dtos.counter_beg_dto import CounterBegCommand
from toycrane.app.ports.input.counter_beg_use_case import CounterBegUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.app.ports.output.wallet_port import WalletPort
from toycrane.domain.coins import BEG_COOLDOWN, WALLET_CAP, WINDOW_REACH, beg_award, beg_wait
from toycrane.domain.layout import COUNTERS


class CounterBegInteractor(CounterBegUseCase):
    """교환소 조르기 (설계 2026-10-31 교환소 개편 §3.2·§4.2): 10~50개를 게스트마다 10분에 한 번.
    받으면·쿨타임으로 거절되면 모두에게 알린다(조르기 모션 뒤 기쁨·시무룩). 지갑이 가득 차면 쿨타임을 쓰지 않는다."""

    def __init__(self, registry: PlayerRegistryPort, wallet: WalletPort, connections: ConnectionsPort, rng: random.Random) -> None:
        self._registry = registry
        self._wallet = wallet
        self._connections = connections
        self._rng = rng

    async def beg(self, cmd: CounterBegCommand) -> None:
        me = dict(self._registry.entries()).get(cmd.conn_id)
        if me is None:
            return
        window = COUNTERS[cmd.counter].window
        if math.hypot(me.position.x - window.x, me.position.z - window.z) > WINDOW_REACH:
            self._connections.send_counter_beg_no(cmd.conn_id, cmd.counter, "far", 0.0)
            return
        before = await self._wallet.balance(me.guest_id)
        if before >= WALLET_CAP:
            self._connections.send_counter_beg_no(cmd.conn_id, cmd.counter, "full", 0.0)
            return
        total = await self._wallet.beg(me.guest_id, beg_award(self._rng), WALLET_CAP, BEG_COOLDOWN, cmd.now)
        if total is None:
            wait = beg_wait(await self._wallet.begged_at(me.guest_id), cmd.now)
            self._connections.broadcast_counter_beg(me.player_id, cmd.counter, 0)
            self._connections.send_counter_beg_no(cmd.conn_id, cmd.counter, "wait", wait)
            return
        self._connections.broadcast_counter_beg(me.player_id, cmd.counter, total - before)
        self._connections.send_coins(cmd.conn_id, total, total - before)
