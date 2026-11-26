from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration. Values come from env vars or backend/.env (see .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: str = "dev"  # dev | prod
    database_url: str = "sqlite:///./seyo.db"

    # Our own session tokens (issued after Apple/Kakao login)
    jwt_secret: str = "dev-only-change-me-0123456789abcdef"
    jwt_ttl_days: int = 30

    # Sign in with Apple: the id_token audience is the app's bundle id
    apple_bundle_id: str = "app.seyo.kr"
    # Sign in with Apple on the web: the Services ID (comma-separated if more than one)
    apple_service_ids: str = "web.seyo.kr"
    # Kakao: app id that issued the access token (checked against /v1/user/access_token_info)
    kakao_app_id: int | None = None
    # web login (authorization code): the key used as client_id, and the client secret if enabled in Kakao
    kakao_rest_key: str = ""
    kakao_client_secret: str = ""

    # Dev shortcuts. Must be false in prod.
    dev_login: bool = True
    dev_billing: bool = True

    # Page generation and "말로 고치기". auto = OpenAI if its key is set, else Claude, else rules.
    ai_provider: str = "auto"  # auto | openai | anthropic | rules
    openai_api_key: str = ""
    # an OpenAI-compatible gateway (e.g. a reseller: https://apirouter.pleum.ai/v1); empty = OpenAI itself
    openai_base_url: str = ""
    openai_model: str = "gpt-5.5"
    openai_reasoning: str = "low"  # minimal | low | medium | high
    anthropic_api_key: str = ""
    claude_model: str = "claude-opus-5-5"
    claude_effort: str = "low"  # low | medium | high
    # 말로 고치기 runs on a small model: one edit ≈ 2.5k input + ~1k output tokens.
    # gpt-5-mini ($0.25 / $2 per 1M) ≈ $0.003 (about ₩4) per edit; gpt-5.5 would be ≈ 10x.
    openai_edit_model: str = "gpt-5-mini"
    openai_edit_reasoning: str = "low"
    claude_edit_model: str = "claude-haiku-5-5"
    # 바이브 코딩 (HTML 앱 생성/수정, streamed). Speed matters most: small model, minimal reasoning.
    # Claude Sonnet 5.5 via the reseller (OpenAI-compatible): far better UI/layout than gpt-5.4-mini
    # (follows reference layouts, correct calendars); ~30s for a new page vs ~15s.
    openai_code_model: str = "claude-sonnet-5-5"
    # 말로 고치기 (SEARCH/REPLACE edits): small and fast, so an edit stays at a few seconds
    openai_code_edit_model: str = "claude-haiku-5-5"
    openai_code_reasoning: str = "none"
    claude_code_model: str = "claude-haiku-5-5"

    # Free plan limits. AI counts = generate + edit, KST calendar month.
    free_pages: int = 5
    free_ai_edits_per_month: int = 30  # 바이브 코딩 ≈ ₩15–25 a try → worst case ≈ ₩600 per free user per month
    plus_ai_edits_per_month: int = 300  # fair-use cap; on Haiku ≈ ₩3 a use → ≈ ₩900 worst case
    # plus: new pages on Sonnet (≈ ₩80–130 each at list price), then Haiku. 15 → worst case ≈ ₩2,850/월
    # with the 300 uses above, under ₩4,900/월 and ₩39,000/년 (≈ ₩3,250/월) after the store's 15%.
    plus_smart_creates_per_month: int = 15
    # Onboarding before login (no account): per device, lifetime, plus a per-IP daily backstop
    guest_ai_edits: int = 5
    guest_free_creates: int = 2  # onboarding first page (+ one retry) doesn't use a try
    guest_ai_edits_per_ip_per_day: int = 40

    # Invite links
    public_base_url: str = "http://localhost:8000"
    app_scheme: str = "seyo"
    app_store_url: str = "https://apps.apple.com/app/id0000000000"

    # App Store (StoreKit 2) verification
    apple_app_id: int | None = None
    apple_root_cert_dir: str = ""  # folder with AppleRootCA-G3.cer etc.

    # Push (Expo push service)
    expo_access_token: str = ""  # only needed if "enhanced push security" is turned on in Expo
    reminder_hour_kst: int = 21

    cors_origins: str = "*"


@lru_cache
def get_settings() -> Settings:
    return Settings()
