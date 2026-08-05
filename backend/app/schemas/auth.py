from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    KETUA_PRODI = "ketua_prodi"
    GMK = "gmk"
    DOSEN = "dosen"
    PRODI = "prodi"  # legacy


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4)
    email: Optional[str] = None
    nama: str
    nidn: Optional[str] = None
    role: UserRole = UserRole.PRODI
    prodi_id: Optional[int] = None


class UserUpdate(BaseModel):
    nama: Optional[str] = None
    email: Optional[str] = None
    nidn: Optional[str] = None
    role: Optional[UserRole] = None
    prodi_id: Optional[int] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    nama: str
    nidn: Optional[str] = None
    role: Any
    prodi_id: Optional[int] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ChangePasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=4)


class BulkUserCreate(BaseModel):
    """Schema for a single row in a bulk user import."""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4)
    nama: str
    nidn: Optional[str] = None
    email: Optional[str] = None
    role: UserRole = UserRole.DOSEN
    prodi_id: Optional[int] = None


class BulkUserResult(BaseModel):
    created: int
    errors: int
    total: int
    error_detail: List[str] = []


TokenResponse.model_rebuild()
