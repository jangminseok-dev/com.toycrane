from dataclasses import dataclass

from toycrane.domain.entities.player import Player


@dataclass(frozen=True)
class PlayerView:
    """다른 사람에게 보이는 플레이어 모습 (필드 이름은 화면 메시지와 같다)."""

    id: str
    nick: str
    color: int
    x: float
    z: float
    dx: float
    dz: float
    beg: int | None = None  # 조르는 중이면 더 받을 수 있는 코인 수

    @staticmethod
    def of(player: Player) -> "PlayerView":
        return PlayerView(
            player.player_id, player.nickname, player.color,
            player.position.x, player.position.z, player.heading.dx, player.heading.dz, player.beg_room,
        )
