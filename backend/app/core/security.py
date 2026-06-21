from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status

from app.core.config import get_config


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    cfg = get_config()["jwt"]
    payload = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=cfg["access_token_expire_minutes"])
    )
    payload.update({"exp": expire, "type": "access"})
    return jwt.encode(payload, cfg["secret_key"], algorithm=cfg["algorithm"])


def create_refresh_token(data: dict) -> str:
    cfg = get_config()["jwt"]
    payload = data.copy()
    expire = datetime.utcnow() + timedelta(days=cfg["refresh_token_expire_days"])
    payload.update({"exp": expire, "type": "refresh"})
    return jwt.encode(payload, cfg["secret_key"], algorithm=cfg["algorithm"])


def decode_token(token: str) -> dict:
    cfg = get_config()["jwt"]
    try:
        return jwt.decode(token, cfg["secret_key"], algorithms=[cfg["algorithm"]])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
