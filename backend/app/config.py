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
    apple_bundle_id: str = "com.seyo.app"
    # Kakao: app id that issued the access token (checked against /v1/user/access_token_info)
    kakao_app_id: int | None = None

    # Dev shortcuts. Must be false in prod.
    dev_login: bool = True
    dev_billing: bool = True

    # Claude (page generation and "말로 고치기"). Empty → rule-based fallback.
    anthropic_api_key: str = ""
    claude_model: str = "claude-opus-5-5"
    claude_effort: str = "low"  # low | medium | high

    # Free plan limits (placeholders until pricing is decided)
    free_pages: int = 5
    free_ai_edits_per_day: int = 20

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
