import os
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Optional, List

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, APIRouter, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError
from pwdlib import PasswordHash
from jwt.exceptions import InvalidTokenError
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "afterglow-dev-secret-change-me-in-production")
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "43200"))  # 30 days

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

passwords = PasswordHash.recommended()
bearer = HTTPBearer(auto_error=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.users.create_index([("email", ASCENDING)], unique=True)
    await db.waves.create_index([("from_id", ASCENDING), ("to_id", ASCENDING)])
    await db.messages.create_index([("conversation_id", ASCENDING), ("created_at", ASCENDING)])
    # Seed default gatherings if none exist
    if await db.gatherings.count_documents({}) == 0:
        await db.gatherings.insert_many(_default_gatherings())
    yield
    client.close()


app = FastAPI(title="The Afterglow API", lifespan=lifespan)
api = APIRouter(prefix="/api")


# ---------- Models ----------

class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=60)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    zip_code: Optional[str] = None
    about: Optional[str] = None
    photo_url: Optional[str] = None


class PublicUser(BaseModel):
    id: str
    email: EmailStr
    first_name: str
    zip_code: Optional[str] = None
    about: Optional[str] = None
    photo_url: Optional[str] = None
    created_at: datetime


class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: PublicUser


class MemberCard(BaseModel):
    id: str
    first_name: str
    zip_code: Optional[str] = None
    about: Optional[str] = None
    photo_url: Optional[str] = None


class WaveOut(BaseModel):
    id: str
    from_id: str
    from_name: str
    to_id: str
    message: Optional[str] = None
    created_at: datetime


class SendWaveIn(BaseModel):
    to_id: str
    message: Optional[str] = Field(default=None, max_length=280)


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    from_id: str
    to_id: str
    text: str
    created_at: datetime


class SendMessageIn(BaseModel):
    to_id: str
    text: str = Field(min_length=1, max_length=2000)


class ConversationOut(BaseModel):
    conversation_id: str
    other_user_id: str
    other_user_name: str
    other_user_photo: Optional[str] = None
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread: bool = False


class Gathering(BaseModel):
    id: str
    category: str
    title: str
    host: str
    starts_at: datetime
    duration_minutes: int
    image_url: Optional[str] = None
    description: Optional[str] = None


# ---------- Helpers ----------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _norm_email(email: str) -> str:
    return email.strip().lower()


def _issue_token(user_id: str) -> str:
    now = _now()
    return jwt.encode(
        {"sub": user_id, "iat": now, "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES)},
        JWT_SECRET,
        algorithm="HS256",
    )


def _public_user(doc: dict) -> PublicUser:
    return PublicUser(
        id=doc["id"],
        email=doc["email"],
        first_name=doc.get("first_name", ""),
        zip_code=doc.get("zip_code"),
        about=doc.get("about"),
        photo_url=doc.get("photo_url"),
        created_at=doc.get("created_at", _now()),
    )


def _member_card(doc: dict) -> MemberCard:
    return MemberCard(
        id=doc["id"],
        first_name=doc.get("first_name", ""),
        zip_code=doc.get("zip_code"),
        about=doc.get("about"),
        photo_url=doc.get("photo_url"),
    )


def _conversation_id(a: str, b: str) -> str:
    return "::".join(sorted([a, b]))


async def current_user(
    c: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)],
) -> dict:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Invalid or expired session",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not c or c.scheme.lower() != "bearer":
        raise unauthorized
    try:
        p = jwt.decode(
            c.credentials,
            JWT_SECRET,
            algorithms=["HS256"],
            options={"require": ["sub", "exp"]},
        )
    except (InvalidTokenError, KeyError):
        raise unauthorized
    user = await db.users.find_one({"id": p["sub"]}, {"_id": 0})
    if not user:
        raise unauthorized
    return user


# ---------- Auth Routes ----------

@api.post("/auth/signup", response_model=AuthOut, status_code=201)
async def signup(body: SignupIn):
    email = _norm_email(str(body.email))
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "password_hash": passwords.hash(body.password),
        "first_name": body.first_name.strip(),
        "zip_code": None,
        "about": None,
        "photo_url": None,
        "created_at": _now(),
    }
    try:
        await db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "An account with this email already exists")
    return AuthOut(access_token=_issue_token(user_id), user=_public_user(doc))


@api.post("/auth/login", response_model=AuthOut)
async def login(body: LoginIn):
    user = await db.users.find_one({"email": _norm_email(str(body.email))})
    if not user or not passwords.verify(body.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    return AuthOut(access_token=_issue_token(user["id"]), user=_public_user(user))


@api.get("/auth/me", response_model=PublicUser)
async def me(user: Annotated[dict, Depends(current_user)]):
    return _public_user(user)


# ---------- Profile ----------

@api.patch("/profile", response_model=PublicUser)
async def update_profile(
    body: ProfileUpdate,
    user: Annotated[dict, Depends(current_user)],
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return _public_user(fresh)


# ---------- Discover ----------

@api.get("/members", response_model=List[MemberCard])
async def list_members(
    user: Annotated[dict, Depends(current_user)],
    limit: int = 50,
):
    cursor = db.users.find(
        {"id": {"$ne": user["id"]}},
        {"_id": 0, "password_hash": 0, "email": 0},
    ).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [_member_card(d) for d in docs]


# ---------- Waves ----------

@api.post("/waves", response_model=WaveOut, status_code=201)
async def send_wave(
    body: SendWaveIn,
    user: Annotated[dict, Depends(current_user)],
):
    if body.to_id == user["id"]:
        raise HTTPException(400, "You cannot wave at yourself")
    target = await db.users.find_one({"id": body.to_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Member not found")
    wave = {
        "id": str(uuid.uuid4()),
        "from_id": user["id"],
        "from_name": user.get("first_name", ""),
        "to_id": body.to_id,
        "message": body.message,
        "created_at": _now(),
    }
    await db.waves.insert_one(wave)
    return WaveOut(**{k: v for k, v in wave.items() if k != "_id"})


@api.get("/waves/received", response_model=List[WaveOut])
async def waves_received(user: Annotated[dict, Depends(current_user)]):
    cursor = db.waves.find({"to_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(100)
    docs = await cursor.to_list(length=100)
    return [WaveOut(**d) for d in docs]


# ---------- Messaging ----------

@api.get("/conversations", response_model=List[ConversationOut])
async def list_conversations(user: Annotated[dict, Depends(current_user)]):
    my_id = user["id"]
    pipeline = [
        {"$match": {"$or": [{"from_id": my_id}, {"to_id": my_id}]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$conversation_id",
            "last_message": {"$first": "$text"},
            "last_message_at": {"$first": "$created_at"},
            "from_id": {"$first": "$from_id"},
            "to_id": {"$first": "$to_id"},
        }},
    ]
    convs = await db.messages.aggregate(pipeline).to_list(length=200)
    out: List[ConversationOut] = []
    for c in convs:
        other_id = c["to_id"] if c["from_id"] == my_id else c["from_id"]
        other = await db.users.find_one({"id": other_id}, {"_id": 0})
        if not other:
            continue
        out.append(ConversationOut(
            conversation_id=c["_id"],
            other_user_id=other_id,
            other_user_name=other.get("first_name", ""),
            other_user_photo=other.get("photo_url"),
            last_message=c.get("last_message"),
            last_message_at=c.get("last_message_at"),
            unread=False,
        ))
    return out


@api.get("/conversations/{other_id}/messages", response_model=List[MessageOut])
async def get_messages(
    other_id: str,
    user: Annotated[dict, Depends(current_user)],
):
    conv_id = _conversation_id(user["id"], other_id)
    cursor = db.messages.find({"conversation_id": conv_id}, {"_id": 0}).sort("created_at", 1).limit(500)
    docs = await cursor.to_list(length=500)
    return [MessageOut(**d) for d in docs]


@api.post("/messages", response_model=MessageOut, status_code=201)
async def send_message(
    body: SendMessageIn,
    user: Annotated[dict, Depends(current_user)],
):
    if body.to_id == user["id"]:
        raise HTTPException(400, "You cannot message yourself")
    target = await db.users.find_one({"id": body.to_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Member not found")
    msg = {
        "id": str(uuid.uuid4()),
        "conversation_id": _conversation_id(user["id"], body.to_id),
        "from_id": user["id"],
        "to_id": body.to_id,
        "text": body.text.strip(),
        "created_at": _now(),
    }
    await db.messages.insert_one(msg)
    return MessageOut(**{k: v for k, v in msg.items() if k != "_id"})


# ---------- Gatherings ----------

@api.get("/gatherings", response_model=List[Gathering])
async def list_gatherings(user: Annotated[dict, Depends(current_user)]):
    cursor = db.gatherings.find({}, {"_id": 0}).sort("starts_at", 1)
    docs = await cursor.to_list(length=200)
    return [Gathering(**d) for d in docs]


def _default_gatherings() -> list:
    base = datetime.now(timezone.utc).replace(hour=15, minute=0, second=0, microsecond=0)
    items = [
        ("Wellness", "Grief, Light: A Gentle Circle", "Anna K.", 1, 60,
         "https://images.pexels.com/photos/10260353/pexels-photo-10260353.jpeg?auto=compress&cs=tinysrgb&h=650",
         "A warm conversation for those who don't want to be stuck in grief, only softened by it."),
        ("Exercise", "Mostly Gentle Chair Yoga", "Cristina M.", 2, 45,
         "https://images.pexels.com/photos/7833703/pexels-photo-7833703.jpeg?auto=compress&cs=tinysrgb&h=650",
         "A slow, breath-led session you can do from your chair."),
        ("Arts", "Broadway Spotlight: The Pajama Game", "Paul F.", 3, 60,
         "https://images.pexels.com/photos/10260353/pexels-photo-10260353.jpeg?auto=compress&cs=tinysrgb&h=650",
         "A show-by-show journey through Broadway's warmest classics."),
        ("Social", "Sharing Our Life Stories", "Ross B.", 4, 60,
         "https://images.pexels.com/photos/7833703/pexels-photo-7833703.jpeg?auto=compress&cs=tinysrgb&h=650",
         "A great habit you have, or something good you achieved — tell us."),
        ("History", "American History & Literature", "Alan G.", 5, 60,
         "https://images.pexels.com/photos/10260353/pexels-photo-10260353.jpeg?auto=compress&cs=tinysrgb&h=650",
         "A friendly, unhurried tour of the American canon."),
        ("Wellness", "Nutrition & Healthy Eating", "Anna D.", 6, 45,
         "https://images.pexels.com/photos/7833703/pexels-photo-7833703.jpeg?auto=compress&cs=tinysrgb&h=650",
         "Simple, kind changes for how our needs shift with age."),
    ]
    out = []
    for i, (cat, title, host, day_off, dur, img, desc) in enumerate(items):
        out.append({
            "id": str(uuid.uuid4()),
            "category": cat,
            "title": title,
            "host": host,
            "starts_at": base + timedelta(days=day_off),
            "duration_minutes": dur,
            "image_url": img,
            "description": desc,
        })
    return out


# ---------- Health ----------

@api.get("/")
async def root():
    return {"message": "The Afterglow API"}


@api.get("/health")
async def health():
    await db.command("ping")
    return {"ok": True}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)
