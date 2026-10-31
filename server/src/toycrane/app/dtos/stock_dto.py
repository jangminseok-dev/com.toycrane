from dataclasses import dataclass


@dataclass(frozen=True)
class StockCommand:
    now: float
    newcomer: str | None = None  # 막 들어온 접속 — 채울 게 없어도 다음 채울 시각을 알려 준다
