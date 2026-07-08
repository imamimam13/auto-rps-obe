from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


class Base(DeclarativeBase):
    pass


connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DATABASE_ECHO,
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    from sqlalchemy import text
    async with AsyncSessionLocal() as session:
        try:
            # Check PRAGMA for table info
            res = await session.execute(text("PRAGMA table_info(rps)"))
            cols = [row[1] for row in res.fetchall()]
            if "bahan_kajian" not in cols:
                await session.execute(text("ALTER TABLE rps ADD COLUMN bahan_kajian JSON"))
                await session.commit()
                print("[DATABASE] Successfully added 'bahan_kajian' column to 'rps' table.")
            if "deskripsi_mata_kuliah" not in cols:
                await session.execute(text("ALTER TABLE rps ADD COLUMN deskripsi_mata_kuliah JSON"))
                await session.commit()
                print("[DATABASE] Successfully added 'deskripsi_mata_kuliah' column to 'rps' table.")
        except Exception as e:
            print(f"[DATABASE MIGRATION WARNING] {e}")