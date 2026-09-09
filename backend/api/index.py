import os
import json
import base64
import mimetypes
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta

from fastapi import FastAPI, HTTPException, Header, Depends, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import hashlib
import logging

logger = logging.getLogger("aether")

# NOTE: `pronotepy` (lourd, wheel Rust via cryptography) est importé en lazy
# dans init_client / endpoints d'auth pour réduire le cold start Vercel.
# Optional Upstash Redis import
try:
    from upstash_redis import Redis
    UPSTASH_URL = os.environ.get("UPSTASH_REDIS_REST_URL")
    UPSTASH_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN")
    redis_client = Redis(url=UPSTASH_URL, token=UPSTASH_TOKEN) if UPSTASH_URL and UPSTASH_TOKEN else None
except Exception:
    redis_client = None


def _cache_key(prefix: str, auth: Dict[str, Any], *parts: Any) -> str:
    """Clé de cache stable (jamais de token/mot de passe dedans)."""
    raw = "|".join([
        prefix,
        str(auth.get("url", "")),
        str(auth.get("username", "")),
        str(auth.get("uuid", "")),
        str(auth.get("account_type", "eleve")),
        *[str(p) for p in parts],
    ])
    return "aether:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()


def cache_get(key: str) -> Optional[Any]:
    if redis_client is None:
        return None
    try:
        val = redis_client.get(key)
        if val is None:
            return None
        return json.loads(val) if isinstance(val, str) else val
    except Exception as e:
        logger.warning(f"redis get failed: {e}")
        return None


def cache_set(key: str, value: Any, ttl_s: int) -> None:
    if redis_client is None:
        return
    try:
        redis_client.set(key, json.dumps(value, default=str), ex=ttl_s)
    except Exception as e:
        logger.warning(f"redis set failed: {e}")


def parse_ymd(value: str, label: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=422, detail=f"Date invalide pour {label} (attendu YYYY-MM-DD)")


def clamp_window(start_d: date, end_d: date, max_days: int = 62) -> tuple:
    if end_d < start_d:
        raise HTTPException(status_code=422, detail="to_date antérieur à from_date")
    if (end_d - start_d).days > max_days:
        raise HTTPException(status_code=422, detail=f"Fenêtre trop large (max {max_days} jours)")
    return start_d, end_d

app = FastAPI(
    title="Aether Pronotepy API",
    version="1.0.0",
    description="Microservice serverless reliant Aether Mobile à Pronote via pronotepy avec support des comptes parents."
)

cors_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
# allow_credentials=True est incompatible avec "*" (rejet navigateur) :
# credentials seulement si origines explicites.
_use_credentials = cors_origins != ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if _use_credentials else ["*"],
    allow_credentials=_use_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Models -----------------

class DirectLoginRequest(BaseModel):
    url: str
    username: str
    password: str
    ent: Optional[str] = None
    account_type: str = "eleve" # "eleve" or "parent"

class QrCodeLoginRequest(BaseModel):
    qr_data: Any # JSON dict or string
    pin: str
    uuid: str
    account_type: str = "eleve"

class TokenLoginRequest(BaseModel):
    url: str
    username: str
    token: str
    uuid: str
    account_type: str = "eleve"

class HomeworkDoneRequest(BaseModel):
    homework_id: str
    done: bool
    child_name: Optional[str] = None
    due_date: Optional[str] = None  # indice YYYY-MM-DD pour recherche ±7j d'abord

class SendMessageRequest(BaseModel):
    chat_id: str
    content: str
    child_name: Optional[str] = None

class CreateChatRequest(BaseModel):
    subject: str
    content: str
    recipient_ids: List[str]
    child_name: Optional[str] = None

class NewsReadRequest(BaseModel):
    news_id: str
    child_name: Optional[str] = None

class SetChildRequest(BaseModel):
    child_name: str

class FileDownloadRequest(BaseModel):
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    child_name: Optional[str] = None
    due_date: Optional[str] = None  # indice YYYY-MM-DD : scan ±7j d'abord

# ----------------- Helper Functions -----------------

def get_session_header(x_pronote_auth: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not x_pronote_auth:
        raise HTTPException(status_code=401, detail="Header X-Pronote-Auth requis")
    try:
        decoded = base64.b64decode(x_pronote_auth).decode("utf-8")
        auth_data = json.loads(decoded)
        return auth_data
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Header X-Pronote-Auth invalide: {str(e)}")

def _classify_pronote_error(e: Exception) -> HTTPException:
    """401 auth réelle / 429 throttling / 504 timeout — jamais de 401 générique."""
    msg = str(e)
    low = msg.lower()
    if any(k in low for k in ("429", "too many", "trop de requ", "rate limit", "rate-limit", "ratelimit")):
        return HTTPException(status_code=429, detail=f"Pronote surchargé, réessayez dans un instant: {msg}")
    if any(k in low for k in ("timeout", "timed out", "délai", "connectionerror", "connection error", "max retries", "temporarily", "temporaire", "503", "502", "504", "bad gateway", "service unavailable")):
        return HTTPException(status_code=504, detail=f"Établissement injoignable pour le moment: {msg}")
    return HTTPException(status_code=401, detail=f"Erreur d'initialisation Pronote: {msg}")


def init_client(auth: Dict[str, Any], child_name: Optional[str] = None):
    import pronotepy  # lazy : cold start
    account_type = auth.get("account_type", "eleve").lower()
    is_parent = account_type == "parent"
    ClientClass = pronotepy.ParentClient if is_parent else pronotepy.Client

    try:
        if "token" in auth and "uuid" in auth:
            client = ClientClass.token_login(
                auth["url"],
                auth["username"],
                auth["token"],
                auth["uuid"]
            )
        elif "username" in auth and "password" in auth:
            ent = getattr(pronotepy.ent, auth["ent"]) if auth.get("ent") and hasattr(pronotepy.ent, auth["ent"]) else None
            client = ClientClass(
                auth["url"],
                username=auth["username"],
                password=auth["password"],
                ent=ent
            )
        else:
            raise HTTPException(status_code=401, detail="Données d'authentification incomplètes")

        if is_parent and child_name and hasattr(client, "set_child"):
            if hasattr(client, "children") and client.children:
                target_child = next((c for c in client.children if getattr(c, "name", "").lower() == child_name.lower()), None)
                if target_child:
                    client.set_child(target_child)
                else:
                    client.set_child(child_name)
            else:
                client.set_child(child_name)

        return client
    except HTTPException:
        raise
    except Exception as e:
        raise _classify_pronote_error(e)

# ----------------- Endpoints -----------------

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Aether Pronotepy Bridge",
        "version": "1.0.0",
        "redis_cached": redis_client is not None
    }

@app.post("/auth/login")
def login_direct(req: DirectLoginRequest):
    import pronotepy  # lazy : cold start
    req_url = req.url.lower()
    is_parent = ("parent" in req_url) or (req.account_type.lower() == "parent")
    ClientClass = pronotepy.ParentClient if is_parent else pronotepy.Client

    ent = getattr(pronotepy.ent, req.ent) if req.ent and hasattr(pronotepy.ent, req.ent) else None
    client = None
    try:
        client = ClientClass(
            req.url,
            username=req.username,
            password=req.password,
            ent=ent
        )
    except Exception as e:
        AltClass = pronotepy.Client if is_parent else pronotepy.ParentClient
        try:
            client = AltClass(
                req.url,
                username=req.username,
                password=req.password,
                ent=ent
            )
            is_parent = not is_parent
        except Exception:
            raise HTTPException(status_code=400, detail=f"Erreur de connexion Pronote: {str(e)}")

    if not client or not client.logged_in:
        raise HTTPException(status_code=401, detail="Identifiants incorrects ou établissement injoignable")

    final_account_type = "parent" if is_parent else "eleve"
    user_info = {
        "name": getattr(client.info, "name", req.username),
        "class_name": getattr(client.info, "class_name", ""),
        "establishment": getattr(client.info, "establishment", ""),
        "account_type": final_account_type,
    }

    children = []
    if is_parent and hasattr(client, "children"):
        children = [{"name": c.name, "grade": getattr(c, "grade", "")} for c in client.children]

    auth_payload = {
        "url": req.url,
        "username": req.username,
        "password": req.password,
        "ent": req.ent,
        "account_type": final_account_type,
    }
    encoded_token = base64.b64encode(json.dumps(auth_payload).encode("utf-8")).decode("utf-8")

    return {
        "success": True,
        "user": user_info,
        "children": children,
        "auth_token": encoded_token
    }

@app.post("/auth/qrcode")
def login_qrcode(req: QrCodeLoginRequest):
    import pronotepy  # lazy : cold start
    try:
        qr_dict = req.qr_data if isinstance(req.qr_data, dict) else json.loads(req.qr_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Données QR Code invalides: {str(e)}")

    qr_url = str(qr_dict.get("url", "")).lower()
    is_parent = ("parent" in qr_url) or (req.account_type.lower() == "parent")
    ClientClass = pronotepy.ParentClient if is_parent else pronotepy.Client

    client = None
    last_error: Optional[str] = None
    try:
        client = ClientClass.qrcode_login(qr_dict, req.pin, req.uuid)
    except Exception as e:
        last_error = f"{type(e).__name__}: {str(e)}"
        AltClass = pronotepy.Client if is_parent else pronotepy.ParentClient
        try:
            client = AltClass.qrcode_login(qr_dict, req.pin, req.uuid)
            is_parent = not is_parent
        except Exception as e2:
            last_error = f"{type(e2).__name__}: {str(e2)}"
            client = None
    if client is None:
        # 'dataSec' manquant = handshake refusé par Pronote : PIN incorrect,
        # QR expiré/déjà utilisé, ou protocole inattendu. Log serveur pour diag.
        logger.warning(f"[auth/qrcode] handshake failed uuid={req.uuid} error={last_error}")
        raise HTTPException(
            status_code=401,
            detail="Code PIN incorrect ou QR Code expiré ou déjà utilisé. Génère un nouveau QR Code dans Pronote puis réessaie.",
        )

    if not client or not client.logged_in:
        raise HTTPException(status_code=401, detail="Code PIN ou QR Code expiré")

    final_account_type = "parent" if is_parent else "eleve"
    user_info = {
        "name": getattr(client.info, "name", ""),
        "class_name": getattr(client.info, "class_name", ""),
        "establishment": getattr(client.info, "establishment", ""),
        "account_type": final_account_type,
    }

    children = []
    if is_parent and hasattr(client, "children"):
        children = [{"name": c.name, "grade": getattr(c, "grade", "")} for c in client.children]

    new_token = getattr(client, "password", "")
    auth_payload = {
        "url": getattr(client, "pronote_url", ""),
        "username": getattr(client, "username", ""),
        "token": new_token,
        "uuid": req.uuid,
        "account_type": final_account_type,
    }
    encoded_token = base64.b64encode(json.dumps(auth_payload).encode("utf-8")).decode("utf-8")

    return {
        "success": True,
        "user": user_info,
        "children": children,
        "auth_token": encoded_token,
        "credentials": auth_payload
    }

@app.post("/auth/token")
def login_token(req: TokenLoginRequest):
    import pronotepy  # lazy : cold start
    req_url = req.url.lower()
    is_parent = ("parent" in req_url) or (req.account_type.lower() == "parent")
    ClientClass = pronotepy.ParentClient if is_parent else pronotepy.Client

    client = None
    try:
        client = ClientClass.token_login(req.url, req.username, req.token, req.uuid)
    except Exception as e:
        AltClass = pronotepy.Client if is_parent else pronotepy.ParentClient
        try:
            client = AltClass.token_login(req.url, req.username, req.token, req.uuid)
            is_parent = not is_parent
        except Exception:
            raise HTTPException(status_code=400, detail=f"Erreur token login: {str(e)}")

    if not client or not client.logged_in:
        raise HTTPException(status_code=401, detail="Token expiré ou révoqué")

    final_account_type = "parent" if is_parent else "eleve"
    user_info = {
        "name": getattr(client.info, "name", ""),
        "class_name": getattr(client.info, "class_name", ""),
        "establishment": getattr(client.info, "establishment", ""),
        "account_type": final_account_type,
    }

    children = []
    if is_parent and hasattr(client, "children"):
        children = [{"name": c.name, "grade": getattr(c, "grade", "")} for c in client.children]

    new_token = getattr(client, "password", req.token)
    auth_payload = {
        "url": req.url,
        "username": req.username,
        "token": new_token,
        "uuid": req.uuid,
        "account_type": final_account_type,
    }
    encoded_token = base64.b64encode(json.dumps(auth_payload).encode("utf-8")).decode("utf-8")

    return {
        "success": True,
        "user": user_info,
        "children": children,
        "auth_token": encoded_token,
        "credentials": auth_payload
    }

@app.get("/parent/children")
def get_parent_children(auth: Dict[str, Any] = Depends(get_session_header)):
    client = init_client(auth)
    if not hasattr(client, "children"):
        return {"children": []}
    return {
        "children": [{"name": c.name, "grade": getattr(c, "grade", "")} for c in client.children]
    }

@app.get("/timetable")
def get_timetable(
    from_date: str = Query(..., description="Date début YYYY-MM-DD"),
    to_date: str = Query(..., description="Date fin YYYY-MM-DD"),
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    start_d, end_d = clamp_window(parse_ymd(from_date, "from_date"), parse_ymd(to_date, "to_date"))
    key = _cache_key("timetable", auth, from_date, to_date, child)
    hit = cache_get(key)
    if hit is not None:
        return hit
    client = init_client(auth, child_name=child)

    lessons = client.lessons(start_d, end_d)
    result = []
    for l in lessons:
        status_str = None
        if getattr(l, "canceled", False):
            status_str = "CANCELED"
        elif getattr(l, "status", None):
            status_str = str(l.status)

        teacher = getattr(l, "teacher_name", "")
        if not teacher and hasattr(l, "teachers") and l.teachers:
            teacher = ", ".join(getattr(t, "name", str(t)) for t in l.teachers)

        room = getattr(l, "classroom", "")
        if not room and hasattr(l, "classrooms") and l.classrooms:
            room = ", ".join(getattr(c, "name", str(c)) for c in l.classrooms)

        end_time = getattr(l, "end", None)
        end_iso = end_time.isoformat() if end_time else (l.start + timedelta(hours=1)).isoformat()

        # Contenu et ressources du cours (cahier de textes) — getattr-guarded,
        # liste vide si l'établissement ne l'expose pas.
        lesson_contents = []
        try:
            raw_contents = getattr(l, "content", None) or []
            for c in raw_contents:
                files = []
                try:
                    for f in (getattr(c, "files", None) or []):
                        files.append({
                            "name": getattr(f, "name", "Fichier"),
                            "url": getattr(f, "url", None),
                            "type": getattr(f, "type", None),
                        })
                except Exception:
                    pass
                lesson_contents.append({
                    "title": getattr(c, "title", None),
                    "description": getattr(c, "description", None),
                    "category": getattr(c, "category", None),
                    "files": files,
                })
        except Exception:
            lesson_contents = []

        result.append({
            "id": getattr(l, "id", f"{l.start}_{getattr(l.subject, 'name', '')}"),
            "subject": getattr(l.subject, "name", "Matière") if hasattr(l, "subject") and l.subject else "Matière",
            "teacher": teacher,
            "room": room,
            "start": l.start.isoformat(),
            "end": end_iso,
            "canceled": getattr(l, "canceled", False),
            "status": status_str,
            "color": getattr(l.subject, "color", None) if hasattr(l, "subject") and l.subject else None,
            "memo": getattr(l, "memo", None),
            "is_outing": getattr(l, "outing", False),
            "content": lesson_contents,
        })

    payload = {"lessons": result}
    cache_set(key, payload, 60)
    return payload

@app.get("/grades")
def get_grades(
    period: Optional[str] = Query(None),
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    hit = cache_get(_cache_key("grades", auth, period, child))
    if hit is not None:
        return hit
    client = init_client(auth, child_name=child)
    periods = client.periods

    target_period = None
    if period:
        target_period = next((p for p in periods if p.name == period), None)
    if not target_period and periods:
        target_period = periods[-1] # Default to latest period

    if not target_period:
        return {"grades": [], "averages": None}

    grades_list = []
    for g in target_period.grades:
        grades_list.append({
            "id": getattr(g, "id", f"{g.date}_{getattr(g.subject, 'name', '')}"),
            "subject": getattr(g.subject, "name", "Matière"),
            "description": getattr(g, "comment", "") or getattr(g, "description", ""),
            "comment": getattr(g, "comment", "") or "",
            "date": g.date.isoformat(),
            "value": float(g.grade.replace(",", ".")) if getattr(g, "grade", None) and g.grade.replace(",", ".").replace(".", "", 1).isdigit() else None,
            "out_of": float(g.out_of.replace(",", ".")) if getattr(g, "out_of", None) and g.out_of.replace(",", ".").replace(".", "", 1).isdigit() else 20.0,
            "average": float(g.average.replace(",", ".")) if getattr(g, "average", None) and g.average.replace(",", ".").replace(".", "", 1).isdigit() else None,
            "max": float(g.max.replace(",", ".")) if getattr(g, "max", None) and g.max.replace(",", ".").replace(".", "", 1).isdigit() else None,
            "min": float(g.min.replace(",", ".")) if getattr(g, "min", None) and g.min.replace(",", ".").replace(".", "", 1).isdigit() else None,
            "coefficient": float(g.coefficient.replace(",", ".")) if getattr(g, "coefficient", None) and g.coefficient.replace(",", ".").replace(".", "", 1).isdigit() else 1.0,
            "is_significant": getattr(g, "is_significant", True),
            "is_bonus": bool(getattr(g, "is_bonus", False)),
            "is_optionnal": bool(getattr(g, "is_optionnal", False)),
            "is_out_of_20": bool(getattr(g, "is_out_of_20", False)),
        })

    def parse_float_safe(v):
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return float(v)
        try:
            return float(str(v).replace(",", ".").strip())
        except Exception:
            return None

    subject_averages = {}
    if hasattr(target_period, "averages"):
        for avg in target_period.averages:
            s_name = getattr(avg.subject, "name", "") if hasattr(avg, "subject") else ""
            if s_name:
                subject_averages[s_name] = {
                    "student": parse_float_safe(getattr(avg, "student", None)),
                    "class_average": parse_float_safe(getattr(avg, "class_average", None)),
                    "max": parse_float_safe(getattr(avg, "max", None)),
                    "min": parse_float_safe(getattr(avg, "min", None)),
                    "out_of": parse_float_safe(getattr(avg, "out_of", 20.0)) or 20.0,
                }

    period_averages = {
        "overall": parse_float_safe(getattr(target_period, "overall_average", None)),
        "class_overall": parse_float_safe(getattr(target_period, "class_overall_average", None)),
        "subjects": subject_averages,
    }

    payload = {
        "period": target_period.name,
        "grades": grades_list,
        "averages": period_averages
    }
    cache_set(_cache_key("grades", auth, period, child), payload, 300)
    return payload

@app.get("/grades/periods")
def get_grade_periods(
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    key = _cache_key("grade_periods", auth, child)
    hit = cache_get(key)
    if hit is not None:
        return hit
    client = init_client(auth, child_name=child)
    result = []
    for p in client.periods:
        result.append({
            "id": getattr(p, "id", p.name),
            "name": p.name,
            "start": p.start.isoformat() if hasattr(p, "start") and p.start else None,
            "end": p.end.isoformat() if hasattr(p, "end") and p.end else None,
        })
    payload = {"periods": result}
    cache_set(key, payload, 300)
    return payload

@app.get("/homework")
def get_homework(
    from_date: str = Query(..., description="Date début YYYY-MM-DD"),
    to_date: str = Query(..., description="Date fin YYYY-MM-DD"),
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    start_d, end_d = clamp_window(parse_ymd(from_date, "from_date"), parse_ymd(to_date, "to_date"))
    key = _cache_key("homework", auth, from_date, to_date, child)
    hit = cache_get(key)
    if hit is not None:
        return hit
    client = init_client(auth, child_name=child)

    hw_list = client.homework(start_d, end_d)
    result = []
    for h in hw_list:
        files = []
        if hasattr(h, "files"):
            for f in h.files:
                files.append({"name": getattr(f, "name", "Fichier"), "url": getattr(f, "url", "")})

        result.append({
            "id": getattr(h, "id", f"{h.date}_{getattr(h.subject, 'name', '')}"),
            "subject": getattr(h.subject, "name", "Matière"),
            "description": getattr(h, "description", ""),
            "date": h.date.isoformat(),
            "given_at": getattr(h, "given_at", h.date).isoformat() if hasattr(h, "given_at") else h.date.isoformat(),
            "done": getattr(h, "done", False),
            "files": files,
        })

    payload = {"homework": result}
    cache_set(key, payload, 60)
    return payload

@app.post("/homework/done")
def set_homework_done(
    req: HomeworkDoneRequest,
    auth: Dict[str, Any] = Depends(get_session_header)
):
    client = init_client(auth, child_name=req.child_name)
    wanted = str(req.homework_id)

    def _scan(start_d, end_d):
        try:
            return client.homework(start_d, end_d)
        except Exception:
            return []

    # Indice due_date d'abord (±7j), puis fenêtres élargies.
    windows = []
    if req.due_date:
        try:
            anchor = parse_ymd(req.due_date, "due_date")
            windows.append((anchor - timedelta(days=7), anchor + timedelta(days=7)))
        except HTTPException:
            pass
    today = date.today()
    windows += [
        (today - timedelta(days=15), today + timedelta(days=30)),
        (today - timedelta(days=60), today + timedelta(days=90)),
    ]
    target = None
    for start_d, end_d in windows:
        hw_list = _scan(start_d, end_d)
        target = next((h for h in hw_list if str(getattr(h, "id", None)) == wanted), None)
        if target:
            break

    if not target:
        raise HTTPException(status_code=404, detail="Devoir introuvable")

    target.set_done(req.done)
    return {"success": True, "done": req.done}

@app.get("/attendance")
def get_attendance(
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    akey = _cache_key("attendance", auth, child)
    ahit = cache_get(akey)
    if ahit is not None:
        return ahit
    client = init_client(auth, child_name=child)
    absences = []
    delays = []
    punishments = []

    def _parse_int_safe(v, default=0):
        try:
            if v is None:
                return default
            if isinstance(v, bool):
                return int(v)
            if isinstance(v, int):
                return v
            if isinstance(v, float):
                return int(v)
            return int(str(v).strip())
        except Exception:
            return default

    def _parse_float_safe(v, default=None):
        if v is None:
            return default
        if isinstance(v, bool):
            return float(v)
        if isinstance(v, timedelta):
            try:
                return float(v.total_seconds() / 60)
            except Exception:
                return default
        if isinstance(v, (int, float)):
            return float(v)
        try:
            return float(str(v).replace(",", ".").strip())
        except Exception:
            return default

    periods = getattr(client, "periods", [])
    if not periods and hasattr(client, "current_period") and client.current_period:
        periods = [client.current_period]

    for p in periods:
        if hasattr(p, "absences"):
            for a in p.absences:
                reason_str = ""
                if hasattr(a, "reasons"):
                    reasons = a.reasons
                    reason_str = ", ".join(reasons) if isinstance(reasons, list) else str(reasons)
                elif hasattr(a, "reason"):
                    reason_str = str(a.reason)

                absences.append({
                    "id": getattr(a, "id", str(getattr(a, "from_date", ""))),
                    "from": a.from_date.isoformat() if hasattr(a, "from_date") and a.from_date else None,
                    "to": a.to_date.isoformat() if hasattr(a, "to_date") and a.to_date else None,
                    "justified": getattr(a, "justified", False),
                    "hours": getattr(a, "hours", ""),
                    "reason": reason_str,
                    "days": _parse_int_safe(getattr(a, "days", 0), 0)
                })

        if hasattr(p, "delays"):
            for d in p.delays:
                reason_str = ""
                if hasattr(d, "reasons"):
                    reasons = d.reasons
                    reason_str = ", ".join(reasons) if isinstance(reasons, list) else str(reasons)
                elif hasattr(d, "reason"):
                    reason_str = str(d.reason)

                mins = getattr(d, "minutes", getattr(d, "duration", 0))

                delays.append({
                    "id": getattr(d, "id", str(getattr(d, "date", ""))),
                    "date": d.date.isoformat() if hasattr(d, "date") and d.date else None,
                    "duration": _parse_float_safe(mins, 0),
                    "justified": getattr(d, "justified", False),
                    "reason": reason_str,
                    "justification": getattr(d, "justification", "") or ""
                })

        if hasattr(p, "punishments"):
            for pun in p.punishments:
                pun_reason = getattr(pun, "reason", "")
                if not pun_reason and hasattr(pun, "reasons") and isinstance(pun.reasons, list):
                    pun_reason = ", ".join(pun.reasons)
                punishments.append({
                    "id": getattr(pun, "id", str(getattr(pun, "date", ""))),
                    "date": pun.date.isoformat() if hasattr(pun, "date") and pun.date else None,
                    "reason": pun_reason,
                    "giver": getattr(pun, "giver", ""),
                    "nature": getattr(pun, "nature", ""),
                    "exclusion": bool(getattr(pun, "exclusion", False)),
                    "during_lesson": bool(getattr(pun, "during_lesson", False)),
                    "homework": getattr(pun, "homework", "") or "",
                    "circumstances": getattr(pun, "circumstances", "") or "",
                    "duration_minutes": _parse_float_safe(getattr(pun, "duration", None), None),
                    "schedulable": bool(getattr(pun, "schedulable", False)),
                })

    apayload = {
        "absences": absences,
        "delays": delays,
        "punishments": punishments
    }
    cache_set(akey, apayload, 300)
    return apayload

@app.get("/news")
def get_news(
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    nkey = _cache_key("news", auth, child)
    nhit = cache_get(nkey)
    if nhit is not None:
        return nhit
    client = init_client(auth, child_name=child)
    news_list = []
    if hasattr(client, "information_and_surveys"):
        items = client.information_and_surveys() if callable(client.information_and_surveys) else client.information_and_surveys
        for item in items:
            start_d = getattr(item, "start_date", getattr(item, "creation_date", None))
            news_list.append({
                "id": getattr(item, "id", str(start_d or "")),
                "title": getattr(item, "title", "Actualité"),
                "author": getattr(item, "author", ""),
                "content": getattr(item, "content", ""),
                "date": start_d.isoformat() if start_d else None,
                "acknowledged": getattr(item, "read", True),
            })
    npayload = {"news": news_list}
    cache_set(nkey, npayload, 120)
    return npayload

@app.post("/news/read")
def mark_news_as_read(
    req: NewsReadRequest,
    auth: Dict[str, Any] = Depends(get_session_header)
):
    client = init_client(auth, child_name=req.child_name)
    if hasattr(client, "information_and_surveys"):
        items = client.information_and_surveys() if callable(client.information_and_surveys) else client.information_and_surveys
        target = next((x for x in items if getattr(x, "id", None) == req.news_id), None)
        if target and hasattr(target, "mark_as_read"):
            target.mark_as_read()
            return {"success": True}
    return {"success": True}

@app.get("/canteen")
def get_canteen(
    from_date: str = Query(..., description="Date YYYY-MM-DD"),
    to_date: Optional[str] = Query(None),
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    client = init_client(auth, child_name=child)
    start_d = datetime.strptime(from_date, "%Y-%m-%d").date()
    end_d = datetime.strptime(to_date, "%Y-%m-%d").date() if to_date else start_d

    menus = []
    if hasattr(client, "menus"):
        menus_list = client.menus(start_d, end_d) if callable(client.menus) else client.menus
        for m in menus_list:
            def extract_foods(food_list):
                if not food_list:
                    return []
                res = []
                for f in food_list:
                    name = getattr(f, "name", str(f))
                    labels = [{"name": getattr(l, "name", str(l)), "color": getattr(l, "color", None)} for l in getattr(f, "labels", [])] if hasattr(f, "labels") else []
                    res.append({"name": name, "labels": labels})
                return res

            first_meal = extract_foods(getattr(m, "first_meal", []))
            main_meal = extract_foods(getattr(m, "main_meal", []))
            side_meal = extract_foods(getattr(m, "side_meal", []))
            cheese_meal = extract_foods(getattr(m, "cheese", []))
            dessert_meal = extract_foods(getattr(m, "dessert", []))
            other_meal = extract_foods(getattr(m, "other_meal", []))

            # Build both detailed categories and flat meals list for backward compatibility
            all_items = [f["name"] for f in first_meal + main_meal + side_meal + cheese_meal + dessert_meal + other_meal]
            
            structured_meal = {
                "entry": first_meal,
                "main": main_meal,
                "side": side_meal,
                "cheese": cheese_meal,
                "dessert": dessert_meal,
                "other": other_meal,
            }

            meals = []
            if getattr(m, "is_lunch", True):
                meals.append({"name": "Déjeuner", "items": all_items})
            if getattr(m, "is_dinner", False):
                meals.append({"name": "Dîner", "items": all_items})
            if not meals:
                meals.append({"name": "Repas", "items": all_items})

            menus.append({
                "date": m.date.isoformat() if hasattr(m, "date") else from_date,
                "is_lunch": getattr(m, "is_lunch", True),
                "is_dinner": getattr(m, "is_dinner", False),
                "meal": structured_meal,
                "meals": meals
            })
    return {"menus": menus}

@app.get("/chats")
def get_chats(
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    client = init_client(auth, child_name=child)
    discussions = []
    if hasattr(client, "discussions"):
        try:
            disc_list = client.discussions() if callable(client.discussions) else client.discussions
            for d in disc_list:
                msgs = getattr(d, "messages", [])
                latest_date = msgs[-1].created.isoformat() if msgs and hasattr(msgs[-1], "created") else datetime.now().isoformat()
                discussions.append({
                    "id": getattr(d, "id", f"disc_{getattr(d, 'subject', '')}"),
                    "subject": getattr(d, "subject", "Discussion"),
                    "creator": getattr(d, "creator", ""),
                    "recipient": getattr(d, "recipient", ""),
                    "unread": getattr(d, "unread", 0),
                    "closed": getattr(d, "closed", False),
                    "date": latest_date,
                })
        except Exception:
            pass
    return {"chats": discussions}

@app.get("/chats/{chat_id}/messages")
def get_chat_messages(
    chat_id: str,
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    client = init_client(auth, child_name=child)
    messages = []
    if hasattr(client, "discussions"):
        try:
            disc_list = client.discussions() if callable(client.discussions) else client.discussions
            d = next((x for x in disc_list if getattr(x, "id", None) == chat_id), None)
            if d and hasattr(d, "messages"):
                for m in d.messages:
                    messages.append({
                        "id": getattr(m, "id", str(getattr(m, "created", ""))),
                        "author": getattr(m, "author", "") or "Moi",
                        "content": getattr(m, "content", ""),
                        "date": m.created.isoformat() if hasattr(m, "created") and m.created else datetime.now().isoformat(),
                        "seen": getattr(m, "seen", True),
                    })
        except Exception:
            pass
    return {"messages": messages}

@app.post("/chats/send")
def send_chat_message(
    req: SendMessageRequest,
    auth: Dict[str, Any] = Depends(get_session_header)
):
    client = init_client(auth, child_name=req.child_name)
    if hasattr(client, "discussions"):
        disc_list = client.discussions() if callable(client.discussions) else client.discussions
        d = next((x for x in disc_list if getattr(x, "id", None) == req.chat_id), None)
        if not d:
            raise HTTPException(status_code=404, detail="Discussion introuvable")
        if hasattr(d, "reply") and callable(d.reply):
            d.reply(req.content)
        elif hasattr(d, "messages") and d.messages and hasattr(d.messages[-1], "reply"):
            d.messages[-1].reply(req.content)
        return {"success": True}
    raise HTTPException(status_code=400, detail="Messagerie non disponible")

@app.get("/chats/recipients")
def get_chat_recipients(
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    client = init_client(auth, child_name=child)
    recipients = []
    if hasattr(client, "get_recipients"):
        try:
            r_list = client.get_recipients()
            for r in r_list:
                recipients.append({
                    "id": getattr(r, "id", r.name),
                    "name": getattr(r, "name", "Destinataire"),
                    "type": getattr(r, "type", ""),
                    "email": getattr(r, "email", ""),
                    "with_discussion": getattr(r, "with_discussion", True),
                })
        except Exception:
            pass
    return {"recipients": recipients}

@app.post("/chats/new")
def create_new_chat(
    req: CreateChatRequest,
    auth: Dict[str, Any] = Depends(get_session_header)
):
    client = init_client(auth, child_name=req.child_name)
    if hasattr(client, "new_discussion") and hasattr(client, "get_recipients"):
        try:
            all_r = client.get_recipients()
            target_r = [r for r in all_r if getattr(r, "id", r.name) in req.recipient_ids]
            new_disc = client.new_discussion(req.subject, req.content, target_r if target_r else all_r[:1])
            return {
                "success": True,
                "chat_id": getattr(new_disc, "id", f"disc_{req.subject}")
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Impossible d'initier la discussion: {str(e)}")
    raise HTTPException(status_code=400, detail="Fonctionnalité non supportée par cet établissement")

@app.get("/evaluations")
def get_evaluations(
    period: Optional[str] = Query(None),
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    ekey = _cache_key("evaluations", auth, period, child)
    ehit = cache_get(ekey)
    if ehit is not None:
        return ehit
    client = init_client(auth, child_name=child)
    periods = getattr(client, "periods", []) or []

    target_period = None
    if period:
        target_period = next((p for p in periods if getattr(p, "name", None) == period), None)
    if not target_period and periods:
        target_period = periods[-1]

    if not target_period:
        return {"evaluations": []}

    def parse_float_safe(v, default=None):
        if v is None:
            return default
        if isinstance(v, (int, float)):
            try:
                return float(v)
            except Exception:
                return default
        try:
            return float(str(v).replace(",", ".").strip())
        except Exception:
            return default

    try:
        raw_evaluations = target_period.evaluations
    except Exception:
        raw_evaluations = []

    result = []
    for e in (raw_evaluations or []):
        e_subject = getattr(e.subject, "name", "") if hasattr(e, "subject") and getattr(e, "subject", None) else ""
        e_date = getattr(e, "date", None)
        try:
            date_iso = e_date.isoformat() if e_date and hasattr(e_date, "isoformat") else None
        except Exception:
            date_iso = None
        paliers = getattr(e, "paliers", []) or []
        if not isinstance(paliers, list):
            try:
                paliers = list(paliers)
            except Exception:
                paliers = []
        acquisitions = []
        for ac in (getattr(e, "acquisitions", []) or []):
            acquisitions.append({
                "name": getattr(ac, "name", "") or "",
                "abbreviation": getattr(ac, "abbreviation", "") or "",
                "level": getattr(ac, "level", "") or "",
                "coefficient": parse_float_safe(getattr(ac, "coefficient", 1.0), 1.0),
                "domain": getattr(ac, "domain", "") or "",
                "pillar": getattr(ac, "pillar", "") or "",
            })
        result.append({
            "id": getattr(e, "id", f"{getattr(e, 'name', '')}"),
            "name": getattr(e, "name", "") or "",
            "subject": e_subject or "",
            "teacher": getattr(e, "teacher", "") or "",
            "coefficient": parse_float_safe(getattr(e, "coefficient", 1.0), 1.0),
            "description": getattr(e, "description", "") or "",
            "date": date_iso,
            "paliers": paliers,
            "acquisitions": acquisitions,
        })

    epayload = {"evaluations": result}
    cache_set(_cache_key("evaluations", auth, period, child), epayload, 300)
    return epayload

@app.get("/report")
def get_report(
    period: Optional[str] = Query(None),
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    rkey = _cache_key("report", auth, period, child)
    rhit = cache_get(rkey)
    if rhit is not None:
        return rhit
    client = init_client(auth, child_name=child)
    periods = getattr(client, "periods", []) or []

    target_period = None
    if period:
        target_period = next((p for p in periods if getattr(p, "name", None) == period), None)
    if not target_period and periods:
        target_period = periods[-1]

    if not target_period:
        return {"report": None}

    try:
        r = getattr(target_period, "report", None)
    except Exception:
        r = None

    if r is None:
        return {"report": None}

    subjects = []
    for s in (getattr(r, "subjects", []) or []):
        comments = getattr(s, "comments", []) or []
        if not isinstance(comments, list):
            try:
                comments = list(comments)
            except Exception:
                comments = []
        teachers = getattr(s, "teachers", []) or []
        if not isinstance(teachers, list):
            try:
                teachers = list(teachers)
            except Exception:
                teachers = []
        subjects.append({
            "name": getattr(s, "name", "") or "",
            "color": getattr(s, "color", None),
            "comments": comments,
            "class_average": getattr(s, "class_average", None),
            "student_average": getattr(s, "student_average", None),
            "min_average": getattr(s, "min_average", None),
            "max_average": getattr(s, "max_average", None),
            "coefficient": getattr(s, "coefficient", None),
            "teachers": teachers,
        })

    top_comments = getattr(r, "comments", []) or []
    if not isinstance(top_comments, list):
        try:
            top_comments = list(top_comments)
        except Exception:
            top_comments = []

    rpayload = {"report": {"comments": top_comments, "subjects": subjects}}
    cache_set(rkey, rpayload, 300)
    return rpayload

@app.get("/teaching-staff")
def get_teaching_staff(
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    client = init_client(auth, child_name=child)
    staff = []
    try:
        if hasattr(client, "get_teaching_staff") and callable(getattr(client, "get_teaching_staff")):
            raw_staff = client.get_teaching_staff()
        else:
            raw_staff = []
    except Exception:
        raw_staff = []

    for s in (raw_staff or []):
        subjects = getattr(s, "subjects", []) or []
        subject_str = ""
        try:
            if subjects and isinstance(subjects, list):
                subject_str = getattr(subjects[0], "name", "") or ""
            else:
                fallback = getattr(s, "subject", "") or ""
                subject_str = fallback if isinstance(fallback, str) else str(fallback)
        except Exception:
            subject_str = ""
        try:
            email_raw = getattr(s, "email", "") or ""
            email_str = email_raw if isinstance(email_raw, str) else str(email_raw)
        except Exception:
            email_str = ""
        staff.append({
            "name": getattr(s, "name", "") or "",
            "subject": subject_str or "",
            "email": email_str or "",
        })

    return {"staff": staff}

@app.get("/ical-url")
def get_ical_url(
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    client = init_client(auth, child_name=child)
    url = None
    try:
        if hasattr(client, "export_ical") and callable(getattr(client, "export_ical")):
            raw_url = client.export_ical()
            if isinstance(raw_url, str):
                url = raw_url
            elif raw_url:
                try:
                    url = str(raw_url)
                except Exception:
                    url = None
            else:
                url = None
        else:
            url = None
    except Exception:
        url = None
    return {"url": url}

@app.post("/files/download")
def download_file(
    req: FileDownloadRequest,
    auth: Dict[str, Any] = Depends(get_session_header)
):
    """Télécharge un fichier Pronote (devoir ou contenu de cours) et le renvoie en base64.

    L'authentification est portée par le header X-Pronote-Auth (blob base64 JSON
    contenant url/username/token ou password/uuid/ent/account_type). Le body ne
    porte que file_url / file_name (+ child_name pour les comptes parents).

    Les URLs Pronote sont sessionnées et expirent : on recherche donc d'abord la
    pièce jointe correspondante (par nom, puis par URL) dans les devoirs et les
    contenus de cours afin d'obtenir une URL fraîche via une session authentifiée,
    avec fallback sur un GET authentifié direct de file_url.
    """
    client = init_client(auth, child_name=req.child_name)
    try:
        active_child = getattr(client, "selected_child", None) or getattr(client, "child", None)
        logger.info(f"[files/download] child requested={req.child_name!r} active={active_child!r} file={(req.file_name or '').strip()!r}")
    except Exception:
        pass

    target_url = (req.file_url or "").strip()
    target_name = (req.file_name or "").strip()
    if not target_url and not target_name:
        raise HTTPException(status_code=400, detail="file_url ou file_name requis")

    found_bytes: Optional[bytes] = None
    found_name = target_name or "fichier"

    import unicodedata
    from urllib.parse import urlsplit, parse_qsl, urlunsplit

    def _norm_name(s: str) -> str:
        s = (s or "").strip()
        s = unicodedata.normalize("NFD", s)
        s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
        return " ".join(s.lower().split())

    def _norm_url(u: str) -> str:
        try:
            p = urlsplit((u or "").strip())
            q = [(k, v) for (k, v) in parse_qsl(p.query) if not k.lower().startswith(("sess", "token", "id"))]
            return urlunsplit((p.scheme.lower(), p.netloc.lower(), p.path.rstrip("/"), "&".join(f"{k}={v}" for k, v in q), ""))
        except Exception:
            return (u or "").strip()

    norm_target_name = _norm_name(target_name)
    norm_target_url = _norm_url(target_url)
    # 3e passage : candidats par nom seul (URL sessionnée expirée).
    name_only_candidates = []

    def _try_consume_attachment(f, name_only: bool = False) -> bool:
        nonlocal found_bytes, found_name
        try:
            fname = str(getattr(f, "name", "") or "")
            furl = str(getattr(f, "url", "") or "")
        except Exception:
            return False
        if name_only:
            if not (norm_target_name and fname and _norm_name(fname) == norm_target_name):
                return False
        else:
            name_match = bool(target_name and fname and _norm_name(fname) == norm_target_name)
            url_match = bool(target_url and furl and _norm_url(furl) == norm_target_url)
            if not (name_match or url_match):
                if norm_target_name and fname and _norm_name(fname) == norm_target_name:
                    name_only_candidates.append(f)
                return False
        if getattr(f, "type", 1) == 0:
            raise HTTPException(
                status_code=400,
                detail="Ce document est un lien externe, ouvrez-le dans le navigateur."
            )
        try:
            data = f.data
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"Échec du téléchargement du fichier Pronote: {str(e)}"
            )
        if not data:
            return False
        found_bytes = bytes(data)
        if fname:
            found_name = fname
        return True

    today = date.today()

    def _scan_homework(start_d, end_d) -> bool:
        try:
            hw_list = client.homework(start_d, end_d)
        except HTTPException:
            raise
        except Exception:
            return False
        for h in (hw_list or []):
            try:
                files = getattr(h, "files", None) or []
            except Exception:
                continue
            for f in files:
                if _try_consume_attachment(f):
                    return True
            if found_bytes is not None:
                return True
        return found_bytes is not None

    def _scan_lessons(start_d, end_d) -> bool:
        try:
            lessons = client.lessons(start_d, end_d)
        except HTTPException:
            raise
        except Exception:
            return False
        for lesson in (lessons or []):
            try:
                contents = getattr(lesson, "content", None) or []
            except Exception:
                continue
            for c in contents:
                try:
                    files = getattr(c, "files", None) or []
                except Exception:
                    continue
                for f in files:
                    if _try_consume_attachment(f):
                        return True
                if found_bytes is not None:
                    return True
            if found_bytes is not None:
                return True
        return found_bytes is not None

    # 0) Indice due_date/given_at d'abord (±7j) : évite le scan 150j systématique.
    if found_bytes is None and req.due_date:
        try:
            anchor = parse_ymd(req.due_date, "due_date")
            _scan_homework(anchor - timedelta(days=7), anchor + timedelta(days=7))
            if found_bytes is None:
                _scan_lessons(anchor - timedelta(days=7), anchor + timedelta(days=7))
        except HTTPException:
            raise
        except Exception:
            pass

    # 1) Recherche dans les devoirs (fenêtre large pour couvrir les pièces jointes expirées).
    if found_bytes is None:
        _scan_homework(today - timedelta(days=60), today + timedelta(days=90))

    # 2) Recherche dans les contenus de cours (cahier de textes).
    if found_bytes is None:
        try:
            _scan_lessons(today - timedelta(days=60), today + timedelta(days=60))
            for lesson in (lessons or []):
                try:
                    contents = getattr(lesson, "content", None) or []
                except Exception:
                    continue
                for c in contents:
                    try:
                        files = getattr(c, "files", None) or []
                    except Exception:
                        continue
                    for f in files:
                        if _try_consume_attachment(f):
                            break
                    if found_bytes is not None:
                        break
                if found_bytes is not None:
                    break
        except HTTPException:
            raise
        except Exception:
            pass

    # 2b) 3e passage : nom seul (URL sessionnée expirée / renommage query).
    if found_bytes is None and name_only_candidates:
        for f in name_only_candidates:
            try:
                if _try_consume_attachment(f, name_only=True):
                    break
            except HTTPException:
                raise
            except Exception:
                continue

    # 3) Fallback : GET authentifié direct de file_url avec les cookies de session.
    if found_bytes is None:
        if not target_url:
            detail = "Fichier introuvable ou session Pronote expirée."
            if req.child_name:
                detail += f" (enfant : {req.child_name})"
            raise HTTPException(status_code=404, detail=detail)
        try:
            sess = getattr(getattr(client, "communication", None), "session", None)
            if sess is None:
                raise HTTPException(status_code=500, detail="Session Pronote indisponible.")
            resp = sess.get(target_url, timeout=20)
            if getattr(resp, "status_code", 500) != 200:
                raise HTTPException(
                    status_code=404,
                    detail="Fichier introuvable ou session Pronote expirée. Rouvrez la liste pour rafraîchir."
                )
            content = getattr(resp, "content", None)
            if not content:
                raise HTTPException(status_code=404, detail="Fichier vide ou introuvable.")
            found_bytes = bytes(content)
            if target_name:
                found_name = target_name
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"Échec du téléchargement du fichier: {str(e)}"
            )

    if not found_bytes:
        detail = "Fichier introuvable ou session Pronote expirée. Rouvrez la liste pour rafraîchir."
        if req.child_name:
            detail += f" (enfant : {req.child_name})"
        raise HTTPException(status_code=404, detail=detail)

    # Vercel plafonne les réponses ~4.5Mo : au-delà, base64 exploserait (502
    # plateforme). 413 explicite plutôt qu'un timeout opaque.
    if len(found_bytes) > 4 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux pour être ouvert depuis l'app (max 4 Mo).")

    mime, _ = mimetypes.guess_type(found_name)
    if not mime:
        mime = "application/octet-stream"

    return {
        "filename": found_name,
        "mime": mime,
        "base64": base64.b64encode(found_bytes).decode("ascii"),
    }
