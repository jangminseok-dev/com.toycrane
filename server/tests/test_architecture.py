import ast
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src"
RUNTIME = {"js", "workers", "pyodide"}


def imports_under(*roots: Path, names: set[str]) -> list[str]:
    """roots 아래 .py 파일에서 names로 시작하는 import를 '파일: 모듈' 목록으로 모은다."""
    found = []
    for root in roots:
        for path in sorted(root.rglob("*.py")):
            for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
                if isinstance(node, ast.Import):
                    mods = [a.name for a in node.names]
                elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                    mods = [node.module]
                else:
                    continue
                found += [f"{path.relative_to(SRC)}: {m}" for m in mods if m.split(".")[0] in names]
    return found


def test_app_and_domain_never_import_runtime_modules():
    offenders = imports_under(SRC / "toycrane" / "app", SRC / "toycrane" / "domain", names=RUNTIME)
    assert offenders == []
