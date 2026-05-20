from __future__ import annotations
from pydantic import BaseModel
from typing import List, Optional


class ChatMessage(BaseModel):
    """Chat message structure"""
    role: str
    content: str


class FileAttachment(BaseModel):
    """File attachment structure for text files"""
    filename: str
    content: str
    file_type: str


class ChatRequest(BaseModel):
    """Request for agent chat"""
    message: str
    chat_id: Optional[str] = None
    token: str
    attachments: Optional[List[FileAttachment]] = None


class ChatResponse(BaseModel):
    """Response for agent chat"""
    success: bool
    response: str
    chat_id: Optional[str] = None
    tool_calls_made: Optional[int] = 0
    error: Optional[str] = None


class ChatListResponse(BaseModel):
    """Response for listing chat sessions"""
    success: bool
    sessions: List[dict]
    error: Optional[str] = None

