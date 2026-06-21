import uuid
import enum
from datetime import datetime, date
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean, Date, DateTime, Enum as SAEnum,
    Float, ForeignKey, Numeric, String, Text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class InvoiceStatus(str, enum.Enum):
    uploaded = "uploaded"
    processing = "processing"
    extracted = "extracted"
    validation_failed = "validation_failed"
    pending_approval = "pending_approval"
    approved = "approved"
    rejected = "rejected"
    fraud_detected = "fraud_detected"


class FraudStatus(str, enum.Enum):
    clear = "clear"
    suspected = "suspected"
    confirmed = "confirmed"


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_number: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, index=True
    )
    vendor_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    vendor_gstin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    invoice_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    total_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2), nullable=True
    )
    tax_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2), nullable=True
    )
    subtotal_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2), nullable=True
    )
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    line_items: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)

    status: Mapped[InvoiceStatus] = mapped_column(
        SAEnum(InvoiceStatus), default=InvoiceStatus.uploaded, nullable=False, index=True
    )
    fraud_status: Mapped[FraudStatus] = mapped_column(
        SAEnum(FraudStatus), default=FraudStatus.clear, nullable=False
    )

    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_hash: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, index=True
    )

    raw_ocr_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extracted_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    validation_errors: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    validation_warnings: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    fraud_flags: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    current_approver_role: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"Invoice(id={self.id}, number={self.invoice_number}, status={self.status})"
