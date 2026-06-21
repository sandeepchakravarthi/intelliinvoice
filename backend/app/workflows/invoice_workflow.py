import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.ocr_agent import OCRAgent
from app.agents.extraction_agent import ExtractionAgent
from app.agents.validation_agent import ValidationAgent
from app.agents.fraud_detection_agent import FraudDetectionAgent
from app.agents.approval_agent import ApprovalAgent
from app.models.invoice import Invoice, InvoiceStatus, FraudStatus
from app.models.audit_log import AuditLog
from app.core.logging import get_logger
from app.database.session import get_session_factory


logger = get_logger(__name__)


class InvoiceWorkflow:
    """
    Orchestrates the complete invoice processing pipeline:

    Step 1  OCR Agent           - extract raw text from file
    Step 2  Extraction Agent    - structure text into JSON via Qwen LLM
    Step 3  Validation Agent    - business rule checks
    Step 4  Fraud Detection     - duplicates, anomalies, rule engine
    Step 5  Approval Routing    - assign approver role based on amount

    Each step updates the Invoice record in the database.
    Failures are caught and recorded; the invoice is marked as failed.
    """

    def __init__(self) -> None:
        self._ocr = OCRAgent()
        self._extraction = ExtractionAgent()
        self._validation = ValidationAgent()
        self._fraud = FraudDetectionAgent()
        self._approval = ApprovalAgent()

    async def run(
        self,
        invoice_id: str,
        file_bytes: bytes,
        filename: str,
        uploaded_by_id: str,
    ) -> None:
        session_factory = get_session_factory()
        async with session_factory() as db:
            try:
                await self._pipeline(
                    invoice_id, file_bytes, filename, uploaded_by_id, db
                )
                await db.commit()
            except Exception as exc:
                await db.rollback()
                logger.error(
                    f"Workflow failed for invoice {invoice_id}: {exc}", exc_info=True
                )
                await self._mark_failed(invoice_id, str(exc))

    async def _pipeline(
        self,
        invoice_id: str,
        file_bytes: bytes,
        filename: str,
        uploaded_by_id: str,
        db: AsyncSession,
    ) -> None:
        invoice = await self._get_invoice(invoice_id, db)

        # Step 1 - OCR
        invoice.status = InvoiceStatus.processing
        await db.flush()
        logger.info(f"[{invoice_id}] Step 1/5: OCR")
        ocr = self._ocr.process(file_bytes, filename)
        invoice.raw_ocr_text = ocr["raw_text"]
        invoice.file_hash = ocr["file_hash"]
        invoice.confidence_score = ocr["confidence_score"]
        invoice.status = InvoiceStatus.extracted
        await db.flush()

        # Step 2 - LLM extraction
        logger.info(f"[{invoice_id}] Step 2/5: Extraction")
        extracted = await self._extraction.process(ocr["raw_text"])
        invoice.extracted_data = extracted
        invoice.invoice_number = extracted.get("invoice_number")
        invoice.vendor_name = extracted.get("vendor_name")
        invoice.vendor_gstin = extracted.get("vendor_gstin")
        invoice.description = extracted.get("description")
        invoice.currency = extracted.get("currency") or "INR"
        invoice.line_items = extracted.get("line_items")

        for amount_field in ("total_amount", "tax_amount", "subtotal_amount"):
            val = extracted.get(amount_field)
            if val is not None:
                setattr(invoice, amount_field, val)

        for date_field in ("invoice_date", "due_date"):
            val = extracted.get(date_field)
            if val:
                try:
                    setattr(invoice, date_field, datetime.strptime(val, "%Y-%m-%d").date())
                except (ValueError, TypeError):
                    pass
        await db.flush()

        # Step 3 - Validation
        logger.info(f"[{invoice_id}] Step 3/5: Validation")
        validation = self._validation.process(extracted)
        invoice.validation_errors = validation.get("errors", [])
        invoice.validation_warnings = validation.get("warnings", [])

        if not validation["is_valid"]:
            invoice.status = InvoiceStatus.validation_failed
            await db.flush()
            await self._audit(
                db, uploaded_by_id, "validation_failed", invoice_id,
                {"errors": validation["errors"]}
            )
            logger.warning(
                f"[{invoice_id}] Validation failed: {validation['errors']}"
            )
            return

        # Step 4 - Fraud detection
        logger.info(f"[{invoice_id}] Step 4/5: Fraud detection")
        fraud = await self._fraud.process(extracted, ocr["file_hash"], db)
        invoice.fraud_flags = fraud.get("flags", [])

        if fraud["is_fraud"] or fraud["is_duplicate"]:
            invoice.fraud_status = FraudStatus.suspected
            invoice.status = InvoiceStatus.fraud_detected
            await db.flush()
            await self._audit(
                db, uploaded_by_id, "fraud_detected", invoice_id,
                {"flags": fraud["flags"], "score": fraud["fraud_score"]}
            )
            logger.warning(
                f"[{invoice_id}] Fraud detected: score={fraud['fraud_score']}"
            )
            return

        # Step 5 - Approval routing
        logger.info(f"[{invoice_id}] Step 5/5: Approval routing")
        amount = float(invoice.total_amount) if invoice.total_amount else None
        summary = self._approval.get_approval_summary(amount)

        if summary["is_auto_approved"]:
            invoice.status = InvoiceStatus.approved
            invoice.approved_at = datetime.utcnow()
            await self._audit(
                db, uploaded_by_id, "auto_approved", invoice_id,
                {"reason": "Amount below auto-approval threshold"}
            )
            logger.info(f"[{invoice_id}] Auto-approved (amount={amount})")
        else:
            invoice.status = InvoiceStatus.pending_approval
            invoice.current_approver_role = summary["required_approver_role"]
            await self._audit(
                db, uploaded_by_id, "pending_approval", invoice_id,
                {"required_role": summary["required_approver_role"]}
            )
            logger.info(
                f"[{invoice_id}] Routed to {summary['required_approver_role']}"
            )

        await db.flush()

    async def _get_invoice(self, invoice_id: str, db: AsyncSession) -> Invoice:
        result = await db.execute(
            select(Invoice).where(Invoice.id == uuid.UUID(invoice_id))
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise ValueError(f"Invoice {invoice_id} not found")
        return invoice

    async def _mark_failed(self, invoice_id: str, error: str) -> None:
        factory = get_session_factory()
        async with factory() as db:
            try:
                invoice = await self._get_invoice(invoice_id, db)
                invoice.status = InvoiceStatus.validation_failed
                invoice.validation_errors = [f"Processing error: {error}"]
                await db.commit()
            except Exception as exc:
                logger.error(f"Could not mark invoice as failed: {exc}")

    async def _audit(
        self,
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
            logger.warning(f"Audit log write failed: {exc}")


_workflow: Optional[InvoiceWorkflow] = None


def get_workflow() -> InvoiceWorkflow:
    global _workflow
    if _workflow is None:
        _workflow = InvoiceWorkflow()
    return _workflow
