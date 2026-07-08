from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models import User, UserRole
from app.schemas.auth import (
    LoginRequest, TokenResponse, UserCreate, UserUpdate, UserResponse,
    ChangePasswordRequest,
)
from app.core.auth import (
    create_access_token, verify_password, hash_password,
    get_current_user, get_admin_user,
)
from datetime import timedelta
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Akun tidak aktif")

    token = create_access_token(
        data={"sub": str(user.id), "role": user.role.value},
        expires_delta=timedelta(days=7),
    )
    return TokenResponse(access_token=token, user=user)


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.post("/users", response_model=UserResponse)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    exists = await db.execute(select(User).where(User.username == data.username))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username sudah digunakan")
    
    # Normalize empty strings to None to avoid unique constraint violations
    email_val = data.email.strip() if (data.email and data.email.strip()) else None
    nidn_val = data.nidn.strip() if (data.nidn and data.nidn.strip()) else None

    # Check unique constraint manually to return user friendly messages
    if email_val:
        email_exists = await db.execute(select(User).where(User.email == email_val))
        if email_exists.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email sudah digunakan oleh user lain")
            
    if nidn_val:
        nidn_exists = await db.execute(select(User).where(User.nidn == nidn_val))
        if nidn_exists.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="NIDN sudah digunakan oleh user lain")
    
    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        email=email_val,
        nama=data.nama,
        nidn=nidn_val,
        role=data.role,
        prodi_id=data.prodi_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(User))
    return result.scalars().all()


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    for key, val in data.model_dump(exclude_unset=True).items():
        if key in ["email", "nidn"] and isinstance(val, str) and not val.strip():
            setattr(user, key, None)
        else:
            setattr(user, key, val)
            
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="Tidak bisa hapus akun sendiri")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()


@router.put("/users/{user_id}/password", response_model=dict)
async def reset_user_password(
    user_id: int,
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Admin reset password user lain."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(data.new_password)
    await db.commit()
    return {"success": True, "message": "Password berhasil diubah"}


@router.post("/me/change-password", response_model=dict)
async def change_my_password(
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """User ganti password sendiri."""
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    user.password_hash = hash_password(data.new_password)
    await db.commit()
    return {"success": True, "message": "Password berhasil diubah"}
