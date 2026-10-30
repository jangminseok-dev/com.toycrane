from toycrane.app.ports.output.manager_record_port import ManagerRecordPort


class LogManagerRecordAdapter(ManagerRecordPort):
    """임시 로그 구현 — Workers 로그(wrangler tail)에 남긴다."""

    async def record(self, subject: str, note: str) -> None:
        print(f"[manager] {subject}: {note}")
