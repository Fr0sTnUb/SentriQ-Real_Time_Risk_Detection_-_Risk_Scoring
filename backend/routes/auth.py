"""
Authentication API routes.

Endpoints:
    POST /api/auth/register — Create a new user account
    POST /api/auth/login    — Authenticate and receive JWT token
    GET  /api/auth/me       — Get current authenticated user
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import User
from auth.jwt import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from schemas.schemas import (
    APIResponse, APIError,
    UserCreate, UserLogin, UserResponse, TokenResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=APIResponse[UserResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Create a new user account with username, password, and role (admin/viewer).",
)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Create a new user account with hashed password."""
    # Check if username already exists
    result = await db.execute(select(User).where(User.username == user_data.username))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{user_data.username}' is already registered.",
        )

    # Validate role
    if user_data.role not in ("admin", "viewer"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'admin' or 'viewer'.",
        )

    # Create user with hashed password
    new_user = User(
        username=user_data.username,
        hashed_password=hash_password(user_data.password),
        role=user_data.role,
    )
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)

    logger.info(f"👤 New user registered: {new_user.username} (role={new_user.role})")

    return APIResponse(
        success=True,
        data=UserResponse.model_validate(new_user),
        message=f"User '{new_user.username}' registered successfully.",
    )


@router.post(
    "/login",
    response_model=APIResponse[TokenResponse],
    summary="Login and get JWT token",
    description="Authenticate with username and password. Returns a signed JWT access token valid for 24 hours.",
)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """Validate credentials and return a signed JWT access token."""
    result = await db.execute(select(User).where(User.username == credentials.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    access_token = create_access_token(data={"sub": user.username, "role": user.role})

    logger.info(f"🔑 User logged in: {user.username}")

    return APIResponse(
        success=True,
        data=TokenResponse(access_token=access_token),
        message="Login successful.",
    )


@router.get(
    "/me",
    response_model=APIResponse[UserResponse],
    summary="Get current user",
    description="Return the currently authenticated user's profile from the JWT token.",
)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the current authenticated user from the JWT token."""
    return APIResponse(
        success=True,
        data=UserResponse.model_validate(current_user),
        message="Current user retrieved.",
    )
