from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import init_db
from .routes import router


@asynccontextmanager
async def lifespan(_: FastAPI):
    s = get_settings()
    if s.env == "prod" and (s.dev_login or s.dev_billing or s.jwt_secret.startswith("dev")):
        raise RuntimeError("prod needs DEV_LOGIN=false, DEV_BILLING=false and a real JWT_SECRET")
    init_db()
    yield


app = FastAPI(title="seyo API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.get("/health", include_in_schema=False)
def health():
    return {"ok": True}
