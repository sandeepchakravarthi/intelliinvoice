import re
from datetime import datetime, date
from typing import Optional

from app.core.logging import get_logger
from app.schemas.invoice import ValidationResult


logger = get_logger(__name__)


GSTIN_PATTERN = re.compile(
    r"^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
)

DATE_FORMATS = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d"]


class ValidationAgent:
    """
    Agent 3: Validation Agent

    Checks extracted invoice data for:
    - Required fields presence
    - Valid amount values and math consistency
    - Date format validity and logical ordering
    - GSTIN format compliance
    - Invoice number sanity
    """

    def _parse_date(self, value: str) -> Optional[date]:
        for fmt in DATE_FORMATS:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
        return None

    def _check_required_fields(
        self, data: dict, errors: list, warnings: list
    ) -> None:
        required = ["vendor_name", "invoice_number", "invoice_date", "total_amount"]
        for field in required:
            value = data.get(field)
            if value is None or (isinstance(value, str) and not value.strip()):
                errors.append(
                    f"Missing required field: {field.replace('_', ' ').title()}"
                )

    def _check_amounts(self, data: dict, errors: list, warnings: list) -> None:
        total = data.get("total_amount")
        subtotal = data.get("subtotal_amount")
        tax = data.get("tax_amount")

        if total is not None:
            if not isinstance(total, (int, float)) or total < 0:
                errors.append("Total amount must be a positive number")
            elif total == 0:
                warnings.append("Total amount is zero - verify this is intentional")
            elif total > 10_000_000:
                warnings.append(
                    "Total amount exceeds 1 crore - requires additional verification"
                )

        if total is not None and subtotal is not None and tax is not None:
            calculated = round(subtotal + tax, 2)
            if abs(calculated - total) > 1.0:
                errors.append(
                    f"Amount mismatch: Subtotal {subtotal} + Tax {tax} = {calculated} "
                    f"but Total is {total}"
                )

    def _check_dates(self, data: dict, errors: list, warnings: list) -> None:
        invoice_date_str = data.get("invoice_date")
        due_date_str = data.get("due_date")

        invoice_date = None
        if invoice_date_str:
            invoice_date = self._parse_date(str(invoice_date_str))
            if invoice_date is None:
                errors.append(f"Invalid invoice date format: {invoice_date_str}")
            else:
                today = date.today()
                if invoice_date > today:
                    warnings.append("Invoice date is in the future")
                elif (today - invoice_date).days > 365:
                    warnings.append("Invoice date is more than 1 year old")

        if due_date_str:
            due_date = self._parse_date(str(due_date_str))
            if due_date is None:
                errors.append(f"Invalid due date format: {due_date_str}")
            elif invoice_date and due_date < invoice_date:
                errors.append("Due date cannot be earlier than invoice date")

    def _check_gstin(self, data: dict, errors: list, warnings: list) -> None:
        gstin = data.get("vendor_gstin")
        if gstin:
            cleaned = gstin.strip().upper()
            if not GSTIN_PATTERN.match(cleaned):
                errors.append(f"Invalid GSTIN format: {gstin}")

    def _check_invoice_number(
        self, data: dict, errors: list, warnings: list
    ) -> None:
        number = data.get("invoice_number")
        if number:
            stripped = number.strip()
            if len(stripped) < 2:
                errors.append("Invoice number is too short (minimum 2 characters)")
            elif len(stripped) > 50:
                errors.append("Invoice number is too long (maximum 50 characters)")

    def _check_vendor_name(
        self, data: dict, errors: list, warnings: list
    ) -> None:
        name = data.get("vendor_name")
        if name:
            stripped = name.strip()
            if len(stripped) < 2:
                errors.append("Vendor name is too short (minimum 2 characters)")
            if re.match(r"^\d+$", stripped):
                errors.append("Vendor name cannot consist only of numbers")

    def process(self, extracted_data: dict) -> dict:
        logger.info(
            f"Validation Agent processing invoice: {extracted_data.get('invoice_number')}"
        )
        errors = []
        warnings = []

        self._check_required_fields(extracted_data, errors, warnings)
        self._check_amounts(extracted_data, errors, warnings)
        self._check_dates(extracted_data, errors, warnings)
        self._check_gstin(extracted_data, errors, warnings)
        self._check_invoice_number(extracted_data, errors, warnings)
        self._check_vendor_name(extracted_data, errors, warnings)

        is_valid = len(errors) == 0
        logger.info(
            f"Validation complete: valid={is_valid} errors={len(errors)} warnings={len(warnings)}"
        )

        return ValidationResult(
            is_valid=is_valid,
            errors=errors,
            warnings=warnings,
        ).model_dump()
