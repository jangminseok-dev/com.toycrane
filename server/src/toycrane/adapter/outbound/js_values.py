"""JS 값(JsProxy)을 파이썬 값으로 — 런타임 모듈 없이 쓸 수 있어 테스트에서도 import된다."""


def to_py(value):
    return value.to_py() if hasattr(value, "to_py") else value
