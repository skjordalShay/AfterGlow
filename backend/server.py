import os
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Optional, List

import jwt
import requests
import stripe
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, APIRouter, status, UploadFile, File, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ---------- Emergent Object Storage (profile photos) ----------

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "the-afterglow"
MAX_PHOTO_BYTES = 6 * 1024 * 1024
ALLOWED_PHOTO_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic"}
_storage_key: Optional[str] = None


def init_storage() -> str:
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _storage_call(method: str, path: str, **kwargs) -> requests.Response:
    global _storage_key
    resp = requests.request(method, f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": init_storage(), **kwargs.pop("headers", {})},
                            **kwargs)
    if resp.status_code == 503:  # stale key — re-init once
        _storage_key = None
        resp = requests.request(method, f"{STORAGE_URL}/objects/{path}",
                                headers={"X-Storage-Key": init_storage(), **kwargs.pop("headers", {})},
                                **kwargs)
    return resp


def put_object(path: str, data: bytes, content_type: str) -> dict:
    resp = _storage_call("PUT", path, headers={"Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 402:
        raise HTTPException(402, "Photo storage is temporarily unavailable. Please try again later.")
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple[bytes, str]:
    resp = _storage_call("GET", path, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------- Stripe (Premium subscription) ----------

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
PREMIUM_PRICE_CENTS = 599
stripe.api_key = STRIPE_API_KEY
# The shared Emergent test key is routed through the Emergent proxy; a real
# sk_live_/sk_test_ key from your own Stripe account talks to Stripe directly.
if "sk_test_emergent" in STRIPE_API_KEY:
    stripe.api_base = STORAGE_BASE.rstrip("/") + "/stripe"


# ---------- Daily gentle prompts ----------

DAILY_PROMPTS = [
    "What is a small kindness someone showed you this week?",
    "Which song always brings back a warm memory for you?",
    "What did your kitchen smell like on a Sunday when you were young?",
    "Is there a place you would love to visit again, just once more?",
    "What is something you have learned about yourself this past year?",
    "Who taught you the most about patience?",
    "What is a simple pleasure you still look forward to?",
    "What was your favourite way to spend a summer evening?",
    "Is there a book or film you could happily revisit forever?",
    "What is a tradition you would like to keep alive?",
    "What is the best piece of advice you were ever given?",
    "What made you laugh recently, even a little?",
    "Which season feels most like home to you, and why?",
    "What is something you are quietly proud of?",
    "What did you want to be when you were ten years old?",
    "Is there a meal you would love to share with someone again?",
    "What is a hobby you have always wanted to try?",
    "What does a truly restful day look like for you?",
    "Who in your life has always been able to make you feel calm?",
    "What is one thing about today that you are grateful for?",
    "What is a smell that instantly takes you back in time?",
    "If you could give your younger self one gentle word, what would it be?",
    "What is a story your family loves to retell?",
    "What is something beautiful you noticed this week?",
    "Which friend from long ago do you still think about?",
    "What is a skill you are glad you learned?",
    "What was the first concert, show, or dance you ever went to?",
    "What helps you feel steady on a difficult day?",
    "What is a place in your town that holds a memory for you?",
    "What would a perfect quiet morning include?",
    "Is there a garden, tree, or view you have loved for years?",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.users.create_index([("email", ASCENDING)], unique=True)
    await db.waves.create_index([("from_id", ASCENDING), ("to_id", ASCENDING)])
    await db.messages.create_index([("conversation_id", ASCENDING), ("created_at", ASCENDING)])
    await db.photos.create_index([("path", ASCENDING)], unique=True)
    await db.payment_transactions.create_index([("session_id", ASCENDING)], unique=True)
    await db.rsvps.create_index([("user_id", ASCENDING), ("gathering_id", ASCENDING)], unique=True)
    # Seed default gatherings if none exist
    if await db.gatherings.count_documents({}) == 0:
        await db.gatherings.insert_many(_default_gatherings())
    await _roll_gatherings_forward()
    try:
        await run_in_threadpool(init_storage)
    except Exception as e:  # storage is optional at boot; uploads re-init lazily
        logger.warning("Object storage init failed: %s", e)
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
    is_premium: bool = False
    created_at: datetime


class CheckoutIn(BaseModel):
    origin_url: str = Field(min_length=8, max_length=300)


class CheckoutOut(BaseModel):
    url: str
    session_id: str


class PremiumStatus(BaseModel):
    is_premium: bool
    payment_status: Optional[str] = None
    session_status: Optional[str] = None


class DailyPrompt(BaseModel):
    date: str
    prompt: str


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
    is_premium: bool = False


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
    going: bool = False
    attendee_count: int = 0


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
        is_premium=bool(doc.get("is_premium", False)),
        created_at=doc.get("created_at", _now()),
    )


def _member_card(doc: dict) -> MemberCard:
    return MemberCard(
        id=doc["id"],
        first_name=doc.get("first_name", ""),
        zip_code=doc.get("zip_code"),
        about=doc.get("about"),
        photo_url=doc.get("photo_url"),
        is_premium=bool(doc.get("is_premium", False)),
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


@api.post("/profile/photo", response_model=PublicUser)
async def upload_profile_photo(
    user: Annotated[dict, Depends(current_user)],
    file: UploadFile = File(...),
):
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(400, "Please choose a JPG, PNG, or WEBP photo")
    data = await file.read()
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(413, "That photo is too large. Please pick one under 6 MB")
    if not data:
        raise HTTPException(400, "The photo appears to be empty")
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ALLOWED_PHOTO_TYPES[content_type]}"
    result = await run_in_threadpool(put_object, path, data, content_type)
    stored_path = result.get("path", path)
    await db.photos.insert_one({
        "path": stored_path,
        "owner_id": user["id"],
        "content_type": content_type,
        "size": len(data),
        "created_at": _now(),
    })
    photo_url = f"/api/files/{stored_path}"
    await db.users.update_one({"id": user["id"]}, {"$set": {"photo_url": photo_url}})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return _public_user(fresh)


@api.get("/files/{path:path}")
async def serve_file(path: str):
    # Profile photos are visible to every member, so reads are public but
    # limited to objects this app recorded in its own database.
    photo = await db.photos.find_one({"path": path}, {"_id": 0})
    if not photo:
        raise HTTPException(404, "Photo not found")
    try:
        content, content_type = await run_in_threadpool(get_object, path)
    except requests.HTTPError:
        raise HTTPException(404, "Photo not found")
    return Response(
        content=content,
        media_type=photo.get("content_type") or content_type,
        headers={"Cache-Control": "public, max-age=604800, immutable"},
    )


# ---------- Premium (Stripe subscription) ----------

async def _activate_premium(user_id: str, session: dict) -> None:
    sub_id = session.get("subscription")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_premium": True,
            "stripe_subscription_id": sub_id,
            "stripe_customer_id": session.get("customer"),
            "premium_since": _now(),
        }},
    )


async def _sync_session(session_id: str) -> dict:
    session = await run_in_threadpool(stripe.checkout.Session.retrieve, session_id)
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Unknown checkout session")
    paid = session.get("payment_status") == "paid"
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": session.get("payment_status"),
            "session_status": session.get("status"),
            "updated_at": _now(),
        }},
    )
    if paid and tx.get("payment_status") != "paid":
        await _activate_premium(tx["user_id"], session)
    return {"user_id": tx["user_id"], "paid": paid,
            "payment_status": session.get("payment_status"), "session_status": session.get("status")}


@api.post("/premium/checkout", response_model=CheckoutOut)
async def premium_checkout(body: CheckoutIn, user: Annotated[dict, Depends(current_user)]):
    if user.get("is_premium"):
        raise HTTPException(409, "You are already a Premium member")
    origin = body.origin_url.rstrip("/")
    try:
        session = await run_in_threadpool(
            lambda: stripe.checkout.Session.create(
                mode="subscription",
                payment_method_types=["card"],
                line_items=[{
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": PREMIUM_PRICE_CENTS,
                        "recurring": {"interval": "month"},
                        "product_data": {"name": "The Afterglow Premium"},
                    },
                    "quantity": 1,
                }],
                success_url=f"{origin}/premium-success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{origin}/premium-cancel",
                client_reference_id=user["id"],
                metadata={"user_id": user["id"]},
                subscription_data={"metadata": {"user_id": user["id"]}},
            )
        )
    except stripe.StripeError as e:
        logger.error("Stripe checkout failed: %s", e)
        raise HTTPException(502, "We couldn't reach the payment provider. Please try again shortly.")
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.id,
        "user_id": user["id"],
        "email": user["email"],
        "amount_cents": PREMIUM_PRICE_CENTS,
        "currency": "usd",
        "payment_status": "initiated",
        "session_status": session.get("status"),
        "created_at": _now(),
        "updated_at": _now(),
    })
    return CheckoutOut(url=session.url, session_id=session.id)


@api.get("/premium/status", response_model=PremiumStatus)
async def premium_status(
    user: Annotated[dict, Depends(current_user)],
    session_id: Optional[str] = None,
):
    payment_status = session_status = None
    if session_id:
        tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        if not tx or tx["user_id"] != user["id"]:
            raise HTTPException(403, "This checkout does not belong to you")
        try:
            info = await _sync_session(session_id)
            payment_status, session_status = info["payment_status"], info["session_status"]
        except stripe.StripeError as e:
            logger.warning("Stripe status lookup failed: %s", e)
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return PremiumStatus(
        is_premium=bool(fresh.get("is_premium", False)),
        payment_status=payment_status,
        session_status=session_status,
    )


@api.get("/premium/confirm", response_model=PremiumStatus)
async def premium_confirm(session_id: str):
    """Unauthenticated confirmation used by the browser success page after
    checkout (the browser may not hold the app session). Only trusts Stripe."""
    try:
        info = await _sync_session(session_id)
    except stripe.StripeError:
        raise HTTPException(502, "Could not confirm payment yet")
    return PremiumStatus(is_premium=info["paid"], payment_status=info["payment_status"],
                         session_status=info["session_status"])


@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(400, "Webhook secret not configured")
    try:
        event = stripe.Webhook.construct_event(payload, signature, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(400, "Invalid webhook")
    obj = event["data"]["object"]
    etype = event["type"]
    if etype == "checkout.session.completed":
        try:
            await _sync_session(obj["id"])
        except HTTPException:
            pass
    elif etype in {"customer.subscription.updated", "customer.subscription.deleted"}:
        # Authoritative state: keep Premium only while Stripe says the
        # subscription is active (covers cancellations, failed renewals, refunds).
        user_id = (obj.get("metadata") or {}).get("user_id")
        if user_id:
            active = etype != "customer.subscription.deleted" and obj.get("status") in {"active", "trialing"}
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"is_premium": active, "stripe_status": obj.get("status"),
                          "stripe_subscription_id": obj.get("id")}},
            )
    elif etype == "invoice.payment_failed":
        logger.warning("Stripe invoice payment failed for customer %s", obj.get("customer"))
    return {"received": True}


# ---------- Daily gentle prompt ----------

@api.get("/prompts/today", response_model=DailyPrompt)
async def prompt_today(user: Annotated[dict, Depends(current_user)]):
    today = _now().date()
    return DailyPrompt(date=today.isoformat(),
                       prompt=DAILY_PROMPTS[today.toordinal() % len(DAILY_PROMPTS)])


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

async def _roll_gatherings_forward() -> None:
    """Gatherings are weekly classes: once one has ended, move it to the same
    slot next week so the schedule never goes stale."""
    now = _now()
    async for g in db.gatherings.find({}, {"_id": 0, "id": 1, "starts_at": 1, "duration_minutes": 1}):
        starts = g["starts_at"]
        if starts.tzinfo is None:
            starts = starts.replace(tzinfo=timezone.utc)
        ends = starts + timedelta(minutes=g.get("duration_minutes", 60))
        if ends < now:
            weeks = ((now - ends).days // 7) + 1
            await db.gatherings.update_one({"id": g["id"]}, {"$set": {"starts_at": starts + timedelta(weeks=weeks)}})


async def _gatherings_for(user_id: str, only_going: bool = False) -> List[Gathering]:
    my_ids = {r["gathering_id"] async for r in db.rsvps.find({"user_id": user_id}, {"_id": 0, "gathering_id": 1})}
    query = {"id": {"$in": list(my_ids)}} if only_going else {}
    docs = await db.gatherings.find(query, {"_id": 0}).sort("starts_at", 1).to_list(length=200)
    counts = {c["_id"]: c["n"] async for c in db.rsvps.aggregate([{"$group": {"_id": "$gathering_id", "n": {"$sum": 1}}}])}
    for d in docs:  # Mongo drops tzinfo — always hand the app explicit UTC
        if d["starts_at"].tzinfo is None:
            d["starts_at"] = d["starts_at"].replace(tzinfo=timezone.utc)
    return [Gathering(**d, going=d["id"] in my_ids, attendee_count=counts.get(d["id"], 0)) for d in docs]


@api.get("/gatherings", response_model=List[Gathering])
async def list_gatherings(user: Annotated[dict, Depends(current_user)]):
    await _roll_gatherings_forward()
    return await _gatherings_for(user["id"])


@api.get("/gatherings/upcoming", response_model=List[Gathering])
async def upcoming_gatherings(user: Annotated[dict, Depends(current_user)], limit: int = 3):
    """Gatherings this member has RSVP'd to that haven't ended yet."""
    await _roll_gatherings_forward()
    items = await _gatherings_for(user["id"], only_going=True)
    return items[:limit]


@api.post("/gatherings/{gathering_id}/rsvp", response_model=Gathering)
async def rsvp_gathering(gathering_id: str, user: Annotated[dict, Depends(current_user)]):
    if not await db.gatherings.find_one({"id": gathering_id}, {"_id": 0, "id": 1}):
        raise HTTPException(404, "Gathering not found")
    await db.rsvps.update_one(
        {"user_id": user["id"], "gathering_id": gathering_id},
        {"$setOnInsert": {"id": str(uuid.uuid4()), "created_at": _now()}},
        upsert=True,
    )
    return next(g for g in await _gatherings_for(user["id"]) if g.id == gathering_id)


@api.delete("/gatherings/{gathering_id}/rsvp", response_model=Gathering)
async def cancel_rsvp(gathering_id: str, user: Annotated[dict, Depends(current_user)]):
    if not await db.gatherings.find_one({"id": gathering_id}, {"_id": 0, "id": 1}):
        raise HTTPException(404, "Gathering not found")
    await db.rsvps.delete_one({"user_id": user["id"], "gathering_id": gathering_id})
    return next(g for g in await _gatherings_for(user["id"]) if g.id == gathering_id)


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
