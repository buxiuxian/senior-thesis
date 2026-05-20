from pydantic import BaseModel
from typing import Optional, Any


class ErrorDetail(BaseModel):
    """Error detail structure"""
    code: str
    message: str


class ErrorResponse(BaseModel):
    """Unified error response"""
    success: bool = False
    error: ErrorDetail


class SuccessResponse(BaseModel):
    """Unified success response"""
    success: bool = True
    data: Optional[Any] = None
    message: Optional[str] = None

