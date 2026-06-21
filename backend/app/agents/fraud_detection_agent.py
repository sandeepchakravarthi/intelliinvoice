import re
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_config
from app.core.logging import get_logger
from app.models.invoice import Invoice, InvoiceStatus
from app.schemas.invoice import FraudDetectionResult


logger = get_logger(__name__)


class FraudDetectionAgent:
    """
    Agent 4: Fraud Detection Agent

    Detection methods:
    1. Duplicate invoice number - same number seen within the lookback window
    2. Duplicate file hash - identical file bytes already uploaded
    3. Amount anomaly - Z-score analysis against vendor payment history
    4. Rule engine - round amounts, short vendor names, suspicious keywords
    """

    def __init__(self) -> None:
        self._cfg = get_config()["fraud_detection"]

    async def process(
        self, extracted_data: dict, file_hash: str, db: AsyncSession
    ) -> dict:
        invoice_number = extracted_data.get("invoice_number")
        vendor_name = extracted_data.get("vendor_name")
        total_amount = extracted_data.get("total_amount")

        logger.info(
            f"Fraud Detection Agent: invoice={invoice_number} vendor={vendor_name}"
        )

        flags: list = []
        is_duplicate = False
        duplicate_invoice_id: Optional[str] = None
        fraud_score = 0.0

        dup_num = await self._check_duplicate_number(invoice_number, db)
        if dup_num:
            flags.append(
                f"Duplicate invoice number detected. Original ID: {dup_num}"
            )
            is_duplicate = True
            duplicate_invoice_id = dup_num
            fraud_score = max(fraud_score, 0.90)

        dup_hash = await self._check_duplicate_hash(file_hash, db)
        if dup_hash:
            flags.append(
                f"Identical file already exists in the system. Original ID: {dup_hash}"
            )
            is_duplicate = True
            duplicate_invoice_id = duplicate_invoice_id or dup_hash
            fraud_score = max(fraud_score, 0.95)

        if total_amount and vendor_name:
            amount_flags, amount_score = await self._check_amount_anomaly(
                total_amount, vendor_name, db
            )
            flags.extend(amount_flags)
            fraud_score = max(fraud_score, amount_score)

        rule_flags, rule_score = self._rule_engine(extracted_data)
        flags.extend(rule_flags)
        fraud_score = max(fraud_score, rule_score)

        fraud_score = min(round(fraud_score, 4), 1.0)
        is_fraud = fraud_score >= 0.70 or is_duplicate

        logger.info(
            f"Fraud detection complete: score={fraud_score} duplicate={is_duplicate} "
            f"flags={len(flags)}"
        )

        return FraudDetectionResult(
            is_fraud=is_fraud,
            fraud_score=fraud_score,
            flags=flags,
            is_duplicate=is_duplicate,
            duplicate_invoice_id=duplicate_invoice_id,
        ).model_dump()

    async def _check_duplicate_number(
        self, invoice_number: Optional[str], db: AsyncSession
    ) -> Optional[str]:
        if not invoice_number:
            return None
        window_days = self._cfg["duplicate_check_window_days"]
        cutoff = datetime.utcnow() - timedelta(days=window_days)
        stmt = (
            select(Invoice.id)
            .where(
                and_(
                    Invoice.invoice_number == invoice_number.strip(),
                    Invoice.created_at >= cutoff,
                    Invoice.status != InvoiceStatus.rejected,
                )
            )
            .limit(1)
        )
        result = await db.execute(stmt)
        row = result.first()
        return str(row[0]) if row else None

    async def _check_duplicate_hash(
        self, file_hash: str, db: AsyncSession
    ) -> Optional[str]:
        if not file_hash:
            return None
        stmt = select(Invoice.id).where(Invoice.file_hash == file_hash).limit(1)
        result = await db.execute(stmt)
        row = result.first()
        return str(row[0]) if row else None

    async def _check_amount_anomaly(
        self, amount: float, vendor_name: str, db: AsyncSession
    ) -> tuple:
        flags = []
        score = 0.0

        cutoff = datetime.utcnow() - timedelta(days=365)
        stmt = (
            select(Invoice.total_amount)
            .where(
                and_(
                    Invoice.vendor_name.ilike(f"%{vendor_name}%"),
                    Invoice.created_at >= cutoff,
                    Invoice.total_amount.isnot(None),
                    Invoice.status != InvoiceStatus.rejected,
                )
            )
        )
        result = await db.execute(stmt)
        history = [float(row[0]) for row in result.fetchall() if row[0]]

        min_history = self._cfg["min_vendor_history_count"]
        if len(history) >= min_history:
            mean = sum(history) / len(history)
            std = (sum((x - mean) ** 2 for x in history) / len(history)) ** 0.5
            if std > 0:
                z = abs(amount - mean) / std
                threshold = self._cfg["unusual_amount_std_multiplier"]
                if z > threshold:
                    flags.append(
                        f"Unusual amount: {amount:,.2f} is {z:.1f} standard deviations "
                        f"from vendor average {mean:,.2f}"
                    )
                    score = min(0.60 + (z - threshold) * 0.05, 0.80)

        suspicious_limit = self._cfg["suspicious_amount_threshold"]
        if amount > suspicious_limit:
            flags.append(
                f"Invoice amount {amount:,.2f} exceeds suspicious threshold {suspicious_limit:,}"
            )
            score = max(score, 0.55)

        return flags, score

    def _rule_engine(self, data: dict) -> tuple:
        flags = []
        score = 0.0

        amount = data.get("total_amount")
        if amount and amount > 100:
            amount_str = str(int(amount)).rstrip("0")
            trailing_zeros = len(str(int(amount))) - len(amount_str)
            if trailing_zeros >= 5:
                flags.append(
                    f"Amount {amount:,.0f} is suspiciously round (many trailing zeros)"
                )
                score = max(score, 0.30)

        vendor = data.get("vendor_name") or ""
        if 0 < len(vendor.strip()) <= 3:
            flags.append(f"Vendor name is unusually short: '{vendor}'")
            score = max(score, 0.25)

        number = data.get("invoice_number") or ""
        if re.search(r"(test|fake|dummy|sample|demo)", number.lower()):
            flags.append(f"Invoice number contains suspicious keyword: '{number}'")
            score = max(score, 0.80)

        return flags, score
