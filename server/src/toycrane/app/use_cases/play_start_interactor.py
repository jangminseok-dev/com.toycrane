import math

from toycrane.app.dtos.play_dto import PlayStartCommand
from toycrane.app.ports.input.play_start_use_case import PlayStartUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.app.ports.output.wallet_port import WalletPort
from toycrane.domain.layout import MACHINE_SPEC, MACHINES, front_spot
from toycrane.domain.play_rules import PLAY_SECONDS, expired


class PlayStartInteractor(PlayStartUseCase):
    """코인 넣고 시작: 기계 한 대 = 한 사람. 시간이 지난 잠금은 풀고, 코인을 쓰기 전에 먼저 잠근다."""

    def __init__(self, registry: PlayerRegistryPort, locks: PlayLockPort, wallet: WalletPort, connections: ConnectionsPort) -> None:
        self._registry = registry
        self._locks = locks
        self._wallet = wallet
        self._connections = connections

    async def start(self, cmd: PlayStartCommand) -> None:
        machine = MACHINES.get(cmd.machine_id)
        me = dict(self._registry.entries()).get(cmd.conn_id)
        if machine is None or me is None:
            return
        if self._locks.lock_of(cmd.conn_id) is not None:
            self._connections.send_play_no(cmd.conn_id, machine.id, "playing")
            return
        holder = self._locks.holder(machine.id)
        if holder is not None:
            if not expired(holder[1], cmd.now):
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
            return  # 기다리는 사이 창이 닫혀 이미 풀고 환불했다 — 여기서 play를 보내면 기계가 영원히 '하는 중'으로 남는다
        if left is None:
            self._locks.release(cmd.conn_id)
            self._connections.send_play_no(cmd.conn_id, machine.id, "coins")
            return
        self._connections.send_play_ok(cmd.conn_id, machine.id, left, PLAY_SECONDS)
        self._connections.broadcast_play(cmd.conn_id, machine.id, me.player_id)
