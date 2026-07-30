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
            # Check database dialect
            is_sqlite = engine.url.drivername.startswith("sqlite")
            
            if is_sqlite:
                # SQLite migration path
                res = await session.execute(text("PRAGMA table_info(rps)"))
                cols = [row[1] for row in res.fetchall()]
                if "bahan_kajian" not in cols:
                    await session.execute(text("ALTER TABLE rps ADD COLUMN bahan_kajian JSON"))
                    await session.commit()
                if "deskripsi_mata_kuliah" not in cols:
                    await session.execute(text("ALTER TABLE rps ADD COLUMN deskripsi_mata_kuliah JSON"))
                    await session.commit()
                if "sdgs" not in cols:
                    await session.execute(text("ALTER TABLE rps ADD COLUMN sdgs JSON"))
                    await session.commit()
                    
                res_mk = await session.execute(text("PRAGMA table_info(mata_kuliah)"))
                cols_mk = [row[1] for row in res_mk.fetchall()]
                if "sdgs" not in cols_mk:
                    await session.execute(text("ALTER TABLE mata_kuliah ADD COLUMN sdgs JSON"))
                    await session.commit()
                # Add composite unique index for SQLite
                await session.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_mata_kuliah_kode_prodi ON mata_kuliah (kode, prodi_id)"))
                await session.commit()
            else:
                # PostgreSQL migration path
                # Check rps table columns
                res = await session.execute(text(
                    "SELECT column_name FROM information_schema.columns WHERE table_name='rps'"
                ))
                cols = [row[0] for row in res.fetchall()]
                if "bahan_kajian" not in cols:
                    await session.execute(text("ALTER TABLE rps ADD COLUMN bahan_kajian JSON"))
                    await session.commit()
                if "deskripsi_mata_kuliah" not in cols:
                    await session.execute(text("ALTER TABLE rps ADD COLUMN deskripsi_mata_kuliah JSON"))
                    await session.commit()
                if "sdgs" not in cols:
                    await session.execute(text("ALTER TABLE rps ADD COLUMN sdgs JSON"))
                    await session.commit()
                    print("[DATABASE] Successfully added 'sdgs' column to 'rps' table (PostgreSQL).")
                    
                # Check mata_kuliah table columns
                res_mk = await session.execute(text(
                    "SELECT column_name FROM information_schema.columns WHERE table_name='mata_kuliah'"
                ))
                cols_mk = [row[0] for row in res_mk.fetchall()]
                if "sdgs" not in cols_mk:
                    await session.execute(text("ALTER TABLE mata_kuliah ADD COLUMN sdgs JSON"))
                    await session.commit()
                    print("[DATABASE] Successfully added 'sdgs' column to 'mata_kuliah' table (PostgreSQL).")
                    
                # Migrate unique constraint to composite in PostgreSQL
                res_con = await session.execute(text(
                    "SELECT constraint_name FROM information_schema.table_constraints "
                    "WHERE table_name='mata_kuliah' AND constraint_name='uq_mata_kuliah_kode_prodi'"
                ))
                if not res_con.scalar():
                    await session.execute(text("ALTER TABLE mata_kuliah DROP CONSTRAINT IF EXISTS mata_kuliah_kode_key"))
                    await session.execute(text("ALTER TABLE mata_kuliah ADD CONSTRAINT uq_mata_kuliah_kode_prodi UNIQUE (kode, prodi_id)"))
                    await session.commit()
                    print("[DATABASE] Successfully migrated 'mata_kuliah' unique constraint to composite (kode, prodi_id) (PostgreSQL).")
                    
        except Exception as e:
            print(f"[DATABASE MIGRATION WARNING] {e}")