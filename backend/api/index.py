import os
import json
import base64
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta

from fastapi import FastAPI, HTTPException, Header, Depends, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pronotepy

# Optional Upstash Redis import
try:
    from upstash_redis import Redis
    UPSTASH_URL = os.environ.get("UPSTASH_REDIS_REST_URL")
    UPSTASH_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN")
    redis_client = Redis(url=UPSTASH_URL, token=UPSTASH_TOKEN) if UPSTASH_URL and UPSTASH_TOKEN else None
except Exception:
    redis_client = None

app = FastAPI(
    title="Aether Pronotepy API",
    version="1.0.0",
    description="Microservice serverless reliant Aether Mobile à Pronote via pronotepy avec support des comptes parents."
)

cors_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins != ["*"] else ["*"],
    allow_credentials=True,
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

class SendMessageRequest(BaseModel):
    chat_id: str
    content: str
    child_name: Optional[str] = None

class SetChildRequest(BaseModel):
    child_name: str

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

def init_client(auth: Dict[str, Any], child_name: Optional[str] = None):
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
            raise HTTPException(status_code=400, detail="Données d'authentification incomplètes")

        if not client.logged_in:
            raise HTTPException(status_code=401, detail="Échec de connexion à Pronote")

        if is_parent and child_name:
            client.set_child(child_name)

        return client
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur d'initialisation Pronote: {str(e)}")

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
    is_parent = req.account_type.lower() == "parent"
    ClientClass = pronotepy.ParentClient if is_parent else pronotepy.Client

    ent = getattr(pronotepy.ent, req.ent) if req.ent and hasattr(pronotepy.ent, req.ent) else None
    try:
        client = ClientClass(
            req.url,
            username=req.username,
            password=req.password,
            ent=ent
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur de connexion Pronote: {str(e)}")

    if not client.logged_in:
        raise HTTPException(status_code=401, detail="Identifiants incorrects ou établissement injoignable")

    user_info = {
        "name": getattr(client.info, "name", req.username),
        "class_name": getattr(client.info, "class_name", ""),
        "establishment": getattr(client.info, "establishment", ""),
        "account_type": req.account_type,
    }

    children = []
    if is_parent and hasattr(client, "children"):
        children = [{"name": c.name, "grade": getattr(c, "grade", "")} for c in client.children]

    auth_payload = {
        "url": req.url,
        "username": req.username,
        "password": req.password,
        "ent": req.ent,
        "account_type": req.account_type,
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
    is_parent = req.account_type.lower() == "parent"
    ClientClass = pronotepy.ParentClient if is_parent else pronotepy.Client

    try:
        qr_dict = req.qr_data if isinstance(req.qr_data, dict) else json.loads(req.qr_data)
        client = ClientClass.qrcode_login(qr_dict, req.pin, req.uuid)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur QR Code / PIN: {str(e)}")

    if not client.logged_in:
        raise HTTPException(status_code=401, detail="Code PIN ou QR Code expiré")

    user_info = {
        "name": getattr(client.info, "name", ""),
        "class_name": getattr(client.info, "class_name", ""),
        "establishment": getattr(client.info, "establishment", ""),
        "account_type": req.account_type,
    }

    children = []
    if is_parent and hasattr(client, "children"):
        children = [{"name": c.name, "grade": getattr(c, "grade", "")} for c in client.children]

    auth_payload = {
        "url": getattr(client, "pronote_url", ""),
        "username": getattr(client, "username", ""),
        "token": getattr(client, "password", ""), # in pronotepy token_login, password field holds the token
        "uuid": req.uuid,
        "account_type": req.account_type,
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
    is_parent = req.account_type.lower() == "parent"
    ClientClass = pronotepy.ParentClient if is_parent else pronotepy.Client

    try:
        client = ClientClass.token_login(req.url, req.username, req.token, req.uuid)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur token login: {str(e)}")

    if not client.logged_in:
        raise HTTPException(status_code=401, detail="Token expiré ou révoqué")

    user_info = {
        "name": getattr(client.info, "name", ""),
        "class_name": getattr(client.info, "class_name", ""),
        "establishment": getattr(client.info, "establishment", ""),
        "account_type": req.account_type,
    }

    children = []
    if is_parent and hasattr(client, "children"):
        children = [{"name": c.name, "grade": getattr(c, "grade", "")} for c in client.children]

    auth_payload = {
        "url": req.url,
        "username": req.username,
        "token": req.token,
        "uuid": req.uuid,
        "account_type": req.account_type,
    }
    encoded_token = base64.b64encode(json.dumps(auth_payload).encode("utf-8")).decode("utf-8")

    return {
        "success": True,
        "user": user_info,
        "children": children,
        "auth_token": encoded_token
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
    client = init_client(auth, child_name=child)
    start_d = datetime.strptime(from_date, "%Y-%m-%d").date()
    end_d = datetime.strptime(to_date, "%Y-%m-%d").date()

    lessons = client.lessons(start_d, end_d)
    result = []
    for l in lessons:
        status_str = None
        if getattr(l, "canceled", False):
            status_str = "CANCELED"
        elif getattr(l, "status", None):
            status_str = str(l.status)

        result.append({
            "id": getattr(l, "id", f"{l.start}_{getattr(l.subject, 'name', '')}"),
            "subject": getattr(l.subject, "name", "Matière"),
            "teacher": getattr(l, "teacher_name", ""),
            "room": getattr(l, "classroom", ""),
            "start": l.start.isoformat(),
            "end": l.end.isoformat(),
            "canceled": getattr(l, "canceled", False),
            "status": status_str,
            "color": getattr(l.subject, "color", None) if hasattr(l, "subject") else None,
            "memo": getattr(l, "memo", None),
            "is_outing": getattr(l, "outing", False),
        })

    return {"lessons": result}

@app.get("/grades")
def get_grades(
    period: Optional[str] = Query(None),
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
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
            "date": g.date.isoformat(),
            "value": float(g.grade.replace(",", ".")) if getattr(g, "grade", None) and g.grade.replace(",", ".").replace(".", "", 1).isdigit() else None,
            "out_of": float(g.out_of.replace(",", ".")) if getattr(g, "out_of", None) and g.out_of.replace(",", ".").replace(".", "", 1).isdigit() else 20.0,
            "average": float(g.average.replace(",", ".")) if getattr(g, "average", None) and g.average.replace(",", ".").replace(".", "", 1).isdigit() else None,
            "max": float(g.max.replace(",", ".")) if getattr(g, "max", None) and g.max.replace(",", ".").replace(".", "", 1).isdigit() else None,
            "min": float(g.min.replace(",", ".")) if getattr(g, "min", None) and g.min.replace(",", ".").replace(".", "", 1).isdigit() else None,
            "coefficient": float(g.coefficient.replace(",", ".")) if getattr(g, "coefficient", None) and g.coefficient.replace(",", ".").replace(".", "", 1).isdigit() else 1.0,
            "is_significant": getattr(g, "is_significant", True),
        })

    period_averages = {
        "overall": getattr(target_period, "overall_average", None),
        "class_overall": getattr(target_period, "class_overall_average", None),
    }

    return {
        "period": target_period.name,
        "grades": grades_list,
        "averages": period_averages
    }

@app.get("/grades/periods")
def get_grade_periods(
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    client = init_client(auth, child_name=child)
    result = []
    for p in client.periods:
        result.append({
            "id": getattr(p, "id", p.name),
            "name": p.name,
            "start": p.start.isoformat() if hasattr(p, "start") and p.start else None,
            "end": p.end.isoformat() if hasattr(p, "end") and p.end else None,
        })
    return {"periods": result}

@app.get("/homework")
def get_homework(
    from_date: str = Query(..., description="Date début YYYY-MM-DD"),
    to_date: str = Query(..., description="Date fin YYYY-MM-DD"),
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    client = init_client(auth, child_name=child)
    start_d = datetime.strptime(from_date, "%Y-%m-%d").date()
    end_d = datetime.strptime(to_date, "%Y-%m-%d").date()

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

    return {"homework": result}

@app.post("/homework/done")
def set_homework_done(
    req: HomeworkDoneRequest,
    auth: Dict[str, Any] = Depends(get_session_header)
):
    client = init_client(auth, child_name=req.child_name)
    # Search homework in a 30-day window around today
    today = date.today()
    hw_list = client.homework(today - timedelta(days=15), today + timedelta(days=30))
    target = next((h for h in hw_list if getattr(h, "id", None) == req.homework_id), None)

    if not target:
        raise HTTPException(status_code=404, detail="Devoir introuvable")

    target.set_done(req.done)
    return {"success": True, "done": req.done}

@app.get("/attendance")
def get_attendance(
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    client = init_client(auth, child_name=child)
    absences = []
    delays = []
    punishments = []

    if hasattr(client, "absences"):
        for a in client.absences:
            absences.append({
                "id": getattr(a, "id", str(a.from_date)),
                "from": a.from_date.isoformat() if hasattr(a, "from_date") else None,
                "to": a.to_date.isoformat() if hasattr(a, "to_date") else None,
                "justified": getattr(a, "justified", False),
                "hours": getattr(a, "hours", ""),
                "reason": getattr(a, "reason", "")
            })

    if hasattr(client, "delays"):
        for d in client.delays:
            delays.append({
                "id": getattr(d, "id", str(d.date)),
                "date": d.date.isoformat() if hasattr(d, "date") else None,
                "duration": getattr(d, "duration", 0),
                "justified": getattr(d, "justified", False),
                "reason": getattr(d, "reason", "")
            })

    if hasattr(client, "punishments"):
        for p in client.punishments:
            punishments.append({
                "id": getattr(p, "id", str(p.date)),
                "date": p.date.isoformat() if hasattr(p, "date") else None,
                "reason": getattr(p, "reason", ""),
                "giver": getattr(p, "giver", ""),
                "nature": getattr(p, "nature", ""),
            })

    return {
        "absences": absences,
        "delays": delays,
        "punishments": punishments
    }

@app.get("/news")
def get_news(
    child: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_session_header)
):
    client = init_client(auth, child_name=child)
    news_list = []
    if hasattr(client, "information_and_surveys"):
        for item in client.information_and_surveys():
            news_list.append({
                "id": getattr(item, "id", str(item.start_date)),
                "title": getattr(item, "title", "Actualité"),
                "author": getattr(item, "author", ""),
                "content": getattr(item, "content", ""),
                "date": item.start_date.isoformat() if hasattr(item, "start_date") else None,
                "acknowledged": getattr(item, "read", True),
            })
    return {"news": news_list}

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
        for m in client.menus(start_d, end_d):
            meals = []
            for meal in getattr(m, "meals", []):
                meals.append({
                    "name": getattr(meal, "name", "Repas"),
                    "items": [getattr(food, "name", str(food)) for food in getattr(meal, "foods", [])]
                })
            menus.append({
                "date": m.date.isoformat() if hasattr(m, "date") else from_date,
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
        for d in client.discussions:
            discussions.append({
                "id": getattr(d, "id", f"disc_{d.subject}"),
                "subject": getattr(d, "subject", "Discussion"),
                "creator": getattr(d, "creator", ""),
                "recipient": getattr(d, "recipient", ""),
                "unread": getattr(d, "unread", 0),
                "date": getattr(d, "date", datetime.now()).isoformat() if hasattr(d, "date") else datetime.now().isoformat(),
            })
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
        d = next((x for x in client.discussions if getattr(x, "id", None) == chat_id), None)
        if d and hasattr(d, "messages"):
            for m in d.messages:
                messages.append({
                    "id": getattr(m, "id", str(m.date)),
                    "author": getattr(m, "author", ""),
                    "content": getattr(m, "content", ""),
                    "date": m.date.isoformat() if hasattr(m, "date") else datetime.now().isoformat(),
                })
    return {"messages": messages}

@app.post("/chats/send")
def send_chat_message(
    req: SendMessageRequest,
    auth: Dict[str, Any] = Depends(get_session_header)
):
    client = init_client(auth, child_name=req.child_name)
    if hasattr(client, "discussions"):
        d = next((x for x in client.discussions if getattr(x, "id", None) == req.chat_id), None)
        if not d:
            raise HTTPException(status_code=404, detail="Discussion introuvable")
        d.reply(req.content)
        return {"success": True}
    raise HTTPException(status_code=400, detail="Messagerie non disponible")
