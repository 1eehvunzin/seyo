from datetime import datetime, timedelta, timezone
from html import escape
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from . import ai
from .auth import LoginError, current_user, issue_token, upsert_user, verify_apple, verify_kakao
from .billing import BillingError, verify_apple_jws, verify_signed_transaction
from .config import get_settings
from .db import get_db
from .models import AiUsage, Device, Membership, Page, Purchase, User, new_token, now
from .serialize import page_out, person

router = APIRouter()

# Fields the app sends that live in columns, not in the stored doc.
SHARING_KEYS = {"id", "owner", "members", "inviteToken", "version", "createdAt", "updatedAt"}
# 멤버는 페이지 "쓰기"만 (체크, 입력, 기록). 모양 바꾸기는 방장만.
MEMBER_WRITABLE = {"main", "memo"}


def _kst_day() -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=9)).date().isoformat()


def _me_out(u: User) -> dict:
    return {**person(u), "plus": u.is_plus(), "plusUntil": u.plus_until.isoformat() if u.plus_until else None, "paywallSeen": u.paywall_seen}


# ───────── auth ─────────


class AppleLogin(BaseModel):
    identity_token: str
    name: str | None = Field(None, description="Apple sends the name only on the first sign-in; the app forwards it")


class KakaoLogin(BaseModel):
    access_token: str


class DevLogin(BaseModel):
    name: str = "나"
    sub: str = "dev-user"


def _session(db: Session, user: User) -> dict:
    return {"accessToken": issue_token(user), "user": _me_out(user)}


@router.post("/auth/apple", tags=["auth"])
def login_apple(body: AppleLogin, db: Session = Depends(get_db)):
    try:
        sub, _email = verify_apple(body.identity_token)
    except LoginError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Apple 로그인을 확인하지 못했어요") from e
    return _session(db, upsert_user(db, "apple", sub, body.name))


@router.post("/auth/kakao", tags=["auth"])
def login_kakao(body: KakaoLogin, db: Session = Depends(get_db)):
    try:
        sub, nickname = verify_kakao(body.access_token)
    except LoginError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "카카오 로그인을 확인하지 못했어요") from e
    return _session(db, upsert_user(db, "kakao", sub, nickname))


@router.post("/auth/dev", tags=["auth"], include_in_schema=get_settings().dev_login)
def login_dev(body: DevLogin, db: Session = Depends(get_db)):
    if not get_settings().dev_login:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return _session(db, upsert_user(db, "dev", body.sub, body.name))


# ───────── me ─────────


@router.get("/me", tags=["me"])
def me(user: User = Depends(current_user)):
    return _me_out(user)


@router.post("/me/paywall-seen", tags=["me"])
def paywall_seen(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """홈 첫 진입 구독 모달은 한 번만."""
    user.paywall_seen = True
    db.commit()
    return _me_out(user)


@router.delete("/me", status_code=204, tags=["me"])
def delete_account(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """App Store requires in-app account deletion. Owned pages go too; memberships are removed."""
    db.query(Page).filter_by(owner_id=user.id).delete()
    db.query(Membership).filter_by(user_id=user.id).delete()
    db.delete(user)
    db.commit()
    return Response(status_code=204)


# ───────── pages ─────────


def _get_page(db: Session, page_id: str) -> Page:
    p = db.get(Page, page_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "페이지를 찾을 수 없어요")
    return p


def _role(p: Page, user: User) -> Literal["owner", "member"] | None:
    if p.owner_id == user.id:
        return "owner"
    if any(m.user_id == user.id for m in p.memberships):
        return "member"
    return None


def _require(p: Page, user: User, owner_only: bool = False) -> str:
    role = _role(p, user)
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "페이지를 찾을 수 없어요")
    if owner_only and role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "방장만 할 수 있어요")
    return role


def _clean(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k not in SHARING_KEYS}


class PageCreate(BaseModel):
    page: dict[str, Any]


class PagePatch(BaseModel):
    patch: dict[str, Any]
    base_version: int | None = Field(None, description="version the client edited; stale → 409 so the app can refetch")


@router.get("/pages", tags=["pages"])
def list_pages(user: User = Depends(current_user), db: Session = Depends(get_db)):
    owned = db.query(Page).filter_by(owner_id=user.id).all()
    shared = db.query(Page).join(Membership).filter(Membership.user_id == user.id).all()
    pages = sorted([*owned, *shared], key=lambda p: p.created_at, reverse=True)
    return [page_out(p, user) for p in pages]


@router.post("/pages", status_code=201, tags=["pages"])
def create_page(body: PageCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = get_settings()
    if not user.is_plus() and db.query(Page).filter_by(owner_id=user.id).count() >= s.free_pages:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "무료로는 여기까지 만들 수 있어요")
    if not isinstance(body.page.get("main"), dict) or "kind" not in body.page["main"]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "페이지 내용이 비어 있어요")
    p = Page(owner_id=user.id, doc=_clean(body.page))
    db.add(p)
    db.commit()
    return page_out(p, user)


@router.get("/pages/{page_id}", tags=["pages"])
def get_page(page_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = _get_page(db, page_id)
    _require(p, user)
    return page_out(p, user)


@router.patch("/pages/{page_id}", tags=["pages"])
def update_page(page_id: str, body: PagePatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = _get_page(db, page_id)
    role = _require(p, user)
    if body.base_version is not None and body.base_version != p.version:
        raise HTTPException(status.HTTP_409_CONFLICT, "다른 사람이 먼저 고쳤어요. 새로 불러올게요")
    patch = _clean(body.patch)
    if role == "member":
        extra = set(patch) - MEMBER_WRITABLE
        if extra:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "페이지 모양은 방장만 바꿀 수 있어요")
        if "main" in patch and patch["main"].get("kind") != p.doc.get("main", {}).get("kind"):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "페이지 모양은 방장만 바꿀 수 있어요")
        if "memo" in patch and p.doc.get("memo") is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "메모 칸은 방장만 만들 수 있어요")
    p.doc = {**p.doc, **patch}
    p.version += 1
    p.updated_at = now()
    db.commit()
    return page_out(p, user)


@router.delete("/pages/{page_id}", status_code=204, tags=["pages"])
def delete_page(page_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = _get_page(db, page_id)
    _require(p, user, owner_only=True)
    db.delete(p)
    db.commit()
    return Response(status_code=204)


# ───────── sharing ─────────


@router.post("/pages/{page_id}/invite/reset", tags=["sharing"])
def reset_invite(page_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """링크 새로 만들기: the old link stops working (내보낸 사람이 다시 못 들어오게)."""
    p = _get_page(db, page_id)
    _require(p, user, owner_only=True)
    p.invite_token = new_token()
    db.commit()
    return {"inviteToken": p.invite_token, "inviteUrl": invite_url(p.invite_token)}


@router.delete("/pages/{page_id}/members/{member_id}", status_code=204, tags=["sharing"])
def kick(page_id: str, member_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = _get_page(db, page_id)
    _require(p, user, owner_only=True)
    db.query(Membership).filter_by(page_id=p.id, user_id=member_id).delete()
    db.commit()
    return Response(status_code=204)


@router.post("/pages/{page_id}/leave", status_code=204, tags=["sharing"])
def leave(page_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = _get_page(db, page_id)
    if _require(p, user) == "owner":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "방장은 나갈 수 없어요. 페이지를 지워 주세요")
    db.query(Membership).filter_by(page_id=p.id, user_id=user.id).delete()
    db.commit()
    return Response(status_code=204)


def invite_url(token: str) -> str:
    return f"{get_settings().public_base_url.rstrip('/')}/join/{token}"


@router.get("/invites/{token}", tags=["sharing"])
def invite_preview(token: str, db: Session = Depends(get_db)):
    p = db.query(Page).filter_by(invite_token=token).one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "이 링크로는 들어갈 수 없어요")
    return {"pageName": p.doc.get("name", ""), "owner": person(p.owner), "memberCount": len(p.memberships) + 1}


@router.post("/invites/{token}/join", tags=["sharing"])
def join(token: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = db.query(Page).filter_by(invite_token=token).one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "이 링크로는 들어갈 수 없어요")
    if _role(p, user) is None:
        db.add(Membership(page_id=p.id, user_id=user.id))
        db.commit()
        db.refresh(p)
    return page_out(p, user)


@router.get("/join/{token}", response_class=HTMLResponse, include_in_schema=False)
def join_landing(token: str):
    """Web fallback for the invite link: opens the app, or the App Store when it isn't installed."""
    s = get_settings()
    app_link = f"{s.app_scheme}://join/{escape(token)}"
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>seyo 초대</title><style>body{{margin:0;font-family:-apple-system,sans-serif;background:#F6F1CC;color:#1D1D1F;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center}}a{{display:inline-block;margin:8px;padding:16px 28px;border-radius:28px;background:#1D1D1F;color:#fff;text-decoration:none}}</style></head>
<body><main><h1>함께 쓰자는 초대가 왔어요</h1><p>seyo에서 열면 바로 같이 쓸 수 있어요.</p>
<a href="{app_link}">seyo에서 열기</a><br><a href="{escape(s.app_store_url)}" style="background:transparent;color:#1D1D1F">앱이 없다면 App Store</a></main>
<script>location.href={app_link!r};</script></body></html>"""


# ───────── AI ─────────


class GenerateIn(BaseModel):
    prompt: str = Field(min_length=1, max_length=1000)


class EditIn(BaseModel):
    page: dict[str, Any]
    command: str = Field(min_length=1, max_length=500)


def _count_edit(db: Session, user: User) -> None:
    s = get_settings()
    row = db.get(AiUsage, (user.id, _kst_day()))
    if row is None:
        row = AiUsage(user_id=user.id, day=_kst_day(), edits=0)
        db.add(row)
    if not user.is_plus() and row.edits >= s.free_ai_edits_per_day:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "오늘 무료로 고칠 수 있는 만큼 다 썼어요")
    row.edits += 1
    db.commit()


@router.post("/ai/generate", tags=["ai"])
async def ai_generate(body: GenerateIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _count_edit(db, user)
    page, steps, follow_ups, source = await ai.generate(body.prompt)
    return {"page": page, "steps": steps, "followUps": follow_ups, "source": source}


@router.post("/ai/edit", tags=["ai"])
async def ai_edit(body: EditIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _count_edit(db, user)
    page, change, source = await ai.edit(body.page, body.command)
    if page is None:
        return {"page": None, "message": change, "source": source}
    return {"page": page, "change": change, "source": source}


# ───────── billing ─────────


class AppleTransaction(BaseModel):
    signed_transaction: str = Field(description="StoreKit 2 Transaction.jwsRepresentation")


@router.post("/billing/apple", tags=["billing"])
def billing_apple(body: AppleTransaction, user: User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        tx = verify_signed_transaction(body.signed_transaction)
    except BillingError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "구매를 확인하지 못했어요") from e
    row = db.get(Purchase, tx.original_transaction_id) or Purchase(original_transaction_id=tx.original_transaction_id, user_id=user.id, product_id=tx.product_id)
    row.expires_at, row.environment, row.updated_at = tx.expires_at, tx.environment, now()
    db.merge(row)
    if tx.expires_at and (not user.plus_until or tx.expires_at > user.plus_until):
        user.plus_until = tx.expires_at
    db.commit()
    return _me_out(user)


@router.post("/billing/dev-plus", tags=["billing"], include_in_schema=get_settings().dev_billing)
def billing_dev(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Dev only: 구독 시작하기 without the App Store."""
    if not get_settings().dev_billing:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    user.plus_until = now() + timedelta(days=365)
    db.commit()
    return _me_out(user)


# ───────── devices (push) ─────────


class DeviceIn(BaseModel):
    expo_push_token: str = Field(pattern=r"^(ExponentPushToken|ExpoPushToken)\[.+\]$")


@router.post("/devices", status_code=204, tags=["push"])
def register_device(body: DeviceIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.merge(Device(token=body.expo_push_token, user_id=user.id))
    db.commit()
    return Response(status_code=204)


class AppStoreNotification(BaseModel):
    signedPayload: str


@router.post("/billing/apple/notifications", status_code=200, tags=["billing"])
def apple_notifications(body: AppStoreNotification, db: Session = Depends(get_db)):
    """App Store Server Notifications v2: renewals, expirations, refunds keep plus_until in sync."""
    try:
        payload = verify_apple_jws(body.signedPayload)
        tx = verify_signed_transaction(payload["data"]["signedTransactionInfo"])
    except (BillingError, KeyError) as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid notification") from e
    row = db.get(Purchase, tx.original_transaction_id)
    if row is None:
        return {"ok": True, "matched": False}  # purchase not linked to a user yet; the app's /billing/apple call links it
    user = db.get(User, row.user_id)
    refunded = payload.get("notificationType") in ("REFUND", "REVOKE")
    row.expires_at = now() if refunded else tx.expires_at
    row.updated_at = now()
    if user:
        user.plus_until = row.expires_at
    db.commit()
    return {"ok": True, "matched": True}
