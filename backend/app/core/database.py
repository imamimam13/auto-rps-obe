from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


class Base(DeclarativeBase):
    pass


import os
import shutil
from pathlib import Path

# Auto-sync database file if starting working directory changed (e.g. root vs backend folder)
if settings.DATABASE_URL.startswith("sqlite"):
    try:
        backend_dir = Path(__file__).resolve().parent.parent.parent  # /.../backend
        root_dir = backend_dir.parent  # /.../auto-rps-obe
        home_dir = Path.home()
        
        target_db = backend_dir / "autorps.db"
        candidate_paths = [
            root_dir / "autorps.db",
            home_dir / "auto-rps-obe" / "autorps.db",
            home_dir / "autorps.db",
            Path.cwd() / "autorps.db",
        ]
        
        target_size = target_db.stat().st_size if target_db.exists() else 0
        for cand in candidate_paths:
            if cand.resolve() != target_db.resolve() and cand.exists():
                cand_size = cand.stat().st_size
                if cand_size > target_size and cand_size > 12288:  # > 12KB (contains actual user data)
                    print(f"[DATABASE RECOVERY] Copying existing database with data ({cand_size} bytes) from {cand} to {target_db}...")
                    shutil.copy2(cand, target_db)
                    shutil.copy2(cand, root_dir / "autorps.db")
                    break
    except Exception as e:
        print(f"[DATABASE RECOVERY] Notice: {e}")

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
                
                # ── Auto-recovery: restore MataKuliah from _mata_kuliah_old or RPS records ──
                res_mk_count = await session.execute(text("SELECT COUNT(*) FROM mata_kuliah"))
                mk_count = res_mk_count.scalar() or 0
                
                # Check if _mata_kuliah_old table exists in SQLite
                tables_res = await session.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='_mata_kuliah_old'"))
                if tables_res.scalar_one_or_none():
                    print("[DATABASE RECOVERY] _mata_kuliah_old table found! Recovering courses...")
                    try:
                        await session.execute(text("""
                            INSERT OR IGNORE INTO mata_kuliah (id, kode, nama, sks, sks_teori, sks_praktik, semester, prodi_id, status)
                            SELECT id, kode, nama, COALESCE(sks, 3), COALESCE(sks_teori, 2), COALESCE(sks_praktik, 1), COALESCE(semester, 1), prodi_id, COALESCE(status, 'aktif')
                            FROM _mata_kuliah_old
                        """))
                        await session.commit()
                        res_mk_count = await session.execute(text("SELECT COUNT(*) FROM mata_kuliah"))
                        mk_count = res_mk_count.scalar() or 0
                    except Exception as ex_rec:
                        print(f"[DATABASE RECOVERY] Error copying from _mata_kuliah_old: {ex_rec}")

                if mk_count == 0:
                    res_rps = await session.execute(text("SELECT id, mata_kuliah_id, prodi_id, semester, kode, identitas FROM rps"))
                    rps_rows = res_rps.fetchall()
                    if rps_rows:
                        print(f"[DATABASE RECOVERY] mata_kuliah table is empty, but {len(rps_rows)} RPS entries found. Auto-recreating MataKuliah entries...")
                        recovered_count = 0
                        for r_row in rps_rows:
                            r_id, r_mk_id, r_prodi_id, r_sem, r_kode, r_ident = r_row
                            mk_kode = f"MK-{r_mk_id}"
                            mk_nama = f"Mata Kuliah {r_mk_id}"
                            mk_sks = 3
                            
                            if r_ident:
                                if isinstance(r_ident, str):
                                    try: r_ident = json.loads(r_ident)
                                    except: r_ident = {}
                                if isinstance(r_ident, dict):
                                    mk_kode = r_ident.get("kode_mata_kuliah") or r_ident.get("kode") or mk_kode
                                    mk_nama = r_ident.get("nama_mata_kuliah") or r_ident.get("nama") or mk_nama
                                    mk_sks = r_ident.get("sks") or 3
                            
                            try:
                                await session.execute(text("""
                                    INSERT OR IGNORE INTO mata_kuliah (id, kode, nama, sks, sks_teori, sks_praktik, semester, prodi_id, status)
                                    VALUES (:id, :kode, :nama, :sks, 2, 1, :semester, :prodi_id, 'aktif')
                                """), {
                                    "id": r_mk_id,
                                    "kode": mk_kode,
                                    "nama": mk_nama,
                                    "sks": mk_sks,
                                    "semester": r_sem or 1,
                                    "prodi_id": r_prodi_id,
                                })
                                recovered_count += 1
                            except Exception as ex_inst:
                                print(f"[DATABASE RECOVERY] Could not recover MK id {r_mk_id}: {ex_inst}")
                        
                        await session.commit()
                        print(f"[DATABASE RECOVERY] Successfully recovered {recovered_count} MataKuliah entries from RPS table!")
                
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