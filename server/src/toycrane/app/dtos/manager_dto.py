from dataclasses import dataclass


@dataclass(frozen=True)
class ManagerQuery:
    name: str


@dataclass(frozen=True)
class ManagerResponse:
    name: str
    introduction: str
    endpoints: tuple[str, ...]
