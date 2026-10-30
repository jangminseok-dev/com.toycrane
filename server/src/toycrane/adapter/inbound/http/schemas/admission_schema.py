from toycrane.app.dtos.admission_dto import AdmissionQuery, AdmissionResult


def parse_admit(body: dict) -> AdmissionQuery | None:
    guest_id = body.get("guestId")
    return AdmissionQuery(guest_id) if isinstance(guest_id, str) else None


def to_json(result: AdmissionResult) -> dict:
    return {"full": True} if result.store_no is None else {"store": result.store_no}
