from toycrane.adapter.inbound.http.schemas.admission_schema import parse_admit, to_json
from toycrane.app.dtos.admission_dto import AdmissionQuery, AdmissionResult


def test_parse_admit_reads_guest_id():
    assert parse_admit({"guestId": "g-1"}) == AdmissionQuery("g-1")
    assert parse_admit({}) is None
    assert parse_admit({"guestId": 1}) is None


def test_to_json_store_or_full():
    assert to_json(AdmissionResult(store_no=2)) == {"store": 2}
    assert to_json(AdmissionResult(store_no=None)) == {"full": True}
