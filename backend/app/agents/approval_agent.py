from typing import Optional

from app.core.config import get_config
from app.core.logging import get_logger
from app.models.user import UserRole


logger = get_logger(__name__)


class ApprovalAgent:
    """
    Agent 5: Approval Agent

    Routes invoices to the correct approver based on amount thresholds:
      <= auto_approve_below   -> auto approved
      <= finance_user_max     -> Finance User
      <= manager_max          -> Manager
      above                   -> Finance Head

    Role authority for approving:
      Finance User   -> up to finance_user_max
      Manager        -> up to manager_max
      Finance Head   -> any amount
      Admin          -> any amount
    """

    def __init__(self) -> None:
        self._cfg = get_config()["approval_workflow"]

    def get_required_approver_role(self, amount: Optional[float]) -> str:
        if amount is None:
            return UserRole.manager.value

        if amount <= self._cfg["auto_approve_below"]:
            return "auto_approved"
        if amount <= self._cfg["finance_user_max"]:
            return UserRole.finance_user.value
        if amount <= self._cfg["manager_max"]:
            return UserRole.manager.value
        return UserRole.finance_head.value

    def can_approve(self, user_role: str, amount: Optional[float]) -> bool:
        if user_role in (UserRole.admin.value, UserRole.finance_head.value):
            return True
        amount = amount or 0
        if user_role == UserRole.manager.value:
            return amount <= self._cfg["manager_max"]
        if user_role == UserRole.finance_user.value:
            return amount <= self._cfg["finance_user_max"]
        return False

    def get_approval_summary(self, amount: Optional[float]) -> dict:
        role = self.get_required_approver_role(amount)
        return {
            "required_approver_role": role,
            "is_auto_approved": role == "auto_approved",
            "amount": amount,
        }
