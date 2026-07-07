from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    DOSEN = "dosen"


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4)
    email: Optional[str] = None
    nama: str
    nidn: Optional[str] = None
    role: UserRole = UserRole.DOSEN
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
    role: UserRole
    prodi_id: Optional[int] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True