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
                # Check index list to find if old global unique constraint exists on 'kode'
                res_idx = await session.execute(text("PRAGMA index_list(mata_kuliah)"))
                indices = res_idx.fetchall()
                has_global_unique = False
                for idx in indices:
                    idx_name = idx[1]
                    is_unique = idx[2]
                    if is_unique and "uq" not in idx_name and "prodi" not in idx_name:
                        res_info = await session.execute(text(f"PRAGMA index_info({idx_name})"))
                        cols = [r[2] for r in res_info.fetchall()]
                        if cols == ["kode"]:
                            has_global_unique = True
                            break
                            
                if has_global_unique:
                    print("[DATABASE] SQLite global unique index on 'kode' detected. Recreating table to apply composite constraint...")
                    await session.execute(text("PRAGMA foreign_keys=OFF"))
                    await session.execute(text("ALTER TABLE mata_kuliah RENAME TO _mata_kuliah_old"))
                    
                    # Create the new tables
                    async with engine.begin() as conn:
                        await conn.run_sync(Base.metadata.create_all)
                        
                    # Copy data (select only columns that exist in the old table)
                    res_old_cols = await session.execute(text("PRAGMA table_info(_mata_kuliah_old)"))
                    old_cols = [row[1] for row in res_old_cols.fetchall()]
                    
                    # Build dynamic columns copy
                    columns_to_copy = [
                        "id", "kode", "nama", "nama_inggris", "sks", "sks_teori", "sks_praktik", 
                        "semester", "prodi_id", "prasyarat", "cpl_prodi", "cpmk", "sub_cpmk", 
                        "deskripsi", "buku_teks", "buku_rujukan", "status", "created_at", "updated_at"
                    ]
                    # Only copy columns that actually existed in the old table
                    valid_cols = [c for c in columns_to_copy if c in old_cols]
                    if "sdgs" in old_cols:
                        valid_cols.append("sdgs")
                        
                    cols_str = ", ".join(valid_cols)
                    
                    await session.execute(text(f"""
                        INSERT INTO mata_kuliah ({cols_str})
                        SELECT {cols_str} FROM _mata_kuliah_old
                    """))
                    await session.execute(text("DROP TABLE _mata_kuliah_old"))
                    await session.execute(text("PRAGMA foreign_keys=ON"))
                    await session.commit()
                    print("[DATABASE] SQLite table recreation completed successfully!")

                # SQLite column migration path for rps
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