from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.invoice import router as invoice_router
from app.api.routes.approval import router as approval_router
from app.api.routes.dashboard import router as dashboard_router


api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(invoice_router)
api_router.include_router(approval_router)
api_router.include_router(dashboard_router)
