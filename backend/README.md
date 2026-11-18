# seyo backend

FastAPI server for the seyo iPad app: login, pages, sharing (invite/kick/leave), AI page generation and edits, App Store subscriptions, and push reminders.

## Run

```bash
cd backend
py -3.11 -m venv .venv            # Python 3.10+ (the Anthropic SDK needs it)
.venv/Scripts/pip install -r requirements.txt   # macOS/Linux: .venv/bin/pip
cp .env.example .env
.venv/Scripts/uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs. Tests: `.venv/Scripts/python -m pytest -q`.

With the defaults, everything runs locally without any keys: SQLite, `POST /auth/dev` login, `POST /billing/dev-plus`, and rule-based AI. What to connect for production is listed in [../INTEGRATIONS.md](../INTEGRATIONS.md).

## Layout

| File | What it does |
|---|---|
| `app/routes.py` | All endpoints |
| `app/auth.py` | Our JWT, Sign in with Apple token check, Kakao token check |
| `app/ai.py` | Claude structured outputs → page plan → app page JSON; keyword rules when no key |
| `app/billing.py` | StoreKit 2 signed transaction verification |
| `app/reminders.py` | 밤 9시 / 다시 풀기 push through Expo (`python -m app.reminders`, run hourly) |
| `app/models.py` | users, pages, memberships, ai_usage, purchases, devices |

## Rules the server enforces

- **방장**: everything, including shape (theme, name, top, side), invite, kick, reset link, delete.
- **멤버**: writes only `main` (checks, inputs, records; same block kind) and an existing `memo`; can leave.
- **링크 새로 만들기** replaces the token, so the old link stops working.
- **Conflicts**: send `base_version`; a stale edit gets 409 and the app refetches.
- **Free plan**: `FREE_PAGES` own pages, `FREE_AI_EDITS_PER_DAY` AI calls per KST day. Plus lifts both.
- First pages from onboarding are rule-based in the app (no AI call); the app saves them with `POST /pages`.
