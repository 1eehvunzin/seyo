"""Session tokens and the two social logins (Sign in with Apple, Kakao)."""

from datetime import datetime, timedelta, timezone

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import User

APPLE_ISSUER = "https://appleid.apple.com"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
KAKAO_ME_URL = "https://kapi.kakao.com/v2/user/me"
KAKAO_TOKEN_INFO_URL = "https://kapi.kakao.com/v1/user/access_token_info"

_bearer = HTTPBearer(auto_error=False)
_apple_jwks: jwt.PyJWKClient | None = None


class LoginError(Exception):
    pass


# ───────── our session JWT ─────────


def issue_token(user: User) -> str:
    s = get_settings()
    payload = {"sub": user.id, "exp": datetime.now(timezone.utc) + timedelta(days=s.jwt_ttl_days)}
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")


def current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if not cred:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "로그인이 필요해요")
    try:
        sub = jwt.decode(cred.credentials, get_settings().jwt_secret, algorithms=["HS256"])["sub"]
    except jwt.PyJWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "다시 로그인해 주세요") from e
    user = db.get(User, sub)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "다시 로그인해 주세요")
    return user


# ───────── providers ─────────


def verify_apple(identity_token: str) -> tuple[str, str | None]:
    """Verify an Apple identity token against Apple's public keys. Returns (sub, email)."""
    global _apple_jwks
    s = get_settings()
    if _apple_jwks is None:
        _apple_jwks = jwt.PyJWKClient(APPLE_JWKS_URL)
    try:
        key = _apple_jwks.get_signing_key_from_jwt(identity_token)
        claims = jwt.decode(identity_token, key.key, algorithms=["RS256"], audience=s.apple_bundle_id, issuer=APPLE_ISSUER)
    except jwt.PyJWTError as e:
        raise LoginError(f"apple token invalid: {e}") from e
    return claims["sub"], claims.get("email")


def verify_kakao(access_token: str) -> tuple[str, str]:
    """Check a Kakao access token with Kakao's API. Returns (kakao user id, nickname)."""
    s = get_settings()
    headers = {"Authorization": f"Bearer {access_token}"}
    with httpx.Client(timeout=10) as client:
        info = client.get(KAKAO_TOKEN_INFO_URL, headers=headers)
        if info.status_code != 200:
            raise LoginError("kakao token invalid")
        if s.kakao_app_id is not None and info.json().get("app_id") != s.kakao_app_id:
            raise LoginError("kakao token was issued for another app")
        me = client.get(KAKAO_ME_URL, headers=headers)
        if me.status_code != 200:
            raise LoginError("kakao profile unavailable")
    body = me.json()
    nickname = (body.get("kakao_account", {}).get("profile") or {}).get("nickname") or body.get("properties", {}).get("nickname", "")
    return str(body["id"]), nickname


def upsert_user(db: Session, provider: str, sub: str, name: str | None) -> User:
    user = db.query(User).filter_by(provider=provider, provider_sub=sub).one_or_none()
    if user is None:
        user = User(provider=provider, provider_sub=sub, name=name or "")
        db.add(user)
    elif name and not user.name:
        user.name = name
    db.commit()
    return user
