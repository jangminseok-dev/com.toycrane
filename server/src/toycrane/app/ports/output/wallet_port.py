from abc import ABC, abstractmethod


class WalletPort(ABC):
    """게스트별 코인 (D1)."""

    @abstractmethod
    async def balance(self, guest_id: str) -> int:
        """없으면 0."""

    @abstractmethod
    async def add(self, guest_id: str, n: int, cap: int, now: float) -> int:
        """n개 더하되 cap을 넘는 만큼은 버린다. 새 잔액."""

    @abstractmethod
    async def beg(self, guest_id: str, n: int, cap: int, cooldown: float, now: float) -> int | None:
        """교환소 조르기: 마지막으로 받은 지 cooldown초가 지났고 cap 미만이면 n개 더하고(cap까지) 받은 시각을 now로.
        새 잔액, 아니면 None. 조건과 변경을 한 번에 한다(같은 게스트의 탭 둘이 동시에 눌러도 한 번만)."""

    @abstractmethod
    async def begged_at(self, guest_id: str) -> float | None:
        """교환소 조르기를 마지막으로 받은 시각 (없으면 None)."""

    @abstractmethod
    async def spend_one(self, guest_id: str, now: float) -> int | None:
        """하나 쓴다. 0개면 None, 아니면 새 잔액."""
