from pydantic import BaseModel
from typing import Optional


class CreditResponse(BaseModel):
    """Response for credit balance query"""
    success: bool
    credits: Optional[int] = None
    message: Optional[str] = None

