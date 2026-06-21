import math
import uuid
from pathlib import Path
from typing import Optional

from fastapi import (
    APIRouter, BackgroundTasks, Depends, File, HTTPException,
    Query, Request, UploadFile, status,
)
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_config
from app.core.logging import get_logger
from app.database.session import get_db
from app.models.audit_log import AuditLog
from app.models.invoice import Invoice, InvoiceStatus
from app.models.user import User, UserRole
from app.schemas.invoice import InvoiceListResponse, InvoiceResponse, InvoiceUpdateRequest
from app.services.storage_service import get_storage
from app.workflows.invoice_workflow import get_workflow


logger = get_logger(__name__)
router = APIRouter(prefix="/invoice", tags=["Invoices"])

ALLOWED_CONTENT_TYPES = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/tiff": ".tiff",
    "image/webp": ".webp",
}


async def write_audit(
    db: AsyncSession,
    user_id: str,
    action: str,
    resource_id: str,
    details: Optional[dict] = None,
    ip: Optional[str] = None,
) -> None:
    try:
        log = AuditLog(
            user_id=uuid.UUID(user_id),
            action=action,
            resource_type="invoice",
            resource_id=resource_id,
            details=details or {},
            ip_address=ip,
        )
        db.add(log)
        await db.flush()
    except Exception as exc:
        logger.warning(f"Audit write failed: {exc}")


def get_client_ip(request: Optional[Request]) -> Optional[str]:
    if not request or not request.client:
        return None
    return request.client.host


@router.post("/upload", response_model=InvoiceResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_invoice(
    background_tasks: BackgroundTasks,
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvoiceResponse:
    cfg = get_config()["file_upload"]

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Unsupported file type: {file.content_type}. "
                "Accepted: PDF, PNG, JPG, TIFF, WEBP"
            ),
        )

    file_bytes = await file.read()
    max_bytes = cfg["max_file_size_mb"] * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"File size {len(file_bytes) / 1024 / 1024:.1f} MB exceeds "
                f"limit of {cfg['max_file_size_mb']} MB"
            ),
        )

    object_name = f"invoices/{uuid.uuid4()}/{file.filename}"
    get_storage().upload(file_bytes, object_name, file.content_type)

    invoice = Invoice(
        file_path=object_name,
        file_name=file.filename,
        status=InvoiceStatus.uploaded,
        uploaded_by=current_user.id,
    )
    db.add(invoice)
    await db.flush()

    invoice_id = str(invoice.id)
    await write_audit(
        db, str(current_user.id), "invoice_uploaded", invoice_id,
        {"filename": file.filename, "size_bytes": len(file_bytes)},
        get_client_ip(request),
    )

    background_tasks.add_task(
        get_workflow().run,
        invoice_id=invoice_id,
        file_bytes=file_bytes,
        filename=file.filename,
        uploaded_by_id=str(current_user.id),
    )

    logger.info(f"Invoice uploaded by {current_user.email}: {file.filename}")
    return InvoiceResponse.model_validate(invoice)


@router.post("/upload/bulk", status_code=status.HTTP_202_ACCEPTED)
async def upload_bulk(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list:
    cfg = get_config()["file_upload"]
    max_files = cfg["max_bulk_files"]

    if len(files) > max_files:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Maximum {max_files} files allowed per bulk upload",
        )

    results = []
    storage = get_storage()
    workflow = get_workflow()

    for file in files:
        if file.content_type not in ALLOWED_CONTENT_TYPES:
            results.append(
                {
                    "filename": file.filename,
                    "status": "rejected",
                    "reason": f"Unsupported file type: {file.content_type}",
                }
            )
            continue

        file_bytes = await file.read()
        object_name = f"invoices/{uuid.uuid4()}/{file.filename}"
        storage.upload(file_bytes, object_name, file.content_type)

        invoice = Invoice(
            file_path=object_name,
            file_name=file.filename,
            status=InvoiceStatus.uploaded,
            uploaded_by=current_user.id,
        )
        db.add(invoice)
        await db.flush()

        invoice_id = str(invoice.id)
        await write_audit(
            db, str(current_user.id), "invoice_bulk_uploaded", invoice_id,
            {"filename": file.filename}
        )

        background_tasks.add_task(
            workflow.run,
            invoice_id=invoice_id,
            file_bytes=file_bytes,
            filename=file.filename,
            uploaded_by_id=str(current_user.id),
        )

        results.append(
            {"filename": file.filename, "invoice_id": invoice_id, "status": "queued"}
        )

    logger.info(f"Bulk upload by {current_user.email}: {len(files)} files")
    return results


@router.get("/list", response_model=InvoiceListResponse)
async def list_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    invoice_status: Optional[InvoiceStatus] = Query(None, alias="status"),
    vendor: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvoiceListResponse:
    cfg = get_config()["pagination"]
    page_size = min(page_size, cfg["max_page_size"])

    conditions = []
    if current_user.role == UserRole.finance_user:
        conditions.append(Invoice.uploaded_by == current_user.id)
    if invoice_status:
        conditions.append(Invoice.status == invoice_status)
    if vendor:
        conditions.append(Invoice.vendor_name.ilike(f"%{vendor}%"))

    where_clause = and_(*conditions) if conditions else None

    count_stmt = select(func.count(Invoice.id))
    if where_clause is not None:
        count_stmt = count_stmt.where(where_clause)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = select(Invoice).order_by(Invoice.created_at.desc())
    if where_clause is not None:
        stmt = stmt.where(where_clause)
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    invoices = (await db.execute(stmt)).scalars().all()

    return InvoiceListResponse(
        invoices=[InvoiceResponse.model_validate(inv) for inv in invoices],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvoiceResponse:
    result = await db.execute(
        select(Invoice).where(Invoice.id == uuid.UUID(invoice_id))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    if (
        current_user.role == UserRole.finance_user
        and invoice.uploaded_by != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this invoice",
        )
    return InvoiceResponse.model_validate(invoice)


@router.get("/{invoice_id}/download-url")
async def get_download_url(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    result = await db.execute(
        select(Invoice).where(Invoice.id == uuid.UUID(invoice_id))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    url = get_storage().get_presigned_url(invoice.file_path)
    return {"download_url": url, "expires_in_seconds": 3600}


@router.put("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: str,
    body: InvoiceUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvoiceResponse:
    result = await db.execute(
        select(Invoice).where(Invoice.id == uuid.UUID(invoice_id))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    if invoice.status in (InvoiceStatus.approved, InvoiceStatus.rejected):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot modify an approved or rejected invoice",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(invoice, field, value)

    await db.flush()
    await write_audit(
        db, str(current_user.id), "invoice_updated", invoice_id,
        {"updated_fields": list(update_data.keys())}
    )
    return InvoiceResponse.model_validate(invoice)


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    if current_user.role not in (UserRole.admin, UserRole.finance_head):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and finance heads can delete invoices",
        )
    result = await db.execute(
        select(Invoice).where(Invoice.id == uuid.UUID(invoice_id))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )

    try:
        get_storage().delete(invoice.file_path)
    except Exception as exc:
        logger.warning(f"Storage delete failed (continuing): {exc}")

    await db.delete(invoice)
    await write_audit(
        db, str(current_user.id), "invoice_deleted", invoice_id,
        {"filename": invoice.file_name}
    )
    logger.info(f"Invoice {invoice_id} deleted by {current_user.email}")
