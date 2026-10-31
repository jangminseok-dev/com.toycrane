from dataclasses import dataclass

from toycrane.domain.report import Report


@dataclass(frozen=True)
class DoneCommand:
    conn_id: str
    machine_id: str
    report: Report
    now: float
