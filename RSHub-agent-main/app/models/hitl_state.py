"""HITL state machine: IDLE → PENDING → CONFIRMED → SUBMITTED → IDLE."""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class HITLPhase(str, Enum):
    IDLE = "idle"
    PENDING_CONFIRMATION = "pending"
    CONFIRMED = "confirmed"
    SUBMITTED = "submitted"


class HITLState(BaseModel):
    """Mutable HITL state stored in chat session metadata."""

    phase: HITLPhase = Field(default=HITLPhase.IDLE)
    pending_task_spec: Optional[Dict[str, Any]] = Field(default=None)

    def is_pending(self) -> bool:
        return self.phase == HITLPhase.PENDING_CONFIRMATION

    def is_idle(self) -> bool:
        return self.phase in (HITLPhase.IDLE, HITLPhase.SUBMITTED)

    def set_pending(self, task_spec: Dict[str, Any]) -> None:
        self.phase = HITLPhase.PENDING_CONFIRMATION
        self.pending_task_spec = task_spec

    def confirm(self) -> bool:
        if self.phase != HITLPhase.PENDING_CONFIRMATION:
            return False
        self.phase = HITLPhase.CONFIRMED
        return True

    def mark_submitted(self) -> None:
        """Task submitted — keep pending_task_spec for traceability."""
        self.phase = HITLPhase.SUBMITTED

    def reset(self) -> None:
        self.phase = HITLPhase.IDLE
        self.pending_task_spec = None


def extract_hitl_state_from_session(session_data: Optional[Dict]) -> HITLState:
    """Restore HITL state from chat session metadata."""
    if not session_data:
        return HITLState()

    metadata = session_data.get("metadata") or {}
    hitl_data = metadata.get("hitl_state")

    if not hitl_data:
        return HITLState()

    try:
        return HITLState.model_validate(hitl_data)
    except Exception:
        return HITLState()


def save_hitl_state_to_session(session_data: Dict, state: HITLState) -> None:
    """Save HITL state to chat session metadata."""
    if "metadata" not in session_data:
        session_data["metadata"] = {}
    session_data["metadata"]["hitl_state"] = state.model_dump()
