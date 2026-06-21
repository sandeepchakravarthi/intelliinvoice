import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.agents.approval_agent import ApprovalAgent
from app.core.logging import get_logger
from app.database.session import get_db
from app.models.audit_log import AuditLog
from app.models.invoice import Invoice, InvoiceStatus
from app.models.user import User, UserRole
from app.schemas.invoice import ApprovalRequest, InvoiceResponse, RejectionRequest


logger = get_logger(__name__)
router = APIRouter(prefix="/approval", tags=["Approval"])

_approval_agent = ApprovalAgent()


async def write_audit(
    db: AsyncSession,
    user_id: str,
    action: str,
    resource_id: str,
    details: Optional[dict] = None,
) -> None:
    try:
        log = AuditLog(
            user_id=uuid.UUID(user_id),
            action=action,
            resource_type="invoice",
            resource_id=resource_id,
            details=details or {},
        )
        db.add(log)
        await db.flush()
    except Exception as exc:
        logger.warning(f"Audit write failed: {exc}")


@router.post("/approve/{invoice_id}", response_model=InvoiceResponse)
async def approve_invoice(
    invoice_id: str,
    body: ApprovalRequest,
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
    if invoice.status != InvoiceStatus.pending_approval:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invoice is not pending approval. Current status: {invoice.status.value}",
        )

    amount = float(invoice.total_amount) if invoice.total_amount else None
    if not _approval_agent.can_approve(current_user.role.value, amount):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Your role ({current_user.role.value}) does not have authority "
                f"to approve invoices of this amount"
            ),
        )

    invoice.status = InvoiceStatus.approved
    invoice.approved_by = current_user.id
    invoice.approved_at = datetime.utcnow()
    invoice.current_approver_role = None

    await db.flush()
    await write_audit(
        db, str(current_user.id), "invoice_approved", invoice_id,
        {
            "approved_by_role": current_user.role.value,
            "amount": amount,
            "comments": body.comments,
        },
    )

    logger.info(f"Invoice {invoice_id} approved by {current_user.email}")
    return InvoiceResponse.model_validate(invoice)


@router.post("/reject/{invoice_id}", response_model=InvoiceResponse)
async def reject_invoice(
    invoice_id: str,
    body: RejectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvoiceResponse:
    if current_user.role == UserRole.auditor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Auditors do not have permission to reject invoices",
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
    if invoice.status not in (
        InvoiceStatus.pending_approval,
        InvoiceStatus.fraud_detected,
        InvoiceStatus.validation_failed,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot reject invoice with status: {invoice.status.value}",
        )

    invoice.status = InvoiceStatus.rejected
    invoice.rejection_reason = body.reason
    invoice.current_approver_role = None

    await db.flush()
    await write_audit(
        db, str(current_user.id), "invoice_rejected", invoice_id,
        {"reason": body.reason, "rejected_by_role": current_user.role.value},
    )

    logger.info(f"Invoice {invoice_id} rejected by {current_user.email}")
    return InvoiceResponse.model_validate(invoice)


@router.get("/pending", response_model=list)
async def get_pending_approvals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list:
    conditions = [Invoice.status == InvoiceStatus.pending_approval]

    if current_user.role == UserRole.finance_user:
        conditions.append(
            Invoice.current_approver_role == UserRole.finance_user.value
        )
    elif current_user.role == UserRole.manager:
        conditions.append(Invoice.current_approver_role == UserRole.manager.value)

    stmt = (
        select(Invoice)
        .where(and_(*conditions))
        .order_by(Invoice.created_at.asc())
    )
    invoices = (await db.execute(stmt)).scalars().all()
    return [InvoiceResponse.model_validate(inv) for inv in invoices]
