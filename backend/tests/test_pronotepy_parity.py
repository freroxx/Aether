"""Parité pronotepy — tests unitaires offline (aucun appel réseau).

Couvre les helpers purs de backend/api/index.py :
  - grade_parse (parité Util.grade_parse)
  - _classify_pronote_error (13 exceptions pronotepy -> HTTP)
  - _cache_key (stabilité, jamais de secret dedans)
  - clamp_window / parse_ymd (validation)
  - _serialize_attachment (préservation de l'id)

Aucun test ne touche le réseau : pronotepy est stubé via sys.modules
si indisponible, et seuls les helpers purs sont exercés (jamais
init_client / client.lessons / sess.get).
"""
import sys
import types
from datetime import date
from pathlib import Path

# --- sys.path : permet `pytest backend/tests/...` depuis la racine comme depuis backend/ ---
_BACKEND = Path(__file__).resolve().parents[1]
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

# --- Mock pronotepy si indisponible (offline) : aucun appel réseau ---
try:
    import pronotepy  # noqa: F401  (réel si installé, jamais appelé ici)
except ImportError:  # pragma: no cover - environnement sans pronotepy
    _stub = types.ModuleType("pronotepy")
    _stub.__version__ = "0.0.0-stub"

    class _Ent:
        ile_de_france = "ile_de_france"

    _stub.ent = _Ent()
    for _name in (
        "ChildNotFound",
        "CryptoError",
        "DataError",
        "DateParsingError",
        "DiscussionClosed",
        "ENTLoginError",
        "ExpiredObject",
        "ICalExportError",
        "MFAError",
        "ParsingError",
        "PronoteAPIError",
        "QRCodeDecryptError",
        "UnsupportedOperation",
    ):
        setattr(_stub, _name, type(_name, (Exception,), {}))
    sys.modules["pronotepy"] = _stub

from fastapi import HTTPException

from api.index import (
    GRADE_TRANSLATE,
    _cache_key,
    _classify_pronote_error,
    _serialize_attachment,
    clamp_window,
    grade_parse,
    parse_ymd,
)


def _exc(name: str, msg: str = "neutral failure xyz") -> Exception:
    """Construit une Exception dont type().__name__ == name (sans importer pronotepy)."""
    return type(name, (Exception,), {})(msg)


# ---------------- grade_parse ----------------

def test_grade_translate_has_8_entries():
    assert GRADE_TRANSLATE == [
        "Absent",
        "Dispense",
        "NonNote",
        "Inapte",
        "NonRendu",
        "AbsentZero",
        "NonRenduZero",
        "Felicitations",
    ]


def test_grade_parse_pipe_codes_1_to_8():
    expected = {
        "|1": "Absent",
        "|2": "Dispense",
        "|3": "NonNote",
        "|4": "Inapte",
        "|5": "NonRendu",
        "|6": "AbsentZero",
        "|7": "NonRenduZero",
        "|8": "Felicitations",
    }
    for raw, code in expected.items():
        val, status, raw_out = grade_parse(raw)
        assert val is None, raw
        assert status == code, raw
        assert raw_out == raw, raw


def test_grade_parse_comma_decimal():
    val, status, raw = grade_parse("14,5")
    assert val == 14.5
    assert status is None
    assert raw == "14,5"


def test_grade_parse_dot_decimal_and_int():
    assert grade_parse("12.5")[0] == 12.5
    assert grade_parse("15")[0] == 15.0
    assert grade_parse(" 16 ")[0] == 16.0


def test_grade_parse_empty_and_none():
    assert grade_parse("") == (None, None, "")
    assert grade_parse(None) == (None, None, "")
    assert grade_parse("   ")[0] is None


def test_grade_parse_unknown_pipe_falls_back_non_note():
    # |0 / |9 hors table -> "NonNote", jamais d'exception
    for raw in ("|0", "|9", "|x"):
        val, status, _ = grade_parse(raw)
        assert val is None
        assert status == "NonNote"


# ---------------- _classify_pronote_error : les 13 exceptions ----------------

# Mapping attendu (message neutre, sans heuristique de contenu) :
# cf. _classify_pronote_error dans api/index.py
EXPECTED_STATUS = {
    "QRCodeDecryptError": 401,
    "MFAError": 428,
    "ChildNotFound": 404,
    "ExpiredObject": 409,
    "DiscussionClosed": 403,
    "UnsupportedOperation": 501,
    "ENTLoginError": 502,
    "ParsingError": 502,
    "DateParsingError": 502,
    "ICalExportError": 502,
    "CryptoError": 401,
    # DataError / PronoteAPIError : pas de branche dédiée -> fallback 401 générique
    "DataError": 401,
    "PronoteAPIError": 401,
}

ALL_13 = [
    "ChildNotFound",
    "CryptoError",
    "DataError",
    "DateParsingError",
    "DiscussionClosed",
    "ENTLoginError",
    "ExpiredObject",
    "ICalExportError",
    "MFAError",
    "ParsingError",
    "PronoteAPIError",
    "QRCodeDecryptError",
    "UnsupportedOperation",
]


def test_all_13_pronotepy_exceptions_covered():
    assert sorted(ALL_13) == sorted(EXPECTED_STATUS.keys())
    assert len(ALL_13) == 13


def test_classify_each_exception_name():
    for name, expected_code in EXPECTED_STATUS.items():
        he = _classify_pronote_error(_exc(name))
        assert isinstance(he, HTTPException), name
        assert he.status_code == expected_code, f"{name}: got {he.status_code}"


def test_classify_unknown_exception_falls_back_401():
    he = _classify_pronote_error(_exc("SomeRandomError"))
    assert he.status_code == 401


def test_classify_message_heuristics_rate_limit_and_unreachable():
    assert _classify_pronote_error(_exc("PronoteAPIError", "429 too many requests")).status_code == 429
    assert _classify_pronote_error(_exc("PronoteAPIError", "connection timed out")).status_code == 504


# ---------------- _cache_key ----------------

def test_cache_key_stable():
    auth = {"url": "https://x.pronote.fr", "username": "eleve1", "uuid": "u1", "account_type": "eleve"}
    assert _cache_key("grades", auth, "Trim1", None) == _cache_key("grades", auth, "Trim1", None)


def test_cache_key_differs_per_user_and_prefix():
    a = {"url": "https://x.pronote.fr", "username": "eleve1", "uuid": "u1", "account_type": "eleve"}
    b = {"url": "https://x.pronote.fr", "username": "eleve2", "uuid": "u1", "account_type": "eleve"}
    assert _cache_key("grades", a) != _cache_key("grades", b)
    assert _cache_key("grades", a) != _cache_key("homework", a)


def test_cache_key_contains_no_secret():
    secret_token = "tok_SECRET_abc123"
    secret_pwd = "pwd_SECRET_xyz789"
    auth = {
        "url": "https://x.pronote.fr",
        "username": "eleve1",
        "uuid": "u1",
        "account_type": "eleve",
        "token": secret_token,
        "password": secret_pwd,
    }
    key = _cache_key("grades", auth, "Trim1")
    assert secret_token not in key
    assert secret_pwd not in key
    assert key.startswith("aether:")


def test_cache_key_ignores_token_rotation():
    base = {"url": "https://x.pronote.fr", "username": "e", "uuid": "u", "account_type": "eleve"}
    a = {**base, "token": "old-token"}
    b = {**base, "token": "new-token-after-rotation"}
    assert _cache_key("grades", a) == _cache_key("grades", b)


# ---------------- parse_ymd / clamp_window ----------------

def test_parse_ymd_valid():
    assert parse_ymd("2026-09-12", "from_date") == date(2026, 9, 12)


def test_parse_ymd_invalid_raises_422():
    for bad in ("12/09/2026", "not-a-date", "", "2026-13-01"):
        try:
            parse_ymd(bad, "from_date")
        except HTTPException as he:
            assert he.status_code == 422
        else:
            raise AssertionError(f"parse_ymd({bad!r}) should raise 422")


def test_clamp_window_ok_and_boundaries():
    s, e = clamp_window(date(2026, 9, 1), date(2026, 9, 12))
    assert (s, e) == (date(2026, 9, 1), date(2026, 9, 12))
    # exactement max_days (62) OK
    s, e = clamp_window(date(2026, 1, 1), date(2026, 3, 4))  # 62 jours
    assert (e - s).days == 62


def test_clamp_window_end_before_start_raises_422():
    try:
        clamp_window(date(2026, 9, 12), date(2026, 9, 1))
    except HTTPException as he:
        assert he.status_code == 422
    else:
        raise AssertionError("end < start should raise 422")


def test_clamp_window_too_wide_raises_422():
    try:
        clamp_window(date(2026, 1, 1), date(2026, 5, 1))  # ~120j > 62
    except HTTPException as he:
        assert he.status_code == 422
    else:
        raise AssertionError("window > 62d should raise 422")


# ---------------- _serialize_attachment ----------------

class _FakeAttachment:
    def __init__(self, id="att-123", name="devoir.pdf", url="https://x/f.pdf", type=1):
        self.id = id
        self.name = name
        self.url = url
        self.type = type


def test_serialize_attachment_preserves_id():
    out = _serialize_attachment(_FakeAttachment(id="att-123"))
    assert out["id"] == "att-123"
    assert out["name"] == "devoir.pdf"
    assert out["url"] == "https://x/f.pdf"
    assert out["type"] == 1


def test_serialize_attachment_defaults():
    class _Bare:
        pass

    out = _serialize_attachment(_Bare())
    assert out["id"] is None
    assert out["name"] == "Fichier"
    assert out["url"] is None
    assert out["type"] == 1
