from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.logging import get_logger
from app.database.session import get_db
from app.models.invoice import Invoice, InvoiceStatus
from app.models.user import User, UserRole
from app.schemas.invoice import DashboardStats


logger = get_logger(__name__)
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardStats:
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    user_filter = []
    if current_user.role == UserRole.finance_user:
        user_filter = [Invoice.uploaded_by == current_user.id]

    def with_filter(stmt):
        if user_filter:
            return stmt.where(and_(*user_filter))
        return stmt

    total = (await db.execute(with_filter(select(func.count(Invoice.id))))).scalar_one() or 0

    pending = (
        await db.execute(
            with_filter(
                select(func.count(Invoice.id)).where(
                    Invoice.status == InvoiceStatus.pending_approval
                )
            )
        )
    ).scalar_one() or 0

    approved_today = (
        await db.execute(
            with_filter(
                select(func.count(Invoice.id)).where(
                    and_(
                        Invoice.status == InvoiceStatus.approved,
                        Invoice.approved_at >= today,
                    )
                )
            )
        )
    ).scalar_one() or 0

    rejected_today = (
        await db.execute(
            with_filter(
                select(func.count(Invoice.id)).where(
                    and_(
                        Invoice.status == InvoiceStatus.rejected,
                        Invoice.updated_at >= today,
                    )
                )
            )
        )
    ).scalar_one() or 0

    fraud_alerts = (
        await db.execute(
            with_filter(
                select(func.count(Invoice.id)).where(
                    Invoice.status == InvoiceStatus.fraud_detected
                )
            )
        )
    ).scalar_one() or 0

    total_amount = (
        await db.execute(
            with_filter(
                select(func.coalesce(func.sum(Invoice.total_amount), 0)).where(
                    Invoice.status == InvoiceStatus.approved
                )
            )
        )
    ).scalar_one() or 0

    status_rows = (
        await db.execute(
            select(Invoice.status, func.count(Invoice.id)).group_by(Invoice.status)
        )
    ).fetchall()
    by_status = {row[0].value: row[1] for row in status_rows}

    cutoff_30 = datetime.utcnow() - timedelta(days=30)
    trend_rows = (
        await db.execute(
            select(
                func.date_trunc("day", Invoice.created_at).label("day"),
                func.count(Invoice.id).label("count"),
                func.coalesce(func.sum(Invoice.total_amount), 0).label("amount"),
            )
            .where(Invoice.created_at >= cutoff_30)
            .group_by(func.date_trunc("day", Invoice.created_at))
            .order_by(func.date_trunc("day", Invoice.created_at))
        )
    ).fetchall()
    monthly_trend = [
        {"date": row[0].strftime("%Y-%m-%d"), "count": row[1], "amount": float(row[2])}
        for row in trend_rows
    ]

    vendor_rows = (
        await db.execute(
            select(
                Invoice.vendor_name,
                func.count(Invoice.id).label("count"),
                func.coalesce(func.sum(Invoice.total_amount), 0).label("total"),
            )
            .where(
                and_(
                    Invoice.vendor_name.isnot(None),
                    Invoice.status == InvoiceStatus.approved,
                )
            )
            .group_by(Invoice.vendor_name)
            .order_by(func.sum(Invoice.total_amount).desc())
            .limit(10)
        )
    ).fetchall()
    top_vendors = [
        {"vendor": row[0], "invoice_count": row[1], "total_amount": float(row[2])}
        for row in vendor_rows
    ]

    return DashboardStats(
        total_invoices=total,
        pending_approvals=pending,
        approved_today=approved_today,
        rejected_today=rejected_today,
        fraud_alerts=fraud_alerts,
        total_amount_processed=float(total_amount),
        average_processing_time_hours=2.5,
        invoices_by_status=by_status,
        monthly_trend=monthly_trend,
        top_vendors=top_vendors,
    )


@router.get("/analytics")
async def get_analytics(
    months: int = Query(6, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    cutoff = datetime.utcnow() - timedelta(days=months * 30)

    monthly = (
        await db.execute(
            select(
                func.date_trunc("month", Invoice.created_at).label("month"),
                func.count(Invoice.id).label("count"),
                func.coalesce(func.sum(Invoice.total_amount), 0).label("amount"),
            )
            .where(Invoice.created_at >= cutoff)
            .group_by(func.date_trunc("month", Invoice.created_at))
            .order_by(func.date_trunc("month", Invoice.created_at))
        )
    ).fetchall()

    vendors = (
        await db.execute(
            select(
                Invoice.vendor_name,
                func.count(Invoice.id).label("count"),
                func.coalesce(func.sum(Invoice.total_amount), 0).label("total"),
            )
            .where(
                and_(
                    Invoice.vendor_name.isnot(None),
                    Invoice.created_at >= cutoff,
                )
            )
            .group_by(Invoice.vendor_name)
            .order_by(func.sum(Invoice.total_amount).desc())
            .limit(10)
        )
    ).fetchall()

    status_rows = (
        await db.execute(
            select(Invoice.status, func.count(Invoice.id))
            .where(Invoice.created_at >= cutoff)
            .group_by(Invoice.status)
        )
    ).fetchall()

    return {
        "monthly_trends": [
            {
                "month": row[0].strftime("%b %Y"),
                "count": row[1],
                "amount": float(row[2]),
            }
            for row in monthly
        ],
        "vendor_breakdown": [
            {
                "vendor": row[0],
                "count": row[1],
                "total_amount": float(row[2]),
            }
            for row in vendors
        ],
        "status_distribution": {row[0].value: row[1] for row in status_rows},
        "period_months": months,
    }
