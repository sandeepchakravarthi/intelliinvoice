import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_config
from app.core.logging import get_logger
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.auth import AuthResponse, TokenResponse, UserRegisterRequest, UserLoginRequest, UserResponse


logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def write_audit(
    db: AsyncSession,
    action: str,
    user_id: Optional[str] = None,
    ip: Optional[str] = None,
    details: Optional[dict] = None,
) -> None:
    try:
        log = AuditLog(
            user_id=uuid.UUID(user_id) if user_id else None,
            action=action,
            resource_type="auth",
            ip_address=ip,
            details=details or {},
        )
        db.add(log)
        await db.flush()
    except Exception as exc:
        logger.warning(f"Audit write failed for {action}: {exc}")


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: UserRegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    existing = await db.execute(
        select(User).where(User.email == body.email.lower().strip())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        name=body.name.strip(),
        email=body.email.lower().strip(),
        password_hash=hash_password(body.password),
        role=body.role,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    cfg = get_config()["jwt"]
    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role.value})

    await write_audit(
        db, "user_registered", str(user.id), client_ip(request),
        {"email": user.email, "role": user.role.value}
    )

    logger.info(f"User registered: {user.email} role={user.role.value}")

    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=cfg["access_token_expire_minutes"] * 60,
        ),
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    body: UserLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    result = await db.execute(
        select(User).where(User.email == body.email.lower().strip())
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact your administrator.",
        )

    user.last_login = datetime.utcnow()
    await db.flush()

    cfg = get_config()["jwt"]
    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role.value})

    await write_audit(
        db, "user_login", str(user.id), client_ip(request), {"email": user.email}
    )

    logger.info(f"User logged in: {user.email}")

    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=cfg["access_token_expire_minutes"] * 60,
        ),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)
