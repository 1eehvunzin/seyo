"""Push reminders through the Expo push service.

- 밤 9시 알림: pages whose log/habits block has remind=true and nothing written today.
- 다시 풀기: wrong-note entries due today.

Run once per hour from a scheduler (cron, Cloud Scheduler, Render cron job):
    python -m app.reminders
It only sends at REMINDER_HOUR_KST, so running it hourly is safe.
"""

import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.orm import Session

from .config import get_settings
from .db import SessionLocal, init_db
from .models import Device, Membership, Page

log = logging.getLogger("seyo.reminders")
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
KST = timezone(timedelta(hours=9))


def _today_start_ms(now: datetime) -> int:
    d = now.astimezone(KST).replace(hour=0, minute=0, second=0, microsecond=0)
    return int(d.timestamp() * 1000)


def due_messages(db: Session, now: datetime) -> list[tuple[str, str, str]]:
    """(user_id, title, body) for everything due now."""
    out: list[tuple[str, str, str]] = []
    today0 = _today_start_ms(now)
    for p in db.query(Page).all():
        main = p.doc.get("main", {})
        kind = main.get("kind")
        readers = [p.owner_id, *[m.user_id for m in db.query(Membership).filter_by(page_id=p.id)]]
        name = p.doc.get("name", "seyo")
        if kind == "log" and main.get("remind") and not any(main.get("values", {}).values()):
            out += [(u, name, "오늘 한 줄 남겨 볼까요?") for u in readers]
        elif kind == "habits" and main.get("remind"):
            idx = now.astimezone(KST).weekday()
            if any(not h["week"][idx] for h in main.get("habits", [])):
                out += [(u, name, "오늘 습관 체크가 남았어요") for u in readers]
        elif kind == "wrong":
            n = sum(1 for e in main.get("entries", []) if e.get("reviewAt", 0) <= today0)
            if n:
                out += [(u, name, f"오늘 다시 풀 문제가 {n}개 있어요") for u in readers]
    return out


def send(now: datetime | None = None, force: bool = False) -> int:
    s = get_settings()
    now = now or datetime.now(timezone.utc)
    if not force and now.astimezone(KST).hour != s.reminder_hour_kst:
        return 0
    init_db()
    with SessionLocal() as db:
        messages = []
        for user_id, title, body in due_messages(db, now):
            for d in db.query(Device).filter_by(user_id=user_id):
                messages.append({"to": d.token, "title": title, "body": body, "sound": "default"})
    if not messages:
        return 0
    headers = {"Authorization": f"Bearer {s.expo_access_token}"} if s.expo_access_token else {}
    with httpx.Client(timeout=20) as client:
        for i in range(0, len(messages), 100):  # Expo accepts up to 100 per request
            r = client.post(EXPO_PUSH_URL, json=messages[i : i + 100], headers=headers)
            if r.status_code != 200:
                log.error("expo push failed %s %s", r.status_code, r.text[:200])
    return len(messages)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(f"sent {send()} reminders")
