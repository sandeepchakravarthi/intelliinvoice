import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, Field

from app.models.invoice import InvoiceStatus, FraudStatus


class ExtractedInvoiceData(BaseModel):
    vendor_name: Optional[str] = None
    vendor_gstin: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    total_amount: Optional[float] = None
    tax_amount: Optional[float] = None
    subtotal_amount: Optional[float] = None
    currency: Optional[str] = "INR"
    description: Optional[str] = None
    line_items: Optional[List[dict]] = None


class ValidationResult(BaseModel):
    is_valid: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class FraudDetectionResult(BaseModel):
    is_fraud: bool
    fraud_score: float
    flags: List[str] = Field(default_factory=list)
    is_duplicate: bool = False
    duplicate_invoice_id: Optional[str] = None


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    invoice_number: Optional[str]
    vendor_name: Optional[str]
    vendor_gstin: Optional[str]
    invoice_date: Optional[date]
    due_date: Optional[date]
    total_amount: Optional[Decimal]
    tax_amount: Optional[Decimal]
    subtotal_amount: Optional[Decimal]
    currency: str
    description: Optional[str]
    line_items: Optional[list]
    status: InvoiceStatus
    fraud_status: FraudStatus
    file_name: str
    file_path: str
    raw_ocr_text: Optional[str]
    extracted_data: Optional[dict]
    validation_errors: Optional[list]
    validation_warnings: Optional[list]
    fraud_flags: Optional[list]
    confidence_score: Optional[float]
    current_approver_role: Optional[str]
    rejection_reason: Optional[str]
    uploaded_by: uuid.UUID
    approved_by: Optional[uuid.UUID]
    approved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvoiceListResponse(BaseModel):
    invoices: List[InvoiceResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class InvoiceUpdateRequest(BaseModel):
    vendor_name: Optional[str] = None
    vendor_gstin: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    total_amount: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    subtotal_amount: Optional[Decimal] = None
    description: Optional[str] = None


class ApprovalRequest(BaseModel):
    comments: Optional[str] = None


class RejectionRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=1000)


class DashboardStats(BaseModel):
    total_invoices: int
    pending_approvals: int
    approved_today: int
    rejected_today: int
    fraud_alerts: int
    total_amount_processed: float
    average_processing_time_hours: float
    invoices_by_status: dict
    monthly_trend: List[dict]
    top_vendors: List[dict]
