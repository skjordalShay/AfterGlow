"""End-to-end backend tests for The Afterglow API."""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else None
if not BASE_URL:
    # fall back to frontend/.env
    fe_env = Path("/app/frontend/.env")
    if fe_env.exists():
        for line in fe_env.read_text().splitlines():
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL missing"

SEED_PW = "gentle1234"
TESTUSER = "testuser@afterglow.app"
MARGARET = "margaret@afterglow.app"


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def testuser_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": TESTUSER, "password": SEED_PW})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def margaret_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": MARGARET, "password": SEED_PW})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Health ----------
def test_health(s):
    r = s.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


# ---------- Auth ----------
class TestAuth:
    def test_signup_success(self, s):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{BASE_URL}/api/auth/signup",
                   json={"email": email, "password": "gentle1234", "first_name": "Testy"})
        assert r.status_code == 201, r.text
        j = r.json()
        assert "access_token" in j
        assert j["user"]["email"] == email.lower()
        assert j["user"]["first_name"] == "Testy"
        assert "_id" not in j["user"]
        assert "password_hash" not in j["user"]

    def test_signup_duplicate(self, s):
        r = s.post(f"{BASE_URL}/api/auth/signup",
                   json={"email": TESTUSER, "password": SEED_PW, "first_name": "X"})
        assert r.status_code == 409, r.text

    def test_signup_short_password(self, s):
        r = s.post(f"{BASE_URL}/api/auth/signup",
                   json={"email": f"TEST_{uuid.uuid4().hex[:6]}@x.com",
                         "password": "short", "first_name": "X"})
        assert r.status_code == 422

    def test_login_success(self, s):
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": TESTUSER, "password": SEED_PW})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_wrong_password(self, s):
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": TESTUSER, "password": "wrongpassword"})
        assert r.status_code == 401

    def test_me_requires_auth(self, s):
        r = s.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_ok(self, s, testuser_token):
        r = s.get(f"{BASE_URL}/api/auth/me", headers=auth(testuser_token))
        assert r.status_code == 200
        j = r.json()
        assert j["email"] == TESTUSER
        assert "_id" not in j
        assert "password_hash" not in j


# ---------- Profile ----------
class TestProfile:
    def test_update_and_persist(self, s, testuser_token):
        new_zip = f"1000{uuid.uuid4().hex[:1]}"
        r = s.patch(f"{BASE_URL}/api/profile",
                    headers=auth(testuser_token),
                    json={"zip_code": new_zip, "about": "TEST_about"})
        assert r.status_code == 200, r.text
        assert r.json()["zip_code"] == new_zip
        # GET verifies persistence
        r2 = s.get(f"{BASE_URL}/api/auth/me", headers=auth(testuser_token))
        assert r2.json()["zip_code"] == new_zip
        assert r2.json()["about"] == "TEST_about"


# ---------- Members ----------
class TestMembers:
    def test_list_excludes_self_and_leaks(self, s, testuser_token):
        r = s.get(f"{BASE_URL}/api/members", headers=auth(testuser_token))
        assert r.status_code == 200
        members = r.json()
        assert isinstance(members, list)
        assert len(members) >= 4
        me = s.get(f"{BASE_URL}/api/auth/me", headers=auth(testuser_token)).json()
        ids = [m["id"] for m in members]
        assert me["id"] not in ids
        for m in members:
            assert "email" not in m
            assert "_id" not in m
            assert "password_hash" not in m
        # Contains seed users
        names = {m["first_name"] for m in members}
        assert {"Margaret", "Harold", "Eleanor", "Frank"}.issubset(names)


# ---------- Waves ----------
class TestWaves:
    def test_send_and_receive_wave(self, s, testuser_token, margaret_token):
        me = s.get(f"{BASE_URL}/api/auth/me", headers=auth(testuser_token)).json()
        margaret = s.get(f"{BASE_URL}/api/auth/me", headers=auth(margaret_token)).json()

        r = s.post(f"{BASE_URL}/api/waves",
                   headers=auth(testuser_token),
                   json={"to_id": margaret["id"], "message": "TEST_hi"})
        assert r.status_code == 201, r.text
        wave = r.json()
        assert wave["from_id"] == me["id"]
        assert wave["to_id"] == margaret["id"]
        assert "_id" not in wave

        # Margaret should see wave in received
        r2 = s.get(f"{BASE_URL}/api/waves/received", headers=auth(margaret_token))
        assert r2.status_code == 200
        assert any(w["id"] == wave["id"] for w in r2.json())

    def test_self_wave_400(self, s, testuser_token):
        me = s.get(f"{BASE_URL}/api/auth/me", headers=auth(testuser_token)).json()
        r = s.post(f"{BASE_URL}/api/waves",
                   headers=auth(testuser_token),
                   json={"to_id": me["id"]})
        assert r.status_code == 400

    def test_wave_invalid_target_404(self, s, testuser_token):
        r = s.post(f"{BASE_URL}/api/waves",
                   headers=auth(testuser_token),
                   json={"to_id": str(uuid.uuid4())})
        assert r.status_code == 404


# ---------- Messaging ----------
class TestMessaging:
    def test_send_and_list_messages(self, s, testuser_token, margaret_token):
        margaret = s.get(f"{BASE_URL}/api/auth/me", headers=auth(margaret_token)).json()
        me = s.get(f"{BASE_URL}/api/auth/me", headers=auth(testuser_token)).json()
        text = f"TEST_msg_{uuid.uuid4().hex[:6]}"

        r = s.post(f"{BASE_URL}/api/messages",
                   headers=auth(testuser_token),
                   json={"to_id": margaret["id"], "text": text})
        assert r.status_code == 201, r.text
        msg = r.json()
        assert msg["text"] == text
        assert "_id" not in msg

        # both sides see via /conversations/{other}/messages
        r2 = s.get(f"{BASE_URL}/api/conversations/{margaret['id']}/messages",
                   headers=auth(testuser_token))
        assert r2.status_code == 200
        texts = [m["text"] for m in r2.json()]
        assert text in texts
        # verify ascending order
        times = [m["created_at"] for m in r2.json()]
        assert times == sorted(times)

        r3 = s.get(f"{BASE_URL}/api/conversations/{me['id']}/messages",
                   headers=auth(margaret_token))
        assert r3.status_code == 200
        assert any(m["text"] == text for m in r3.json())

    def test_conversations_list(self, s, testuser_token):
        r = s.get(f"{BASE_URL}/api/conversations", headers=auth(testuser_token))
        assert r.status_code == 200
        convs = r.json()
        assert isinstance(convs, list)
        assert len(convs) >= 1
        c = convs[0]
        for key in ("conversation_id", "other_user_id", "other_user_name", "last_message", "last_message_at"):
            assert key in c

    def test_self_message_400(self, s, testuser_token):
        me = s.get(f"{BASE_URL}/api/auth/me", headers=auth(testuser_token)).json()
        r = s.post(f"{BASE_URL}/api/messages",
                   headers=auth(testuser_token),
                   json={"to_id": me["id"], "text": "x"})
        assert r.status_code == 400


# ---------- Gatherings ----------
class TestGatherings:
    def test_list_gatherings(self, s, testuser_token):
        r = s.get(f"{BASE_URL}/api/gatherings", headers=auth(testuser_token))
        assert r.status_code == 200
        g = r.json()
        assert isinstance(g, list)
        assert len(g) == 6
        for item in g:
            for key in ("id", "category", "title", "host", "starts_at", "duration_minutes"):
                assert key in item
            assert "_id" not in item

    def test_gatherings_requires_auth(self, s):
        r = s.get(f"{BASE_URL}/api/gatherings")
        assert r.status_code == 401
