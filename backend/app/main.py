import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import get_config
from app.core.logging import get_logger, setup_logging
from app.database.session import create_tables, dispose_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger = get_logger(__name__)
    logger.info("IntelliInvoice AI starting up")
    try:
        await create_tables()
        logger.info("Database tables ready")
    except Exception as exc:
        logger.error(f"Database initialisation failed: {exc}")
        raise
    yield
    logger.info("IntelliInvoice AI shutting down")
    await dispose_engine()


cfg = get_config()
app_cfg = cfg["app"]

app = FastAPI(
    title="IntelliInvoice AI",
    description=(
        "AI-powered invoice processing platform. "
        "Extracts, validates, screens for fraud, and routes invoices through approval workflows."
    ),
    version=app_cfg["version"],
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=app_cfg["allowed_origins"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = get_logger(__name__)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    start = time.time()
    response = await call_next(request)
    ms = round((time.time() - start) * 1000, 1)
    logger.info(
        f"[{request_id}] {request.method} {request.url.path} "
        f"-> {response.status_code} ({ms}ms)"
    )
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        f"Unhandled exception: {request.method} {request.url.path}: {exc}",
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal server error occurred. Please try again.",
            "path": str(request.url.path),
        },
    )


app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
async def health() -> dict:
    return {
        "status": "healthy",
        "service": "IntelliInvoice AI",
        "version": app_cfg["version"],
    }
