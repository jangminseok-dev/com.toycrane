from dataclasses import dataclass


class UnknownGuest(LookupError):
    pass


@dataclass(frozen=True)
class AdmissionQuery:
    guest_id: str


@dataclass(frozen=True)
class AdmissionResult:
    store_no: int | None  # None = 만석
