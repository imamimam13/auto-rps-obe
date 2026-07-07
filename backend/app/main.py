from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.api.v1 import router as v1_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.database import init_db
    from app.core.auth import hash_password
    from app.models import User, UserRole
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import select

    try:
        await init_db()

        # Seed default admin
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.username == "admin"))
            if not result.scalar_one_or_none():
                admin = User(
                    username="admin",
                    password_hash=hash_password("admin"),
                    nama="Administrator",
                    role=UserRole.ADMIN,
                )
                db.add(admin)
                await db.commit()
                print("✅ Default admin created (admin/admin)")
            else:
                print("ℹ️  Admin already exists")
    except Exception as e:
        print(f"Startup error: {e}")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}