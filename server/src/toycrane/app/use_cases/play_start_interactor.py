import math

from toycrane.app.dtos.play_dto import PlayStartCommand
from toycrane.app.ports.input.play_start_use_case import PlayStartUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.app.ports.output.wallet_port import WalletPort
from toycrane.domain.coins import WALLET_CAP
from toycrane.domain.layout import MACHINE_SPEC, front_spot, machine_spot
from toycrane.domain.play_rules import PLAY_SECONDS, expired, hold_over


class PlayStartInteractor(PlayStartUseCase):
    """코인 넣고 시작: 기계 한 대 = 한 사람. 판 사이 자리를 잡은 사람은 이어서 하고, 시간이 지난 잠금은 풀고, 코인을 쓰기 전에 먼저 잠근다."""

    def __init__(self, registry: PlayerRegistryPort, locks: PlayLockPort, wallet: WalletPort, connections: ConnectionsPort) -> None:
        self._registry = registry
        self._locks = locks
        self._wallet = wallet
        self._connections = connections

    async def start(self, cmd: PlayStartCommand) -> None:
        machine = machine_spot(cmd.machine_id)  # 인형 기계·피규어 기계 같은 잠금 규칙
        me = dict(self._registry.entries()).get(cmd.conn_id)
        if machine is None or me is None:
            return
        mine = self._locks.lock_of(cmd.conn_id)
        if mine is not None:
            if not self._locks.is_between(cmd.conn_id) and expired(mine[1], cmd.now, mine[0]):  # 보고를 못 보낸 내 판은 시간이 지나면 풀고 새로 (최종 리뷰 I2)
                self._locks.release(cmd.conn_id)
                self._connections.broadcast_free(mine[0])
            elif not self._locks.is_between(cmd.conn_id):
                self._connections.send_play_no(cmd.conn_id, machine.id, "playing")
                return
            elif mine[0] != machine.id:  # 잡아 둔 자리를 두고 다른 기계로 옮겼다
                self._locks.release(cmd.conn_id)
                self._connections.broadcast_free(mine[0])
        holder = self._locks.holder(machine.id)
        if holder is not None and holder[0] != cmd.conn_id:
            between = self._locks.is_between(holder[0])
            if not (hold_over(holder[1], cmd.now) if between else expired(holder[1], cmd.now, machine.id)):
                self._connections.send_play_no(cmd.conn_id, machine.id, "busy")
                return
            self._locks.release(holder[0])
            self._connections.broadcast_free(machine.id)
        front = front_spot(machine)
        if math.hypot(me.position.x - front.x, me.position.z - front.z) > MACHINE_SPEC.reach:
            self._connections.send_play_no(cmd.conn_id, machine.id, "far")
            return
        # D1을 기다리는 사이 끼어든 요청이 busy를 받게 코인보다 잠금이 먼저
        self._locks.lock(cmd.conn_id, machine.id, cmd.now)
        left = await self._wallet.spend_one(me.guest_id, cmd.now)
        if self._locks.lock_of(cmd.conn_id) != (machine.id, cmd.now):
            # 기다리는 사이 창이 닫혀 이미 풀렸다 — 여기서 play를 보내면 기계가 영원히 '하는 중'으로 남는다. 판은 시작도 안 했으니 코인만 되돌린다
            if left is not None:
                await self._wallet.add(me.guest_id, 1, WALLET_CAP, cmd.now)
            return
        if left is None:
            self._locks.release(cmd.conn_id)
            self._connections.send_play_no(cmd.conn_id, machine.id, "coins")
            return
        self._connections.send_play_ok(cmd.conn_id, machine.id, left, PLAY_SECONDS)
        self._connections.broadcast_play(cmd.conn_id, machine.id, me.player_id)
