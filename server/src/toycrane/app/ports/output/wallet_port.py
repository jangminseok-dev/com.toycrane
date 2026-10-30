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
    async def spend_one(self, guest_id: str, now: float) -> int | None:
        """하나 쓴다. 0개면 None, 아니면 새 잔액."""
