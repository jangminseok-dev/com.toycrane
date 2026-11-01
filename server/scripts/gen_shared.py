"""shared/*.json → src/toycrane/domain/shared_data.py

파이썬 Worker는 실행 중에 저장소 밖 JSON을 읽지 못하므로, 공용 데이터를 파이썬 모듈로 만들어 함께 배포한다.
shared/*.json을 고친 뒤 `uv run python scripts/gen_shared.py`로 다시 만든다(tests/domain/test_shared_data.py가 일치를 확인).
"""

import json
import pprint
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "server" / "src" / "toycrane" / "domain" / "shared_data.py"


def main() -> None:
    catalog = json.loads((ROOT / "shared" / "catalog.json").read_text(encoding="utf-8"))
    layout = json.loads((ROOT / "shared" / "store_layout.json").read_text(encoding="utf-8"))
    claw = json.loads((ROOT / "shared" / "claw.json").read_text(encoding="utf-8"))
    figure = json.loads((ROOT / "shared" / "figure.json").read_text(encoding="utf-8"))
    hook = json.loads((ROOT / "shared" / "hook.json").read_text(encoding="utf-8"))
    fmt = lambda v: pprint.pformat(v, width=120, sort_dicts=False)  # noqa: E731
    OUT.write_text(
        '"""생성 파일 — shared/catalog.json·shared/store_layout.json·shared/claw.json·shared/figure.json·shared/hook.json을 고치고 scripts/gen_shared.py로 다시 생성한다."""\n\n'
        f"CATALOG = {fmt(catalog)}\n\nLAYOUT = {fmt(layout)}\n\nCLAW = {fmt(claw)}\n\nFIGURE = {fmt(figure)}\n\nHOOK = {fmt(hook)}\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
